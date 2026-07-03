import { useState, useEffect } from 'react'
import axios from 'axios'

const topbarStyle: React.CSSProperties = {
  height: 52,
  borderBottom: '1px solid #1a1a18',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 28px',
  flexShrink: 0,
}

const sectionLabel: React.CSSProperties = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  fontWeight: 300,
  color: '#444440',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 12,
}

const fieldLabel: React.CSSProperties = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  color: '#444440',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#111110',
  border: '1px solid #1e1e1c',
  borderRadius: 3,
  color: '#b8b6b0',
  fontFamily: 'DM Mono, monospace',
  fontSize: 12,
  padding: '8px 12px',
  outline: 'none',
}

const divider: React.CSSProperties = {
  height: 1,
  background: '#1a1a18',
  margin: '24px 0',
}

const statusBadge = (ok: boolean): React.CSSProperties => ({
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  letterSpacing: '0.08em',
  padding: '2px 8px',
  borderRadius: 2,
  background: ok ? '#0d1f12' : '#1a0d0d',
  color: ok ? '#4a7c59' : '#c85050',
  border: `1px solid ${ok ? '#1a3020' : '#3a1a1a'}`,
})

interface Props {
  model: string
  onModel: (model: string) => void
}

export default function Settings({ model, onModel }: Props) {
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
      <div style={topbarStyle}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e6e0' }}>Settings</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 28, maxWidth: 560 }}>

        {/* API key */}
        <div style={sectionLabel as React.CSSProperties}>API Configuration</div>

        <div style={{ background: '#111110', border: '1px solid #1a1a18', borderRadius: 4, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888880' }}>
              {apiKeyPreview}
            </div>
            <span style={statusBadge(apiKeySet)}>
              {apiKeySet ? 'configured' : 'not set'}
            </span>
          </div>
          <div style={fieldLabel as React.CSSProperties}>New API Key</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={newApiKey}
              onChange={e => setNewApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveApiKey()}
              placeholder="Paste your Gemini API key"
              style={inputStyle}
            />
            <button
              onClick={saveApiKey}
              disabled={saving || !newApiKey.trim()}
              style={{
                background: saving || !newApiKey.trim() ? '#1a1a18' : '#c8a96e',
                color: saving || !newApiKey.trim() ? '#444440' : '#0a0a0a',
                border: 'none', borderRadius: 3, padding: '8px 16px',
                fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500,
                cursor: saving || !newApiKey.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
            >
              {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <div style={{ marginTop: 8, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#333330' }}>
            Get a free API key at aistudio.google.com
          </div>
        </div>

        <div style={divider} />

        {/* model */}
        <div style={sectionLabel as React.CSSProperties}>Model</div>

        <div style={{ background: '#111110', border: '1px solid #1a1a18', borderRadius: 4, padding: 16 }}>
          <div style={fieldLabel as React.CSSProperties}>Default Model</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {models.length > 0 ? (
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
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
                style={{ ...inputStyle, flex: 1 }}
              />
            )}
            <button
              onClick={saveModel}
              style={{
                background: '#c8a96e', color: '#0a0a0a',
                border: 'none', borderRadius: 3, padding: '8px 16px',
                fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
            >
              {modelSaved ? 'Saved' : 'Save'}
            </button>
          </div>
          <button
            onClick={loadModels}
            disabled={modelsLoading}
            style={{
              background: 'none', border: '1px solid #1e1e1c', borderRadius: 3,
              padding: '6px 12px', color: modelsLoading ? '#444440' : '#888880',
              fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.08em',
              cursor: modelsLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {modelsLoading ? 'loading...' : 'fetch available models'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 16, background: '#1a0d0d', border: '1px solid #3a1a1a', borderRadius: 3, padding: '10px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c85050' }}>
            {error}
          </div>
        )}

      </div>
    </>
  )
}