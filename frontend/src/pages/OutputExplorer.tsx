import { useState, useEffect } from 'react'
import axios from 'axios'

interface OutputFile {
  filename: string
  path: string
  data: Record<string, unknown>
}

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
  fontSize: 10,
  fontWeight: 300,
  color: '#444440',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 12,
}

function isEvidencedValue(value: unknown): value is { value: number | null; evidence: string | null } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    Object.keys(value).every(k => ['value', 'evidence'].includes(k))
  )
}

function isListOfDicts(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null
}

function FieldValue({ name, value }: { name: string; value: unknown }) {
  const label = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (value === null || value === undefined) return null

  if (isEvidencedValue(value)) {
    if (value.value === null) return null
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#e8e6e0' }}>{String(value.value)}</div>
        {value.evidence && (
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3a3a36', marginTop: 3, letterSpacing: '0.03em' }}>
            {value.evidence}
          </div>
        )}
      </div>
    )
  }

  if (isListOfDicts(value)) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
        {value.map((item, i) => {
          const title = Object.values(item).find(v => typeof v === 'string') as string || `Item ${i + 1}`
          return (
            <ExpandableItem key={i} title={title} item={item} />
          )
        })}
      </div>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#e8e6e0' }}>{value.join(', ')}</div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#e8e6e0' }}>{String(value)}</div>
    </div>
  )
}

function ExpandableItem({ title, item }: { title: string; item: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ border: '1px solid #1a1a18', borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', background: '#111110', border: 'none', cursor: 'pointer',
          color: '#888880', fontFamily: 'DM Sans, sans-serif', fontSize: 12, textAlign: 'left',
        }}
      >
        {title}
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '12px', background: '#0d0d0b', borderTop: '1px solid #1a1a18' }}>
          {Object.entries(item).map(([k, v]) => (
            <FieldValue key={k} name={k} value={v} />
          ))}
        </div>
      )}
    </div>
  )
}

function SignalBadge({ signal }: { signal: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    positive: { bg: '#0d1f12', color: '#4a7c59', border: '#1a3020' },
    negative: { bg: '#1a0d0d', color: '#c85050', border: '#3a1a1a' },
    neutral: { bg: '#1a1608', color: '#c8a96e', border: '#3a3020' },
  }
  const style = colors[signal] || colors.neutral
  return (
    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 2, background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
      {signal}
    </span>
  )
}

export default function OutputExplorer() {
  const [outputs, setOutputs] = useState<OutputFile[]>([])
  const [selected, setSelected] = useState<OutputFile | null>(null)
  const [activeTab, setActiveTab] = useState<'fields' | 'signals' | 'raw'>('fields')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/documents/outputs').then(res => {
      setOutputs(res.data)
      if (res.data.length > 0) setSelected(res.data[0])
      setLoading(false)
    })
  }, [])

  const data = selected?.data || {}

  const metadataKeys = new Set(['confidence', 'extraction_notes'])
  const simpleFields: [string, unknown][] = []
  const evidencedFields: [string, unknown][] = []
  const listFields: [string, unknown][] = []
  const metaFields: [string, unknown][] = []

  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue
    if (metadataKeys.has(k)) { metaFields.push([k, v]); continue }
    if (isEvidencedValue(v)) { evidencedFields.push([k, v]); continue }
    if (isListOfDicts(v)) { listFields.push([k, v]); continue }
    simpleFields.push([k, v])
  }

  const tabs = ['fields', 'signals', 'raw'] as const
  const tabLabels = { fields: 'Numeric Fields', signals: 'Regional Signals', raw: 'Raw JSON' }

  return (
    <>
      <div style={topbarStyle}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e6e0' }}>Output Explorer</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3a3a36', letterSpacing: '0.05em' }}>
          {outputs.length} document{outputs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 28, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440' }}>Loading...</div>
      ) : outputs.length === 0 ? (
        <div style={{ padding: 28, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440' }}>No outputs found. Process some documents first.</div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* left panel — file list */}
          <div style={{ width: 240, minWidth: 240, borderRight: '1px solid #1a1a18', overflowY: 'auto' }}>
            <div style={{ padding: '16px 16px 8px', ...sectionLabel, marginBottom: 0 }}>Documents</div>
            {outputs.map(o => (
              <button
                key={o.filename}
                onClick={() => { setSelected(o); setActiveTab('fields') }}
                style={{
                  width: '100%', display: 'block', padding: '10px 16px', background: selected?.filename === o.filename ? '#161614' : 'transparent',
                  border: 'none', borderLeft: `2px solid ${selected?.filename === o.filename ? '#c8a96e' : 'transparent'}`,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (selected?.filename !== o.filename) (e.currentTarget as HTMLElement).style.background = '#111110' }}
                onMouseLeave={e => { if (selected?.filename !== o.filename) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ fontSize: 11, color: selected?.filename === o.filename ? '#e8e6e0' : '#666660', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(o.data && (o.data as any).competitor_name as string) || o.filename}
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#333330', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.filename}
                </div>
              </button>
            ))}
          </div>

          {/* right panel — detail */}
          {selected && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* document header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a1a18', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#e8e6e0', marginBottom: 4 }}>
                      {typeof data.competitor_name === 'string' ? data.competitor_name : selected.filename}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {typeof data.report_period === 'string' && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#555550' }}>{data.report_period}</span>}
                      {typeof data.report_type === 'string' && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440' }}>{data.report_type}</span>}
                      {typeof data.report_currency === 'string' && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440' }}>{data.report_currency}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {typeof data.confidence === 'string' && (
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 2, background: '#1a1608', color: '#c8a96e', border: '1px solid #3a3020' }}>
                        {data.confidence}
                      </span>
                    )}

                    <a
                      href={`data:application/json,${encodeURIComponent(JSON.stringify(data, null, 2))}`}
                      download={selected.filename}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', letterSpacing: '0.08em', textDecoration: 'none', padding: '2px 8px', border: '1px solid #1a1a18', borderRadius: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#888880')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#444440')}
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>

              {/* tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #1a1a18', flexShrink: 0 }}>
                {tabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '10px 20px', background: 'none', border: 'none',
                      borderBottom: `2px solid ${activeTab === tab ? '#c8a96e' : 'transparent'}`,
                      color: activeTab === tab ? '#e8e6e0' : '#444440',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer',
                      transition: 'all 0.15s', marginBottom: -1,
                    }}
                  >
                    {tabLabels[tab]}
                  </button>
                ))}
              </div>

              {/* tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

                {activeTab === 'fields' && (
                  <div>
                    {simpleFields.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                        {simpleFields.map(([k, v]) => (
                          <div key={k}>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#444440', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                              {k.replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: 13, color: '#e8e6e0' }}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {evidencedFields.length > 0 && (
                      <>
                        <div style={{ ...sectionLabel, marginBottom: 12 }}>Numeric Fields</div>
                        {evidencedFields.map(([k, v]) => <FieldValue key={k} name={k} value={v} />)}
                      </>
                    )}

                    {listFields.filter(([k]) => k !== 'regional_signals').length > 0 && (
                      <>
                        <div style={{ height: 1, background: '#1a1a18', margin: '16px 0' }} />
                        {listFields.filter(([k]) => k !== 'regional_signals').map(([k, v]) => <FieldValue key={k} name={k} value={v} />)}
                      </>
                    )}

                    {metaFields.length > 0 && (
                      <>
                        <div style={{ height: 1, background: '#1a1a18', margin: '16px 0' }} />
                        <div style={{ ...sectionLabel, marginBottom: 12 }}>Metadata</div>
                        {metaFields.map(([k, v]) => <FieldValue key={k} name={k} value={v} />)}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'signals' && (
                  <div>
                    {(data.regional_signals as Record<string, unknown>[] || []).length === 0 ? (
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440' }}>No regional signals extracted.</div>
                    ) : (
                      (data.regional_signals as Record<string, unknown>[]).map((s, i) => (
                        <div key={i} style={{ borderBottom: '1px solid #1a1a18', paddingBottom: 16, marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#b8b6b0' }}>{typeof s.region === 'string' ? s.region : ''}</div>
                            <SignalBadge signal={typeof s.signal === 'string' ? s.signal : 'neutral'} />
                          </div>
                          {typeof s.evidence === 'string' && (
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#555550', letterSpacing: '0.03em', lineHeight: 1.6 }}>
                              {s.evidence}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'raw' && (
                  <pre style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888880', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(data, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}