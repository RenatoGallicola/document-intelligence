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

const monoLabel: React.CSSProperties = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  color: '#444440',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 4,
}

// --- type guards ---

function isEvidencedValue(value: unknown): value is { value: number | null; evidence: string | null } {
  if (typeof value !== 'object' || value === null) return false
  const keys = Object.keys(value)
  return keys.length <= 2 && keys.every(k => ['value', 'evidence'].includes(k)) && 'value' in value
}

function isListOfDicts(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null
}

function isSimple(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

// --- field categorization ---

type FieldCategory = 'simple' | 'evidenced' | 'list' | 'meta'

const META_KEYS = new Set(['confidence', 'extraction_notes'])

function categorize(key: string, value: unknown): FieldCategory | null {
  if (value === null || value === undefined) return null
  if (META_KEYS.has(key)) return 'meta'
  if (isEvidencedValue(value)) return 'evidenced'
  if (isListOfDicts(value)) return 'list'
  if (isSimple(value)) return 'simple'
  return null
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// --- sub-components ---

function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    positive: { bg: '#0d1f12', color: '#4a7c59', border: '#1a3020' },
    negative: { bg: '#1a0d0d', color: '#c85050', border: '#3a1a1a' },
    neutral: { bg: '#1a1608', color: '#c8a96e', border: '#3a3020' },
  }
  const s = map[signal] || map.neutral
  return (
    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 2, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {signal}
    </span>
  )
}

function ExpandableRow({ item }: { item: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const title = Object.values(item).find(v => typeof v === 'string') as string || 'Item'

  return (
    <div style={{ border: '1px solid #1a1a18', borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#111110', border: 'none', cursor: 'pointer', color: '#888880', fontFamily: 'DM Sans, sans-serif', fontSize: 12, textAlign: 'left' }}
      >
        {title}
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: 12, background: '#0d0d0b', borderTop: '1px solid #1a1a18' }}>
          {Object.entries(item).map(([k, v]) => {
            if (v === null || v === undefined) return null
            const label = formatLabel(k)

            // signal field — render badge
            if (k === 'signal' && typeof v === 'string') {
              return (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={monoLabel}>{label}</div>
                  <SignalBadge signal={v} />
                </div>
              )
            }

            // evidenced value inside item
            if (isEvidencedValue(v)) {
              if (v.value === null) return null
              return (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={monoLabel}>{label}</div>
                  <div style={{ fontSize: 13, color: '#e8e6e0' }}>{String(v.value)}</div>
                  {v.evidence && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3a3a36', marginTop: 2 }}>{v.evidence}</div>}
                </div>
              )
            }

            return (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={monoLabel}>{label}</div>
                <div style={{ fontSize: 12, color: '#b8b6b0', lineHeight: 1.5 }}>{String(v)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- document title inference ---
// tries common identifier fields in order; falls back to filename

const TITLE_KEYS = ['competitor_name', 'company_name', 'title', 'name', 'document_title', 'issuer']

function inferTitle(data: Record<string, unknown>, fallback: string): string {
  for (const k of TITLE_KEYS) {
    if (typeof data[k] === 'string' && data[k]) return data[k] as string
  }
  return fallback
}

function formatDocumentType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function inferDocumentType(data: Record<string, unknown>): string {
  const docType = data.document_type

  if (typeof docType === 'string' && docType) {
    return formatDocumentType(docType)
  }

  return 'Unknown document type'
}

// --- filename formatting ---

function formatFilename(filename: string): string {
  return filename
    .replace(/_\d{8}_\d{6}/, '')
    .replace(/\.json$/, '')
}

function extractTimestamp(filename: string): string | null {
  const match = filename.match(/(\d{8}_\d{6})/)
  if (!match) return null

  const raw = match[1]
  const formatted = raw.replace(
    /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,
    '$1-$2-$3 $4:$5:$6'
  )

  return formatted
}

// --- icons ---

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18"
        stroke="#c85050"
        strokeWidth="1.5"
      />
      <path
        d="M8 6V4h8v2"
        stroke="#c85050"
        strokeWidth="1.5"
      />
      <path
        d="M6 6l1 16h10l1-16"
        stroke="#c85050"
        strokeWidth="1.5"
      />
    </svg>
  )
}

// --- main component ---

export default function OutputExplorer() {
  const [outputs, setOutputs] = useState<OutputFile[]>([])
  const [selected, setSelected] = useState<OutputFile | null>(null)
  const [activeTab, setActiveTab] = useState<'fields' | 'lists' | 'meta' | 'raw'>('fields')
  const [loadingList, setLoadingList] = useState(true)
  const [groupByType, setGroupByType] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [userSelected, setUserSelected] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [hoverAction, setHoverAction] = useState<'cancel' | 'delete' | null>(null)
  
  const visibleOutputs = outputs.filter(o =>
    matchesSearch(o, search)
  )

  async function handleDelete(filename: string) {
    await axios.delete(`/api/documents/outputs/${encodeURIComponent(filename)}`)

    setOutputs(prev => prev.filter(o => o.filename !== filename))

    if (selected?.filename === filename) {
      const remaining = outputs.filter(o => o.filename !== filename)
      setSelected(remaining[0] || null)
    }
  }

  function toggleGroup(type: string) {
    setOpenGroups(prev => ({
      ...prev,
      [type]: !(prev[type] ?? true)
    }))
  }

  function matchesSearch(o: OutputFile, search: string) {
    if (!search.trim()) return true

    const s = search.toLowerCase()

    const title = inferTitle(o.data, o.filename).toLowerCase()
    const filename = o.filename.toLowerCase()
    const type = (o.data?.document_type as string || '').toLowerCase()

    return (
      title.includes(s) ||
      filename.includes(s) ||
      type.includes(s)
    )
  }

  useEffect(() => {
    axios.get('/api/documents/outputs').then(res => {
      setOutputs(res.data)
      if (res.data.length > 0) setSelected(res.data[0])
      setLoadingList(false)
    })
  }, [])

  useEffect(() => {
    if (!groupByType) return

    const grouped: Record<string, boolean> = {}

    for (const o of outputs) {
      const type =
        typeof o.data?.document_type === 'string' && o.data.document_type
          ? o.data.document_type
          : 'unknown'

      grouped[type] = true
    }

    setOpenGroups(grouped)
  }, [groupByType, outputs])

  useEffect(() => {
    if (!search.trim()) return
    if (userSelected) return

    const filtered = outputs.filter(o => matchesSearch(o, search))
    if (filtered.length === 0) return

    const first = filtered[0]

    if (selected?.filename === first.filename) return

    setSelected(first)
    setActiveTab('fields')
  }, [search, outputs])

  useEffect(() => {
    setUserSelected(false)
  }, [search])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (visibleOutputs.length === 0) return

      const currentIndex = visibleOutputs.findIndex(
        o => o.filename === selected?.filename
      )

      if (currentIndex === -1) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()

        const nextIndex = Math.min(currentIndex + 1, visibleOutputs.length - 1)
        const nextDoc = visibleOutputs[nextIndex]

        if (nextDoc) {
          setSelected(nextDoc)
          setActiveTab('fields')
        }
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()

        const prevIndex = Math.max(currentIndex - 1, 0)
        const prevDoc = visibleOutputs[prevIndex]

        if (prevDoc) {
          setSelected(prevDoc)
          setActiveTab('fields')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visibleOutputs, selected])

  useEffect(() => {
    if (deleteTarget) {
      setHoverAction(null)
    }
  }, [deleteTarget])

  const data = selected?.data || {}

  // categorize all fields dynamically
  const simple: [string, unknown][] = []
  const evidenced: [string, unknown][] = []
  const lists: [string, unknown][] = []
  const meta: [string, unknown][] = []

  for (const [k, v] of Object.entries(data)) {
    if (k === 'document_type') continue
    const cat = categorize(k, v)
    if (cat === 'simple') simple.push([k, v])
    else if (cat === 'evidenced') evidenced.push([k, v])
    else if (cat === 'list') lists.push([k, v])
    else if (cat === 'meta') meta.push([k, v])
  }

  const tabs = [
    { id: 'fields' as const, label: 'Fields', show: simple.length > 0 || evidenced.length > 0 },
    { id: 'lists' as const, label: 'Lists', show: lists.length > 0 },
    { id: 'meta' as const, label: 'Metadata', show: meta.length > 0 },
    { id: 'raw' as const, label: 'Raw JSON', show: true },
  ].filter(t => t.show)

  return (
    <>
      <div style={topbarStyle}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e6e0' }}>Output Explorer</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3a3a36', letterSpacing: '0.05em' }}>
          {outputs.length} document{outputs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loadingList ? (
        <div style={{ padding: 28, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440' }}>Loading...</div>
      ) : outputs.length === 0 ? (
        <div style={{ padding: 28, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440' }}>No outputs found. Process some documents first.</div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* left panel */}
          <div style={{ width: 240, minWidth: 240, borderRight: '1px solid #1a1a18', overflowY: 'auto' }}>
            
            <div style={{
              padding: '12px 12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderBottom: '1px solid #1a1a18'
            }}>
              {/* SEARCH INPUT */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                style={{
                  background: '#0d0d0b',
                  border: '1px solid #1a1a18',
                  color: '#e8e6e0',
                  fontSize: 11,
                  padding: '4px 8px',
                  outline: 'none',
                  fontFamily: 'DM Sans, sans-serif'
                }}
              />

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'DM Mono, monospace',
                fontSize: 11,
                color: '#3a3a36',
                letterSpacing: '0.12em',
                textTransform: 'uppercase'
              }}>
                <div>
                  Documents
                </div>

                <button
                  onClick={() => setGroupByType(v => !v)}
                  style={{
                    fontSize: 10,
                    fontFamily: 'DM Mono, monospace',
                    background: 'none',
                    border: '1px solid #1a1a18',
                    color: groupByType ? '#c8a96e' : '#444440',
                    padding: '2px 8px',
                    borderRadius: 2,
                    cursor: 'pointer'
                  }}
                >
                  GROUP
                </button>
              </div>


            </div>

            {/* DEFAULT MODE */}
            {!groupByType && outputs.filter(o => matchesSearch(o, search)).map(o => {
              const isActive = selected?.filename === o.filename
              const title = inferTitle(o.data, o.filename)

              return (
                <button
                  key={o.filename}
                  onClick={() => {
                    setSelected(o)
                    setActiveTab('fields')
                    setUserSelected(true)
                  }}
                  style={{
                    width: '100%',
                    display: 'block',
                    padding: '10px 16px',
                    background: isActive ? '#161614' : 'transparent',
                    border: 'none',
                    borderLeft: `2px solid ${isActive ? '#c8a96e' : 'transparent'}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    position: 'relative' 
                  }}
                >
                  <div style={{ fontSize: 11, color: isActive ? '#e8e6e0' : '#666660', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </div>

                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#333330', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inferDocumentType(o.data)}
                  </div>

                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#333330', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatFilename(o.filename)}
                  </div>
                </button>
              )
            })}

            {/* GROUP MODE */}
            {groupByType && Object.entries(
              outputs.filter(o => matchesSearch(o, search)).reduce((acc: Record<string, OutputFile[]>, o) => {
                const type =
                  typeof o.data?.document_type === 'string' && o.data.document_type
                    ? o.data.document_type
                    : 'unknown'

                if (!acc[type]) acc[type] = []
                acc[type].push(o)
                return acc
              }, {})
            ).map(([type, items]) => {

              const isOpen = openGroups[type]

              return (
                <div key={type}>
                  
                  {/* GROUP HEADER */}
                  <button
                    onClick={() => toggleGroup(type)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 16px 6px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 11,
                      color: '#c8a96e',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{formatDocumentType(type)}</span>

                    <span style={{ color: '#444440' }}>
                      {items.length}
                    </span>
                  </button>

                  {/* ITEMS */}
                  {isOpen && items.map(o => {
                    const isActive = selected?.filename === o.filename

                    return (
                      <button
                        key={o.filename}
                        onClick={() => { setSelected(o); setActiveTab('fields') }}
                        style={{
                          width: '100%',
                          display: 'block',
                          padding: '10px 16px',
                          background: isActive ? '#161614' : 'transparent',
                          border: 'none',
                          borderLeft: `2px solid ${isActive ? '#c8a96e' : 'transparent'}`,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{
                          fontSize: 11,
                          color: isActive ? '#e8e6e0' : '#666660',
                          marginBottom: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {inferTitle(o.data, o.filename)}
                        </div>

                        <div style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: 11,
                          color: '#333330',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {formatFilename(o.filename)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )

            })}
          </div>

          {/* right panel */}
          {selected && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* document header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a1a18', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c8a96e', marginBottom: 8 }}>
                      {inferDocumentType(data)}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#e8e6e0', marginBottom: 6 }}>
                      {inferTitle(data, selected.filename)}
                    </div>
                    {extractTimestamp(selected.filename) && (
                      <div style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 11,
                        color: '#444440',
                        marginBottom: 8
                      }}>
                        {extractTimestamp(selected.filename)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {data.confidence !== undefined && data.confidence !== null && (
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 2, background: '#1a1608', color: '#c8a96e', border: '1px solid #3a3020' }}>
                        {String(data.confidence)}
                      </span>
                    )}
                    <a
                      href={`data:application/json,${encodeURIComponent(JSON.stringify(data, null, 2))}`}
                      download={selected.filename}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440', letterSpacing: '0.08em', textDecoration: 'none', padding: '2px 8px', border: '1px solid #1a1a18', borderRadius: 2 } as React.CSSProperties}
                      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.color = '#888880' }}
                      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.color = '#444440' }}
                    >
                      Download
                    </a>
                    <button
                      onClick={() => setDeleteTarget(selected.filename)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.opacity = '1'
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.opacity = '0.6'
                      }}
                      style={{
                        background: 'none',
                        border: '1px solid #3a1a1a',
                        color: '#c85050',
                        padding: '2px 8px',
                        cursor: 'pointer',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 11,
                        opacity: 0.6,
                        transition: 'opacity 0.15s ease'
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>

              {/* tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #1a1a18', flexShrink: 0 }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '10px 20px', background: 'none', border: 'none',
                      borderBottom: `2px solid ${activeTab === tab.id ? '#c8a96e' : 'transparent'}`,
                      color: activeTab === tab.id ? '#e8e6e0' : '#444440',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer',
                      transition: 'all 0.15s', marginBottom: -1,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

                {activeTab === 'fields' && (
                  <div>
                    {/* simple fields as grid */}
                    {simple.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                        {simple.map(([k, v]) => (
                          <div key={k}>
                            <div style={monoLabel}>{formatLabel(k)}</div>
                            <div style={{ fontSize: 13, color: '#e8e6e0' }}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* evidenced fields */}
                    {evidenced.length > 0 && (
                      <>
                        {simple.length > 0 && <div style={{ height: 1, background: '#1a1a18', margin: '4px 0 20px' }} />}
                        {evidenced.map(([k, v]) => {
                          const ev = v as { value: number | null; evidence: string | null }
                          if (ev.value === null) return null
                          return (
                            <div key={k} style={{ marginBottom: 14 }}>
                              <div style={monoLabel}>{formatLabel(k)}</div>
                              <div style={{ fontSize: 13, color: '#e8e6e0', marginBottom: 2 }}>{String(ev.value)}</div>
                              {ev.evidence && (
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3a3a36', lineHeight: 1.5 }}>
                                  {ev.evidence}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'lists' && (
                  <div>
                    {lists.map(([k, v]) => (
                      <div key={k} style={{ marginBottom: 24 }}>
                        <div style={{ ...monoLabel, marginBottom: 10 }}>{formatLabel(k)}</div>
                        {(v as Record<string, unknown>[]).map((item, i) => (
                          <ExpandableRow key={i} item={item} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'meta' && (
                  <div>
                    {meta.map(([k, v]) => (
                      <div key={k} style={{ marginBottom: 16 }}>
                        <div style={monoLabel}>{formatLabel(k)}</div>
                        <div style={{ fontSize: 13, color: '#b8b6b0', lineHeight: 1.6 }}>{String(v)}</div>
                      </div>
                    ))}
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

      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            style={{
              background: '#0d0d0b',
              border: '1px solid #1a1a18',
              padding: 20,
              width: 320
            }}
          >
            <div style={{ fontSize: 13, color: '#e8e6e0', marginBottom: 10 }}>
              Delete document?
            </div>

            <div style={{ fontSize: 11, color: '#666660', marginBottom: 20 }}>
              {deleteTarget}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onMouseEnter={() => setHoverAction('cancel')}
                onMouseLeave={() => setHoverAction(null)}
                onClick={() => {
                  setDeleteTarget(null)
                  setHoverAction(null)
                }}
                style={{
                  background: hoverAction === 'cancel' ? '#1a1a18' : 'none',
                  border: '1px solid #1a1a18',
                  color: hoverAction === 'cancel' ? '#e8e6e0' : '#666660',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Cancel
              </button>

              <button
                onMouseEnter={() => setHoverAction('delete')}
                onMouseLeave={() => setHoverAction(null)}
                onClick={() => {
                  handleDelete(deleteTarget)
                  setDeleteTarget(null)
                  setHoverAction(null)
                }}
                style={{
                  background: hoverAction === 'delete' ? '#3a1a1a' : '#1a0d0d',
                  border: '1px solid #3a1a1a',
                  color: '#c85050',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}