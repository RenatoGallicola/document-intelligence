import { useState, useEffect } from 'react'
import axios from 'axios'
import JSZip from 'jszip'
import { useTheme } from '../theme/useTheme'
import { font, fontSize, fontWeight, letterSpacing, radius, transitions } from '../theme/tokens'
import { topbarStyle, fieldLabel, statusBadge, navRowStyle, modalOverlayStyle, modalCardStyle } from '../theme/styles'

interface OutputFile {
  filename: string
  path: string
  data: Record<string, unknown>
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

type FieldCategory = 'simple' | 'evidenced' | 'list'

function categorize(key: string, value: unknown): FieldCategory | null {
  if (value === null || value === undefined) return null
  if (isEvidencedValue(value)) return 'evidenced'
  if (isListOfDicts(value)) return 'list'
  if (isSimple(value)) return 'simple'
  return null
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// --- sub-components ---

function ExpandableRow({ item }: { item: Record<string, unknown> }) {
  const { theme } = useTheme()
  const { colors } = theme
  const [open, setOpen] = useState(false)
  const title = Object.values(item).find(v => typeof v === 'string') as string || 'Item'

  return (
    <div style={{ border: `1px solid ${colors.border.default}`, borderRadius: radius.md, marginBottom: 6, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: colors.bg.raised, border: 'none', cursor: 'pointer', color: colors.text.readable, fontFamily: font.sans, fontSize: fontSize.base, textAlign: 'left' }}
      >
        {title}
        <span style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.secondary, transform: open ? 'rotate(180deg)' : 'none', transition: transitions.allSlow, display: 'inline-block' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: 12, background: colors.bg.surface, borderTop: `1px solid ${colors.border.default}` }}>
          {Object.entries(item).map(([k, v]) => {
            if (v === null || v === undefined) return null
            const label = formatLabel(k)

            // evidenced value inside item
            if (isEvidencedValue(v)) {
              if (v.value === null) return null
              return (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={fieldLabel(theme)}>{label}</div>
                  <div style={{ fontSize: fontSize.md, color: colors.text.primary }}>{String(v.value)}</div>
                  {v.evidence && <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 }}>{v.evidence}</div>}
                </div>
              )
            }

            return (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={fieldLabel(theme)}>{label}</div>
                <div style={{ fontSize: fontSize.base, color: colors.text.tertiary, lineHeight: 1.5 }}>{String(v)}</div>
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

function groupOutputs(items: OutputFile[]): [string, OutputFile[]][] {
  return Object.entries(
    items.reduce((acc: Record<string, OutputFile[]>, o) => {
      const type =
        typeof o.data?.document_type === 'string' && o.data.document_type
          ? o.data.document_type
          : 'unknown'

      if (!acc[type]) acc[type] = []
      acc[type].push(o)
      return acc
    }, {})
  )
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
  const { theme } = useTheme()
  const stroke = theme.colors.status.error.text
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18" stroke={stroke} strokeWidth="1.5" />
      <path d="M8 6V4h8v2" stroke={stroke} strokeWidth="1.5" />
      <path d="M6 6l1 16h10l1-16" stroke={stroke} strokeWidth="1.5" />
    </svg>
  )
}

// --- main component ---

export default function OutputExplorer() {
  const { theme } = useTheme()
  const { colors } = theme
  const [outputs, setOutputs] = useState<OutputFile[]>([])
  const [selected, setSelected] = useState<OutputFile | null>(null)
  const [activeTab, setActiveTab] = useState<'fields' | 'lists' | 'raw'>('fields')
  const [loadingList, setLoadingList] = useState(true)
  const [groupByType, setGroupByType] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [userSelected, setUserSelected] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [hoverAction, setHoverAction] = useState<'cancel' | 'delete' | null>(null)
  const [zipping, setZipping] = useState(false)

  const visibleOutputs = outputs.filter(o =>
    matchesSearch(o, search)
  )

  const visibleGroups = groupOutputs(visibleOutputs)

  // flattened order actually visible on screen — respects group order and
  // collapsed groups when GROUP is active, so arrow-key nav matches what's rendered
  const navOrder = groupByType
    ? visibleGroups.flatMap(([type, items]) => (openGroups[type] ?? true) ? items : [])
    : visibleOutputs

  async function handleDownloadAll() {
    setZipping(true)
    try {
      const zip = new JSZip()
      for (const o of outputs) {
        zip.file(o.filename, JSON.stringify(o.data, null, 2))
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `outputs_${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setZipping(false)
    }
  }

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
      if (navOrder.length === 0) return

      const currentIndex = navOrder.findIndex(
        o => o.filename === selected?.filename
      )

      if (currentIndex === -1) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()

        const nextIndex = Math.min(currentIndex + 1, navOrder.length - 1)
        const nextDoc = navOrder[nextIndex]

        if (nextDoc) {
          setSelected(nextDoc)
          setActiveTab('fields')
        }
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()

        const prevIndex = Math.max(currentIndex - 1, 0)
        const prevDoc = navOrder[prevIndex]

        if (prevDoc) {
          setSelected(prevDoc)
          setActiveTab('fields')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navOrder, selected])

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

  for (const [k, v] of Object.entries(data)) {
    if (k === 'document_type' || k === 'confidence') continue
    const cat = categorize(k, v)
    if (cat === 'simple') simple.push([k, v])
    else if (cat === 'evidenced') evidenced.push([k, v])
    else if (cat === 'list') lists.push([k, v])
  }

  const tabs = [
    { id: 'fields' as const, label: 'Fields', show: simple.length > 0 || evidenced.length > 0 },
    { id: 'lists' as const, label: 'Lists', show: lists.length > 0 },
    { id: 'raw' as const, label: 'Raw JSON', show: true },
  ].filter(t => t.show)

  return (
    <>
      <div style={topbarStyle(theme)}>
        <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text.primary }}>Output Explorer</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {outputs.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={zipping}
              style={{
                fontSize: fontSize.xs,
                fontFamily: font.mono,
                letterSpacing: letterSpacing.wide3,
                textTransform: 'uppercase',
                background: 'none',
                border: `1px solid ${colors.border.default}`,
                color: zipping ? colors.text.quaternary : colors.text.secondary,
                padding: '3px 10px',
                borderRadius: radius.sm,
                cursor: zipping ? 'not-allowed' : 'pointer',
                transition: transitions.colorFast,
              }}
              onMouseEnter={e => { if (!zipping) (e.currentTarget as HTMLElement).style.color = colors.text.readable }}
              onMouseLeave={e => { if (!zipping) (e.currentTarget as HTMLElement).style.color = colors.text.secondary }}
            >
              {zipping ? 'Zipping...' : 'Download all'}
            </button>
          )}
          <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.muted, letterSpacing: letterSpacing.wide1 }}>
            {outputs.length} document{outputs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {loadingList ? (
        <div style={{ padding: 28, fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.secondary }}>Loading...</div>
      ) : outputs.length === 0 ? (
        <div style={{ padding: 28, fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.secondary }}>No outputs found. Process some documents first.</div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* left panel */}
          <div style={{ width: 240, minWidth: 240, borderRight: `1px solid ${colors.border.default}`, overflowY: 'auto' }}>

            <div style={{
              padding: '12px 12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderBottom: `1px solid ${colors.border.default}`
            }}>
              {/* SEARCH INPUT */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                style={{
                  background: colors.bg.surface,
                  border: `1px solid ${colors.border.default}`,
                  color: colors.text.primary,
                  fontSize: fontSize.sm,
                  padding: '4px 8px',
                  outline: 'none',
                  fontFamily: font.sans
                }}
              />

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: font.mono,
                fontSize: fontSize.sm,
                color: colors.text.muted,
                letterSpacing: letterSpacing.wide5,
                textTransform: 'uppercase'
              }}>
                <div>
                  Documents
                </div>

                <button
                  onClick={() => setGroupByType(v => !v)}
                  style={{
                    fontSize: fontSize.xs,
                    fontFamily: font.mono,
                    background: 'none',
                    border: `1px solid ${colors.border.default}`,
                    color: groupByType ? colors.accent.default : colors.text.secondary,
                    padding: '2px 8px',
                    borderRadius: radius.sm,
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
              const row = navRowStyle(theme, isActive)

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
                    background: row.background,
                    border: 'none',
                    borderLeft: row.borderLeft,
                    cursor: 'pointer',
                    textAlign: 'left',
                    position: 'relative'
                  }}
                >
                  <div style={{ fontSize: fontSize.sm, color: isActive ? colors.text.primary : colors.text.inactive, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </div>

                  <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inferDocumentType(o.data)}
                  </div>

                  <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatFilename(o.filename)}
                  </div>
                </button>
              )
            })}

            {/* GROUP MODE */}
            {groupByType && visibleGroups.map(([type, items]) => {

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
                      fontFamily: font.mono,
                      fontSize: fontSize.sm,
                      color: colors.accent.default,
                      letterSpacing: letterSpacing.wide5,
                      textTransform: 'uppercase',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{formatDocumentType(type)}</span>

                    <span style={{ color: colors.text.secondary }}>
                      {items.length}
                    </span>
                  </button>

                  {/* ITEMS */}
                  {isOpen && items.map(o => {
                    const isActive = selected?.filename === o.filename
                    const row = navRowStyle(theme, isActive)

                    return (
                      <button
                        key={o.filename}
                        onClick={() => { setSelected(o); setActiveTab('fields') }}
                        style={{
                          width: '100%',
                          display: 'block',
                          padding: '10px 16px',
                          background: row.background,
                          border: 'none',
                          borderLeft: row.borderLeft,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{
                          fontSize: fontSize.sm,
                          color: isActive ? colors.text.primary : colors.text.inactive,
                          marginBottom: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {inferTitle(o.data, o.filename)}
                        </div>

                        <div style={{
                          fontFamily: font.mono,
                          fontSize: fontSize.sm,
                          color: colors.text.quaternary,
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
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${colors.border.default}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.accent.default, marginBottom: 8 }}>
                      {inferDocumentType(data)}
                    </div>
                    <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: colors.text.primary, marginBottom: 6 }}>
                      {inferTitle(data, selected.filename)}
                    </div>
                    {extractTimestamp(selected.filename) && (
                      <div style={{
                        fontFamily: font.mono,
                        fontSize: fontSize.sm,
                        color: colors.text.secondary,
                        marginBottom: 8
                      }}>
                        {extractTimestamp(selected.filename)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {data.confidence !== undefined && data.confidence !== null && (
                      <span
                        title="Confidence"
                        style={{ ...statusBadge(theme, 'warning'), fontFamily: font.mono, fontSize: fontSize.sm, letterSpacing: letterSpacing.wide3, padding: '2px 8px', borderRadius: radius.sm, cursor: 'default' }}
                      >
                        {String(data.confidence)}
                      </span>
                    )}
                    <a
                      href={`data:application/json,${encodeURIComponent(JSON.stringify(data, null, 2))}`}
                      download={selected.filename}
                      style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.secondary, letterSpacing: letterSpacing.wide3, textDecoration: 'none', padding: '2px 8px', border: `1px solid ${colors.border.default}`, borderRadius: radius.sm } as React.CSSProperties}
                      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.color = colors.text.readable }}
                      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.color = colors.text.secondary }}
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
                        border: `1px solid ${colors.status.error.border}`,
                        color: colors.status.error.text,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        fontFamily: font.mono,
                        fontSize: fontSize.sm,
                        opacity: 0.6,
                        transition: transitions.opacityBase
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>

              {/* tabs */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border.default}`, flexShrink: 0 }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '10px 20px', background: 'none', border: 'none',
                      borderBottom: `2px solid ${activeTab === tab.id ? colors.accent.default : 'transparent'}`,
                      color: activeTab === tab.id ? colors.text.primary : colors.text.secondary,
                      fontFamily: font.sans, fontSize: fontSize.base, cursor: 'pointer',
                      transition: transitions.allBase, marginBottom: -1,
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
                            <div style={fieldLabel(theme)}>{formatLabel(k)}</div>
                            <div style={{ fontSize: fontSize.md, color: colors.text.primary }}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* evidenced fields */}
                    {evidenced.length > 0 && (
                      <>
                        {simple.length > 0 && <div style={{ height: 1, background: colors.border.default, margin: '4px 0 20px' }} />}
                        {evidenced.map(([k, v]) => {
                          const ev = v as { value: number | null; evidence: string | null }
                          if (ev.value === null) return null
                          return (
                            <div key={k} style={{ marginBottom: 14 }}>
                              <div style={fieldLabel(theme)}>{formatLabel(k)}</div>
                              <div style={{ fontSize: fontSize.md, color: colors.text.primary, marginBottom: 2 }}>{String(ev.value)}</div>
                              {ev.evidence && (
                                <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.muted, lineHeight: 1.5 }}>
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
                        <div style={{ ...fieldLabel(theme), marginBottom: 10 }}>{formatLabel(k)}</div>
                        {(v as Record<string, unknown>[]).map((item, i) => (
                          <ExpandableRow key={i} item={item} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'raw' && (
                  <pre style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.readable, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(data, null, 2)}
                  </pre>
                )}

              </div>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <div style={modalOverlayStyle(theme)}>
          <div
            style={{
              ...modalCardStyle(theme),
              padding: 20,
              width: 320
            }}
          >
            <div style={{ fontSize: fontSize.md, color: colors.text.primary, marginBottom: 10 }}>
              Delete document?
            </div>

            <div style={{ fontSize: fontSize.sm, color: colors.text.inactive, marginBottom: 20 }}>
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
                  background: hoverAction === 'cancel' ? colors.border.default : 'none',
                  border: `1px solid ${colors.border.default}`,
                  color: hoverAction === 'cancel' ? colors.text.primary : colors.text.inactive,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  transition: transitions.allBase
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
                  background: hoverAction === 'delete' ? colors.status.error.bgHover : colors.status.error.bg,
                  border: `1px solid ${colors.status.error.border}`,
                  color: colors.status.error.text,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  transition: transitions.allBase
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
