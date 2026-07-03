import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import { useTheme } from '../theme/useTheme'
import { dark, light, font, fontSize, fontWeight, letterSpacing, radius, transitions, type ThemeName } from '../theme/tokens'
import { topbarStyle, fieldLabel, inputStyle, statusBadge, cardStyle } from '../theme/styles'

interface Props {
  model: string
  onModel: (model: string) => void
}

// ---------------------------------------------------------------------------
// Icons — thin stroke, matches upload/trash icon style used elsewhere
// ---------------------------------------------------------------------------

function AppearanceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
      <path d="M12 4a8 8 0 010 16z" fill="currentColor" stroke="none" opacity="0.5" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9" />
      <path d="M16 7l3 3" />
      <path d="M13 10l2.5 2.5" />
    </svg>
  )
}

function ModelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Shared card shell
// ---------------------------------------------------------------------------

function SettingsCard({ icon, title, right, children }: { icon: ReactNode; title: string; right?: ReactNode; children: ReactNode }) {
  const { theme } = useTheme()
  const { colors } = theme
  return (
    <div style={{ ...cardStyle(theme), display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${colors.border.default}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: colors.text.readable }}>
          {icon}
          <span style={{ fontFamily: font.sans, fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.text.primary }}>{title}</span>
        </div>
        {right}
      </div>
      <div style={{ padding: 16, flex: 1 }}>{children}</div>
    </div>
  )
}

function ThemeSwatchButton({ name, active, onClick }: { name: ThemeName; active: boolean; onClick: () => void }) {
  const { theme } = useTheme()
  const { colors } = theme
  const preview = name === 'dark' ? dark.colors : light.colors

  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start',
        textAlign: 'left',
        background: active ? colors.bg.hover : 'none',
        border: `1px solid ${active ? colors.accent.default : colors.border.default}`,
        borderRadius: radius.lg,
        padding: 10,
        fontFamily: font.sans,
        cursor: 'pointer',
        transition: transitions.allBase,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <span style={{ fontSize: fontSize.base, color: colors.text.primary, textTransform: 'capitalize' }}>{name}</span>
        {active && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.accent.default} strokeWidth="2" style={{ marginLeft: 'auto' }}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[preview.bg.base, preview.bg.raised, preview.accent.default].map((c, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: radius.sm, border: '1px solid rgba(128,128,128,0.25)', background: c }} />
        ))}
      </div>
    </button>
  )
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

      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 16 }}>

          {/* API key */}
          <SettingsCard
            icon={<KeyIcon />}
            title="API Configuration"
            right={
              <span style={{ ...statusBadge(theme, apiKeySet ? 'success' : 'error'), fontFamily: font.mono, fontSize: fontSize.xs, letterSpacing: letterSpacing.wide3, padding: '2px 8px', borderRadius: radius.sm }}>
                {apiKeySet ? 'configured' : 'not set'}
              </span>
            }
          >
            <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.readable, marginBottom: 10 }}>
              {apiKeyPreview}
            </div>
            <div style={fieldLabel(theme)}>New API Key</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={newApiKey}
                onChange={e => setNewApiKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveApiKey()}
                placeholder="Paste your Gemini API key"
                style={{ ...inputStyle(theme), flex: 1 }}
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
          </SettingsCard>

          {/* model */}
          <SettingsCard icon={<ModelIcon />} title="Model">
            <div style={fieldLabel(theme)}>Default Model</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {models.length > 0 ? (
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  style={{ ...inputStyle(theme), flex: '1 1 140px', cursor: 'pointer' }}
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
                  style={{ ...inputStyle(theme), flex: '1 1 140px' }}
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
                width: '100%',
                background: 'none', border: `1px solid ${colors.border.default}`, borderRadius: radius.md,
                padding: '6px 12px', color: modelsLoading ? colors.text.secondary : colors.text.readable,
                fontFamily: font.mono, fontSize: fontSize.xs, letterSpacing: letterSpacing.wide3,
                cursor: modelsLoading ? 'not-allowed' : 'pointer', transition: transitions.allBase,
              }}
            >
              {modelsLoading ? 'loading...' : 'fetch available models'}
            </button>
            {models.length > 0 && (
              <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: font.mono, fontSize: fontSize.xs, color: colors.text.readable }}>
                <div style={{ width: 5, height: 5, borderRadius: radius.full, background: colors.status.success.text }} />
                {models.length} models available for this key
              </div>
            )}
          </SettingsCard>

          {/* appearance */}
          <SettingsCard icon={<AppearanceIcon />} title="Appearance">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['dark', 'light'] as ThemeName[]).map(name => (
                <ThemeSwatchButton key={name} name={name} active={themeName === name} onClick={() => setTheme(name)} />
              ))}
            </div>
          </SettingsCard>

        </div>

        {error && (
          <div style={{ ...statusBadge(theme, 'error'), borderRadius: radius.md, padding: '10px 14px', fontFamily: font.mono, fontSize: fontSize.sm }}>
            {error}
          </div>
        )}

      </div>
    </>
  )
}
