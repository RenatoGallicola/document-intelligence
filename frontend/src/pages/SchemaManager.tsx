import { useState, useEffect } from 'react'
import axios from 'axios'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldType = 'str' | 'float' | 'int' | 'bool' | 'EvidencedValue' | 'EvidencedStr' | 'list[str]' | 'nested'

interface SubField {
  id: string
  name: string
  type: FieldType
  description: string
}

interface FormField {
  id: string
  name: string
  type: FieldType
  description: string
  is_list: boolean
  fields: SubField[]
}

interface SchemaItem {
  id: string
  class_name: string
  field_count: number
  is_managed: boolean
  fields: Array<{ name: string; type: string; description: string; required: boolean }>
  managed_fields?: FormField[]
  display_name?: string
}

type Mode = 'empty' | 'view' | 'create' | 'edit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSnakeCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')
}

function toPascalCase(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

function toDisplayName(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

const FIELD_TYPES: FieldType[] = ['str', 'float', 'int', 'bool', 'EvidencedValue', 'EvidencedStr', 'list[str]', 'nested']

const TYPE_LABELS: Record<FieldType, string> = {
  str: 'Text',
  float: 'Decimal',
  int: 'Integer',
  bool: 'Boolean',
  EvidencedValue: 'Evidenced number',
  EvidencedStr: 'Evidenced text',
  'list[str]': 'List of text',
  nested: 'Nested object',
}

// ---------------------------------------------------------------------------
// Code preview generation (mirrors backend logic)
// ---------------------------------------------------------------------------

function previewFieldLine(name: string, type: FieldType, description: string, is_list: boolean): string {
  let ann: string, def_: string
  if (type === 'str') { ann = 'Optional[str]'; def_ = 'Field(None' }
  else if (type === 'float') { ann = 'Optional[float]'; def_ = 'Field(None' }
  else if (type === 'int') { ann = 'Optional[int]'; def_ = 'Field(None' }
  else if (type === 'bool') { ann = 'Optional[bool]'; def_ = 'Field(None' }
  else if (type === 'EvidencedValue') { ann = 'Optional[EvidencedValue]'; def_ = 'Field(None' }
  else if (type === 'EvidencedStr') { ann = 'Optional[EvidencedStr]'; def_ = 'Field(None' }
  else if (type === 'list[str]') { ann = 'list[str]'; def_ = 'Field(default_factory=list' }
  else if (type === 'nested') {
    const cls = toPascalCase(name)
    ann = is_list ? `list[${cls}]` : `Optional[${cls}]`
    def_ = is_list ? 'Field(default_factory=list' : 'Field(None'
  } else { ann = 'Optional[str]'; def_ = 'Field(None' }

  const desc = description ? `, description="${description.replace(/"/g, '\\"')}"` : ''
  return `    ${name}: ${ann} = ${def_}${desc})`
}

function generatePreview(displayName: string, fields: FormField[]): string {
  const name = toSnakeCase(displayName) || 'my_schema'
  const className = toPascalCase(name) + 'Schema'

  const allTypes = new Set(fields.flatMap(f =>
    f.type === 'nested' ? f.fields.map(nf => nf.type) : [f.type]
  ))

  const lines: string[] = [
    'from pydantic import BaseModel, Field',
    'from typing import Optional',
    '',
  ]

  if (allTypes.has('EvidencedValue')) {
    lines.push(
      '',
      'class EvidencedValue(BaseModel):',
      '    value: Optional[float] = Field(None, description="Extracted numeric value")',
      '    evidence: Optional[str] = Field(None, description="Exact quote and location from the document")',
    )
  }
  if (allTypes.has('EvidencedStr')) {
    lines.push(
      '',
      'class EvidencedStr(BaseModel):',
      '    value: Optional[str] = Field(None, description="Extracted text value")',
      '    evidence: Optional[str] = Field(None, description="Exact quote and location from the document")',
    )
  }

  fields.forEach(f => {
    if (f.type === 'nested') {
      const cls = toPascalCase(f.name || 'item')
      lines.push('', `class ${cls}(BaseModel):`)
      if (!f.fields.length) { lines.push('    pass') }
      f.fields.forEach(nf => {
        lines.push(previewFieldLine(nf.name || 'field', nf.type, nf.description, true))
      })
    }
  })

  lines.push('', `class ${className}(BaseModel):`)
  if (!fields.length) { lines.push('    pass') }
  fields.forEach(f => {
    lines.push(previewFieldLine(f.name || 'field', f.type, f.description, f.is_list))
  })

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const sectionLabel: React.CSSProperties = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  color: '#444440',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 10,
}

const inputStyle: React.CSSProperties = {
  background: '#0d0d0b',
  border: '1px solid #1e1e1c',
  borderRadius: 3,
  color: '#b8b6b0',
  fontFamily: 'DM Mono, monospace',
  fontSize: 12,
  padding: '7px 10px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: FormField
  onChange: (updated: FormField) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)

  const update = (patch: Partial<FormField>) => onChange({ ...field, ...patch })

  const addSubField = () => {
    update({ fields: [...field.fields, { id: uid(), name: '', type: 'str', description: '' }] })
  }

  const updateSubField = (idx: number, patch: Partial<SubField>) => {
    const updated = [...field.fields]
    updated[idx] = { ...updated[idx], ...patch }
    update({ fields: updated })
  }

  const removeSubField = (idx: number) => {
    update({ fields: field.fields.filter((_, i) => i !== idx) })
  }

  return (
    <div
      style={{ border: '1px solid #1a1a18', borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: '#0d0d0b', alignItems: 'center' }}>
        {/* drag handle visual */}
        <div style={{ color: '#333330', cursor: 'default', userSelect: 'none', fontSize: 12, lineHeight: 1, paddingTop: 1 }}>⠿</div>

        {/* field name */}
        <input
          placeholder="field_name"
          value={field.name}
          onChange={e => update({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
          onBlur={e => update({ name: e.target.value.replace(/^_+|_+$/g, '') })}
          style={{ ...inputStyle, flex: 1.4, minWidth: 0 }}
        />

        {/* type */}
        <select
          value={field.type}
          onChange={e => update({ type: e.target.value as FieldType, fields: [] })}
          style={{ ...selectStyle, flex: 1, minWidth: 0 }}
        >
          {FIELD_TYPES.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        {/* description */}
        <input
          placeholder="Description for extraction prompt"
          value={field.description}
          onChange={e => update({ description: e.target.value })}
          style={{ ...inputStyle, flex: 2, minWidth: 0 }}
        />

        {/* nested toggle / list toggle */}
        {field.type === 'nested' && (
          <button
            onClick={() => setOpen(v => !v)}
            style={{ background: open ? '#161614' : 'none', border: '1px solid #1a1a18', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', color: '#888880', fontFamily: 'DM Mono, monospace', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {field.fields.length} fields {open ? '▲' : '▼'}
          </button>
        )}

        {/* remove */}
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: hover ? '#666660' : '#333330', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0, transition: 'color 0.15s' }}
        >
          ×
        </button>
      </div>

      {/* nested sub-fields */}
      {field.type === 'nested' && open && (
        <div style={{ padding: '8px 10px 10px 32px', background: '#111110', borderTop: '1px solid #1a1a18' }}>
          <div style={{ ...sectionLabel, marginBottom: 8 }}>Sub-fields of {toPascalCase(field.name || 'Item')}</div>
          {field.fields.map((nf, idx) => (
            <div key={nf.id} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input
                placeholder="field_name"
                value={nf.name}
                onChange={e => updateSubField(idx, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                onBlur={e => updateSubField(idx, { name: e.target.value.replace(/^_+|_+$/g, '') })}
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={nf.type}
                onChange={e => updateSubField(idx, { type: e.target.value as FieldType })}
                style={{ ...selectStyle, flex: 1 }}
              >
                {FIELD_TYPES.filter(t => t !== 'nested').map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <input
                placeholder="Description"
                value={nf.description}
                onChange={e => updateSubField(idx, { description: e.target.value })}
                style={{ ...inputStyle, flex: 2 }}
              />
              <button
                onClick={() => removeSubField(idx)}
                style={{ background: 'none', border: 'none', color: '#444440', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addSubField}
            style={{ background: 'none', border: '1px dashed #1a1a18', borderRadius: 2, padding: '5px 10px', color: '#444440', fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer', marginTop: 4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#888880'; (e.currentTarget as HTMLElement).style.borderColor = '#2a2a26' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#444440'; (e.currentTarget as HTMLElement).style.borderColor = '#1a1a18' }}
          >
            + Add sub-field
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SchemaManager() {
  const [schemas, setSchemas] = useState<SchemaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('empty')
  const [selected, setSelected] = useState<SchemaItem | null>(null)

  // form state
  const [displayName, setDisplayName] = useState('')
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const derivedName = toSnakeCase(displayName)
  const derivedClass = derivedName ? toPascalCase(derivedName) + 'Schema' : ''

  const loadSchemas = async () => {
    const res = await axios.get<SchemaItem[]>('/api/schemas')
    setSchemas(res.data)
    setLoading(false)
  }

  useEffect(() => { loadSchemas() }, [])

  const startCreate = () => {
    setMode('create')
    setSelected(null)
    setDisplayName('')
    setFormFields([])
    setError(null)
    setSaved(false)
    setPreviewOpen(false)
  }

  const openSchema = async (schema: SchemaItem) => {
    setError(null)
    setSaved(false)
    if (schema.is_managed) {
      const res = await axios.get<SchemaItem>(`/api/schemas/${schema.id}`)
      const detail = res.data
      setSelected(detail)
      setDisplayName(detail.display_name || toDisplayName(detail.id))
      // managed_fields come from registry — they match FormField shape
      const mf = (detail.managed_fields || []) as FormField[]
      setFormFields(mf.map(f => ({ ...f, id: uid(), fields: (f.fields || []).map(nf => ({ ...nf, id: uid() })) })))
      setMode('edit')
    } else {
      setSelected(schema)
      setMode('view')
    }
    setPreviewOpen(false)
  }

  const handleDelete = async (schemaId: string) => {
    setDeleting(true)
    try {
      await axios.delete(`/api/schemas/${schemaId}`)
      if (selected?.id === schemaId) {
        setMode('empty')
        setSelected(null)
      }
      await loadSchemas()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to delete schema.'
      setError(msg)
    }
    setDeleting(false)
    setDeleteTarget(null)
  }

  const addField = () => {
    setFormFields(prev => [...prev, { id: uid(), name: '', type: 'str', description: '', is_list: true, fields: [] }])
  }

  const updateField = (id: string, updated: FormField) => {
    setFormFields(prev => prev.map(f => f.id === id ? updated : f))
  }

  const removeField = (id: string) => {
    setFormFields(prev => prev.filter(f => f.id !== id))
  }

  const handleSave = async () => {
    if (!derivedName) { setError('Schema name is required.'); return }
    if (!derivedClass) { setError('Cannot derive class name.'); return }

    const payload = {
      name: derivedName,
      class_name: derivedClass,
      display_name: displayName,
      fields: formFields.map(f => ({
        name: f.name,
        type: f.type,
        description: f.description,
        is_list: f.is_list,
        fields: f.fields.map(nf => ({ name: nf.name, type: nf.type, description: nf.description })),
      })),
    }

    setSaving(true)
    setError(null)
    try {
      if (mode === 'create') {
        await axios.post('/api/schemas', payload)
      } else if (mode === 'edit' && selected) {
        await axios.put(`/api/schemas/${selected.id}`, payload)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await loadSchemas()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to save schema.'
      setError(msg)
    }
    setSaving(false)
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

  return (
    <>
      <div style={topbarStyle}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e6e0' }}>Schema Manager</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3a3a36', letterSpacing: '0.05em' }}>
          {schemas.length} schema{schemas.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ---------------------------------------------------------------- */}
        {/* Left panel — schema list                                          */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ width: 220, minWidth: 220, borderRight: '1px solid #1a1a18', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a18' }}>
            <button
              onClick={startCreate}
              style={{ width: '100%', background: '#c8a96e', color: '#0a0a0a', border: 'none', borderRadius: 3, padding: '7px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              + New schema
            </button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && (
              <div style={{ padding: '16px 16px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440' }}>Loading...</div>
            )}
            {!loading && schemas.length === 0 && (
              <div style={{ padding: '16px 16px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440' }}>No schemas found.</div>
            )}
            {schemas.map(s => {
              const isActive = (mode === 'view' || mode === 'edit') && selected?.id === s.id
              return (
                <div key={s.id} style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
                  <button
                    onClick={() => openSchema(s)}
                    style={{
                      flex: 1,
                      display: 'block',
                      padding: '10px 16px',
                      background: isActive ? '#161614' : 'transparent',
                      border: 'none',
                      borderLeft: `2px solid ${isActive ? '#c8a96e' : 'transparent'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.1s',
                      minWidth: 0,
                    }}
                    onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = '#0f0f0d' } }}
                    onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
                  >
                    <div style={{ fontSize: 12, color: isActive ? '#e8e6e0' : '#888880', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {toDisplayName(s.id)}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#333330' }}>
                        {s.field_count}f
                      </span>
                      {s.is_managed && (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#4a7c59', letterSpacing: '0.06em' }}>managed</span>
                      )}
                    </div>
                  </button>
                  {s.is_managed && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(s.id) }}
                      title="Delete schema"
                      style={{ background: 'none', border: 'none', padding: '0 10px', cursor: 'pointer', color: '#333330', transition: 'color 0.15s', flexShrink: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c85050' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#333330' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 6h18M8 6V4h8v2M6 6l1 16h10l1-16" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right panel                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ---- empty state ---- */}
          {mode === 'empty' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440', letterSpacing: '0.1em', marginBottom: 8 }}>
                  SELECT A SCHEMA OR CREATE A NEW ONE
                </div>
                <button
                  onClick={startCreate}
                  style={{ background: 'none', border: '1px solid #1a1a18', borderRadius: 3, padding: '7px 16px', color: '#666660', fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#b8b6b0'; (e.currentTarget as HTMLElement).style.borderColor = '#2a2a26' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#666660'; (e.currentTarget as HTMLElement).style.borderColor = '#1a1a18' }}
                >
                  + New schema
                </button>
              </div>
            </div>
          )}

          {/* ---- view mode (unmanaged schema) ---- */}
          {mode === 'view' && selected && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#e8e6e0', marginBottom: 4 }}>{toDisplayName(selected.id)}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440' }}>{selected.class_name}</div>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, padding: '3px 8px', borderRadius: 2, background: '#0d0d0b', border: '1px solid #1a1a18', color: '#444440' }}>
                  read-only
                </span>
              </div>

              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3a3a36', marginBottom: 20, padding: '10px 14px', background: '#0d0d0b', border: '1px solid #1a1a18', borderRadius: 3 }}>
                This schema is defined in Python. Edit <code style={{ color: '#888880' }}>schemas/{selected.id}.py</code> directly.
              </div>

              <div style={sectionLabel}>Fields — {selected.field_count}</div>
              {selected.fields.map(f => (
                <div key={f.name} style={{ display: 'flex', gap: 12, padding: '8px 12px', background: '#0d0d0b', border: '1px solid #1a1a18', borderRadius: 3, marginBottom: 4 }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#b8b6b0', minWidth: 160 }}>{f.name}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.type}</div>
                  {f.description && (
                    <div style={{ fontSize: 11, color: '#666660', flex: 2 }}>{f.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ---- create / edit mode ---- */}
          {(mode === 'create' || mode === 'edit') && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

              {/* Schema name */}
              <div style={{ marginBottom: 24 }}>
                <div style={sectionLabel}>{mode === 'create' ? 'New schema' : 'Edit schema'}</div>

                <div style={{ background: '#111110', border: '1px solid #1a1a18', borderRadius: 4, padding: 16 }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Display name
                  </div>
                  <input
                    placeholder="e.g. Market Report"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    disabled={mode === 'edit'}
                    style={{ ...inputStyle, marginBottom: 10, opacity: mode === 'edit' ? 0.5 : 1 }}
                  />
                  {derivedName && (
                    <div style={{ display: 'flex', gap: 16, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3a3a36' }}>
                      <span>id: <span style={{ color: '#888880' }}>{derivedName}</span></span>
                      <span>class: <span style={{ color: '#888880' }}>{derivedClass}</span></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fields */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={sectionLabel}>Fields — {formFields.length}</div>
                </div>

                {/* column headers */}
                {formFields.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, padding: '0 10px 6px 28px', fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#333330', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    <div style={{ flex: 1.4 }}>Name</div>
                    <div style={{ flex: 1 }}>Type</div>
                    <div style={{ flex: 2 }}>Description</div>
                    <div style={{ width: 60 }} />
                  </div>
                )}

                {formFields.map(f => (
                  <FieldRow
                    key={f.id}
                    field={f}
                    onChange={updated => updateField(f.id, updated)}
                    onRemove={() => removeField(f.id)}
                  />
                ))}

                <button
                  onClick={addField}
                  style={{ width: '100%', background: 'none', border: '1px dashed #1a1a18', borderRadius: 3, padding: '8px', color: '#444440', fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer', transition: 'all 0.15s', marginTop: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#888880'; (e.currentTarget as HTMLElement).style.borderColor = '#2a2a26' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#444440'; (e.currentTarget as HTMLElement).style.borderColor = '#1a1a18' }}
                >
                  + Add field
                </button>
              </div>

              {/* Code preview */}
              <div style={{ marginBottom: 24 }}>
                <button
                  onClick={() => setPreviewOpen(v => !v)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: previewOpen ? 10 : 0 }}
                >
                  <div style={{ ...sectionLabel, marginBottom: 0 }}>Python preview</div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#333330', transform: previewOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
                </button>
                {previewOpen && (
                  <pre style={{ background: '#0d0d0b', border: '1px solid #1a1a18', borderRadius: 3, padding: 16, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888880', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                    {generatePreview(displayName, formFields)}
                  </pre>
                )}
              </div>

              {/* Error */}
              {error && (
                <div style={{ marginBottom: 16, background: '#1a0d0d', border: '1px solid #3a1a1a', borderRadius: 3, padding: '10px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c85050' }}>
                  {error}
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving || !derivedName}
                style={{
                  background: saving || !derivedName ? '#1a1a18' : '#c8a96e',
                  color: saving || !derivedName ? '#444440' : '#0a0a0a',
                  border: 'none', borderRadius: 3, padding: '9px 24px',
                  fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500,
                  cursor: saving || !derivedName ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {saved ? 'Saved' : saving ? 'Saving...' : mode === 'edit' ? 'Update schema' : 'Create schema'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Delete confirmation modal                                         */}
      {/* ---------------------------------------------------------------- */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0d0d0b', border: '1px solid #1a1a18', padding: 24, width: 340, borderRadius: 4 }}>
            <div style={{ fontSize: 13, color: '#e8e6e0', marginBottom: 8 }}>Delete schema?</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#666660', marginBottom: 6 }}>
              {toDisplayName(deleteTarget)}
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', marginBottom: 20, lineHeight: 1.6 }}>
              This will delete the schema file, prompt file, and remove it from config.py. This cannot be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{ background: 'none', border: '1px solid #1a1a18', borderRadius: 3, padding: '6px 14px', color: '#666660', fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e8e6e0' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#666660' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                style={{ background: '#1a0d0d', border: '1px solid #3a1a1a', borderRadius: 3, padding: '6px 14px', color: '#c85050', fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: deleting ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (!deleting) (e.currentTarget as HTMLElement).style.background = '#2a1010' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1a0d0d' }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
