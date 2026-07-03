import { useState, useEffect } from 'react'
import axios from 'axios'
import { useTheme } from '../theme/useTheme'
import type { ThemeName } from '../theme/tokens'
import { font, fontSize, fontWeight, letterSpacing, radius, transitions } from '../theme/tokens'
import { topbarStyle, sectionLabel, fieldLabel, inputStyle, dividerStyle, statusBadge, cardStyle } from '../theme/styles'

interface Props {
  model: string
  onModel: (model: string) => void
}

export default function Settings({ model, onModel }: Props) {
  const { theme, themeName, setTheme } = useTheme()
  const { colors } = theme
  const [apiKeyPreview, setApiKeyPreview] = useState('loading...')
  const [apiKeySet, setApiKeySet] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState(model)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [modelSaved, setModelSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    axios.get('/api/settings').then(res => {
      setApiKeyPreview(res.data.api_key_preview)
      setApiKeySet(res.data.api_key_set)
      setSelectedModel(res.data.model)
    })
  }, [])

  const loadModels = async () => {
    setModelsLoading(true)
    setError(null)
    try {
      const res = await axios.get('/api/settings/models')
      setModels(res.data.models)
      if (res.data.error) setError(`Could not fetch live model list: ${res.data.error}`)
    } catch {
      setError('Failed to fetch models.')
    }
    setModelsLoading(false)
  }

  const saveApiKey = async () => {
    if (!newApiKey.trim()) return
    setSaving(true)
    setError(null)
    try {
      await axios.post('/api/settings/api-key', { api_key: newApiKey.trim() })
      setApiKeyPreview(`${newApiKey.trim().slice(0, 8)}...${newApiKey.trim().slice(-4)}`)
      setApiKeySet(true)
      setNewApiKey('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to save API key.')
    }
    setSaving(false)
  }

  const saveModel = async () => {
    try {
      await axios.post('/api/settings/model', { model: selectedModel })
      onModel(selectedModel)
      setModelSaved(true)
      setTimeout(() => setModelSaved(false), 2000)
    } catch {
      setError('Failed to save model.')
    }
  }

  return (
    <>
      <div style={topbarStyle(theme)}>
        <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text.primary }}>Settings</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 28, maxWidth: 560 }}>

        {/* appearance */}
        <div style={sectionLabel(theme)}>Appearance</div>

        <div style={{ ...cardStyle(theme), padding: 16, marginBottom: 16, display: 'flex', gap: 8 }}>
          {(['dark', 'light'] as ThemeName[]).map(name => {
            const active = themeName === name
            return (
              <button
                key={name}
                onClick={() => setTheme(name)}
                style={{
                  flex: 1,
                  background: active ? colors.accent.default : 'none',
                  color: active ? colors.accent.contrastText : colors.text.inactive,
                  border: `1px solid ${active ? colors.accent.default : colors.border.default}`,
                  borderRadius: radius.md,
                  padding: '8px 16px',
                  fontFamily: font.sans,
                  fontSize: fontSize.base,
                  fontWeight: active ? fontWeight.medium : fontWeight.regular,
                  cursor: 'pointer',
                  transition: transitions.allBase,
                  textTransform: 'capitalize',
                }}
              >
                {name}
              </button>
            )
          })}
        </div>

        <div style={dividerStyle(theme)} />

        {/* API key */}
        <div style={sectionLabel(theme)}>API Configuration</div>

        <div style={{ ...cardStyle(theme), padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.readable }}>
              {apiKeyPreview}
            </div>
            <span style={{ ...statusBadge(theme, apiKeySet ? 'success' : 'error'), fontFamily: font.mono, fontSize: fontSize.xs, letterSpacing: letterSpacing.wide3, padding: '2px 8px', borderRadius: radius.sm }}>
              {apiKeySet ? 'configured' : 'not set'}
            </span>
          </div>
          <div style={fieldLabel(theme)}>New API Key</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={newApiKey}
              onChange={e => setNewApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveApiKey()}
              placeholder="Paste your Gemini API key"
              style={inputStyle(theme)}
            />
            <button
              onClick={saveApiKey}
              disabled={saving || !newApiKey.trim()}
              style={{
                background: saving || !newApiKey.trim() ? colors.border.default : colors.accent.default,
                color: saving || !newApiKey.trim() ? colors.text.secondary : colors.accent.contrastText,
                border: 'none', borderRadius: radius.md, padding: '8px 16px',
                fontFamily: font.sans, fontSize: fontSize.base, fontWeight: fontWeight.medium,
                cursor: saving || !newApiKey.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', transition: transitions.allBase,
              }}
            >
              {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <div style={{ marginTop: 8, fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.quaternary }}>
            Get a free API key at aistudio.google.com
          </div>
        </div>

        <div style={dividerStyle(theme)} />

        {/* model */}
        <div style={sectionLabel(theme)}>Model</div>

        <div style={{ ...cardStyle(theme), padding: 16 }}>
          <div style={fieldLabel(theme)}>Default Model</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {models.length > 0 ? (
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                style={{ ...inputStyle(theme), flex: 1, cursor: 'pointer' }}
              >
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                style={{ ...inputStyle(theme), flex: 1 }}
              />
            )}
            <button
              onClick={saveModel}
              style={{
                background: colors.accent.default, color: colors.accent.contrastText,
                border: 'none', borderRadius: radius.md, padding: '8px 16px',
                fontFamily: font.sans, fontSize: fontSize.base, fontWeight: fontWeight.medium,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: transitions.allBase,
              }}
            >
              {modelSaved ? 'Saved' : 'Save'}
            </button>
          </div>
          <button
            onClick={loadModels}
            disabled={modelsLoading}
            style={{
              background: 'none', border: `1px solid ${colors.border.default}`, borderRadius: radius.md,
              padding: '6px 12px', color: modelsLoading ? colors.text.secondary : colors.text.readable,
              fontFamily: font.mono, fontSize: fontSize.xs, letterSpacing: letterSpacing.wide3,
              cursor: modelsLoading ? 'not-allowed' : 'pointer', transition: transitions.allBase,
            }}
          >
            {modelsLoading ? 'loading...' : 'fetch available models'}
          </button>
        </div>

        {error && (
          <div style={{ ...statusBadge(theme, 'error'), marginTop: 16, borderRadius: radius.md, padding: '10px 14px', fontFamily: font.mono, fontSize: fontSize.sm }}>
            {error}
          </div>
        )}

      </div>
    </>
  )
}
