import { useState, useEffect } from 'react'
import axios from 'axios'
import { useTheme } from '../theme/useTheme'
import { font, fontSize, fontWeight, letterSpacing, radius, transitions } from '../theme/tokens'
import { topbarStyle, sectionLabel, fieldLabel, inputStyle, selectStyle, statusBadge, buttonPrimary, cardStyle, modalOverlayStyle, modalCardStyle } from '../theme/styles'

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
  fields.forEach(f => {
    lines.push(previewFieldLine(f.name || 'field', f.type, f.description, f.is_list))
  })

  // every schema implicitly supports these: mirrors backend/routers/schemas.py
  const existingNames = new Set(fields.map(f => f.name))
  if (!existingNames.has('confidence')) {
    lines.push(previewFieldLine('confidence', 'str', 'Extraction confidence: high, medium, or low', true))
  }
  if (!existingNames.has('extraction_notes')) {
    lines.push(previewFieldLine('extraction_notes', 'str', 'Ambiguities, caveats, or important context for this extraction', true))
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: FormField
  onChange: (updated: FormField) => void
  onRemove: () => void
}) {
  const { theme } = useTheme()
  const { colors } = theme
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
      style={{ border: `1px solid ${colors.border.default}`, borderRadius: radius.md, marginBottom: 6, overflow: 'hidden' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: colors.bg.surface, alignItems: 'center' }}>
        {/* drag handle visual */}
        <div style={{ color: colors.text.quaternary, cursor: 'default', userSelect: 'none', fontSize: fontSize.base, lineHeight: 1, paddingTop: 1 }}>⠿</div>

        {/* field name */}
        <input
          placeholder="field_name"
          value={field.name}
          onChange={e => update({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
          onBlur={e => update({ name: e.target.value.replace(/^_+|_+$/g, '') })}
          style={{ ...inputStyle(theme), flex: 1.4, minWidth: 0 }}
        />

        {/* type */}
        <select
          value={field.type}
          onChange={e => update({ type: e.target.value as FieldType, fields: [] })}
          style={{ ...selectStyle(theme), flex: 1, minWidth: 0 }}
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
          style={{ ...inputStyle(theme), flex: 2, minWidth: 0 }}
        />

        {/* nested toggle / list toggle */}
        {field.type === 'nested' && (
          <button
            onClick={() => setOpen(v => !v)}
            style={{ background: open ? colors.bg.active : 'none', border: `1px solid ${colors.border.default}`, borderRadius: radius.sm, padding: '4px 8px', cursor: 'pointer', color: colors.text.readable, fontFamily: font.mono, fontSize: fontSize.xs, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {field.fields.length} fields {open ? '▲' : '▼'}
          </button>
        )}

        {/* remove */}
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: hover ? colors.text.inactive : colors.text.quaternary, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0, transition: transitions.colorFast }}
        >
          ×
        </button>
      </div>

      {/* nested sub-fields */}
      {field.type === 'nested' && open && (
        <div style={{ padding: '8px 10px 10px 32px', background: colors.bg.raised, borderTop: `1px solid ${colors.border.default}` }}>
          <div style={{ ...sectionLabel(theme), marginBottom: 8 }}>Sub-fields of {toPascalCase(field.name || 'Item')}</div>
          {field.fields.map((nf, idx) => (
            <div key={nf.id} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input
                placeholder="field_name"
                value={nf.name}
                onChange={e => updateSubField(idx, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                onBlur={e => updateSubField(idx, { name: e.target.value.replace(/^_+|_+$/g, '') })}
                style={{ ...inputStyle(theme), flex: 1 }}
              />
              <select
                value={nf.type}
                onChange={e => updateSubField(idx, { type: e.target.value as FieldType })}
                style={{ ...selectStyle(theme), flex: 1 }}
              >
                {FIELD_TYPES.filter(t => t !== 'nested').map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <input
                placeholder="Description"
                value={nf.description}
                onChange={e => updateSubField(idx, { description: e.target.value })}
                style={{ ...inputStyle(theme), flex: 2 }}
              />
              <button
                onClick={() => removeSubField(idx)}
                style={{ background: 'none', border: 'none', color: colors.text.secondary, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addSubField}
            style={{ background: 'none', border: `1px dashed ${colors.border.default}`, borderRadius: radius.sm, padding: '5px 10px', color: colors.text.secondary, fontFamily: font.mono, fontSize: fontSize.xs, letterSpacing: letterSpacing.wide3, cursor: 'pointer', marginTop: 4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.text.readable; (e.currentTarget as HTMLElement).style.borderColor = colors.border.hover }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.secondary; (e.currentTarget as HTMLElement).style.borderColor = colors.border.default }}
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
  const { theme } = useTheme()
  const { colors } = theme
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
      // managed_fields come from registry; they match FormField shape
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

  const saveDisabled = saving || !derivedName

  return (
    <>
      <div style={topbarStyle(theme)}>
        <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text.primary }}>Schema Manager</div>
        <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.muted, letterSpacing: letterSpacing.wide1 }}>
          {schemas.length} schema{schemas.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ---------------------------------------------------------------- */}
        {/* Left panel: schema list                                          */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ width: 220, minWidth: 220, borderRight: `1px solid ${colors.border.default}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.border.default}` }}>
            <button
              onClick={startCreate}
              style={{ width: '100%', background: colors.accent.default, color: colors.accent.contrastText, border: 'none', borderRadius: radius.md, padding: '7px 12px', fontFamily: font.sans, fontSize: fontSize.base, fontWeight: fontWeight.medium, cursor: 'pointer', transition: transitions.opacityBase }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              + New schema
            </button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && (
              <div style={{ padding: '16px 16px', fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.secondary }}>Loading...</div>
            )}
            {!loading && schemas.length === 0 && (
              <div style={{ padding: '16px 16px', fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.secondary }}>No schemas found.</div>
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
                      background: isActive ? colors.bg.active : 'transparent',
                      border: 'none',
                      borderLeft: `2px solid ${isActive ? colors.accent.default : 'transparent'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: transitions.allBase,
                      minWidth: 0,
                    }}
                    onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = colors.bg.hover } }}
                    onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
                  >
                    <div style={{ fontSize: fontSize.base, color: isActive ? colors.text.primary : colors.text.readable, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {toDisplayName(s.id)}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: colors.text.quaternary }}>
                        {s.field_count}f
                      </span>
                      {s.is_managed && (
                        <span style={{ fontFamily: font.mono, fontSize: fontSize.xxs, color: colors.status.success.text, letterSpacing: letterSpacing.wide2 }}>managed</span>
                      )}
                    </div>
                  </button>
                  {s.is_managed && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(s.id) }}
                      title="Delete schema"
                      style={{ background: 'none', border: 'none', padding: '0 10px', cursor: 'pointer', color: colors.text.quaternary, transition: transitions.colorFast, flexShrink: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.status.error.text }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.quaternary }}
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
                <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.secondary, letterSpacing: letterSpacing.wide4, marginBottom: 8 }}>
                  SELECT A SCHEMA OR CREATE A NEW ONE
                </div>
                <button
                  onClick={startCreate}
                  style={{ background: 'none', border: `1px solid ${colors.border.default}`, borderRadius: radius.md, padding: '7px 16px', color: colors.text.inactive, fontFamily: font.mono, fontSize: fontSize.sm, cursor: 'pointer', letterSpacing: letterSpacing.wide2 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.text.tertiary; (e.currentTarget as HTMLElement).style.borderColor = colors.border.hover }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.inactive; (e.currentTarget as HTMLElement).style.borderColor = colors.border.default }}
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
                  <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.medium, color: colors.text.primary, marginBottom: 4 }}>{toDisplayName(selected.id)}</div>
                  <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.secondary }}>{selected.class_name}</div>
                </div>
                <span style={{ fontFamily: font.mono, fontSize: fontSize.xs, padding: '3px 8px', borderRadius: radius.sm, background: colors.bg.surface, border: `1px solid ${colors.border.default}`, color: colors.text.secondary }}>
                  read-only
                </span>
              </div>

              <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.muted, marginBottom: 20, padding: '10px 14px', background: colors.bg.surface, border: `1px solid ${colors.border.default}`, borderRadius: radius.md }}>
                This schema is defined in Python. Edit <code style={{ color: colors.text.readable }}>schemas/{selected.id}.py</code> directly.
              </div>

              <div style={sectionLabel(theme)}>Fields ({selected.field_count})</div>
              {selected.fields.map(f => (
                <div key={f.name} style={{ display: 'flex', gap: 12, padding: '8px 12px', background: colors.bg.surface, border: `1px solid ${colors.border.default}`, borderRadius: radius.md, marginBottom: 4 }}>
                  <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.tertiary, minWidth: 160 }}>{f.name}</div>
                  <div style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: colors.text.secondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.type}</div>
                  {f.description && (
                    <div style={{ fontSize: fontSize.sm, color: colors.text.inactive, flex: 2 }}>{f.description}</div>
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
                <div style={sectionLabel(theme)}>{mode === 'create' ? 'New schema' : 'Edit schema'}</div>

                <div style={{ ...cardStyle(theme), padding: 16 }}>
                  <div style={fieldLabel(theme)}>
                    Display name
                  </div>
                  <input
                    placeholder="e.g. Market Report"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    disabled={mode === 'edit'}
                    style={{ ...inputStyle(theme), marginBottom: 10, opacity: mode === 'edit' ? 0.5 : 1 }}
                  />
                  {derivedName && (
                    <div style={{ display: 'flex', gap: 16, fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.muted }}>
                      <span>id: <span style={{ color: colors.text.readable }}>{derivedName}</span></span>
                      <span>class: <span style={{ color: colors.text.readable }}>{derivedClass}</span></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fields */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ ...sectionLabel(theme), marginBottom: 0 }}>Fields ({formFields.length})</div>
                </div>
                <div style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: colors.text.quaternary, marginBottom: 10 }}>
                  confidence and extraction_notes are added automatically to every schema
                </div>

                {/* column headers */}
                {formFields.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, padding: '0 10px 6px 28px', fontFamily: font.mono, fontSize: fontSize.xxs, color: colors.text.quaternary, letterSpacing: letterSpacing.wide4, textTransform: 'uppercase' }}>
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
                  style={{ width: '100%', background: 'none', border: `1px dashed ${colors.border.default}`, borderRadius: radius.md, padding: '8px', color: colors.text.secondary, fontFamily: font.mono, fontSize: fontSize.xs, letterSpacing: letterSpacing.wide3, cursor: 'pointer', transition: transitions.allBase, marginTop: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.text.readable; (e.currentTarget as HTMLElement).style.borderColor = colors.border.hover }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.secondary; (e.currentTarget as HTMLElement).style.borderColor = colors.border.default }}
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
                  <div style={{ ...sectionLabel(theme), marginBottom: 0 }}>Python preview</div>
                  <span style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: colors.text.quaternary, transform: previewOpen ? 'rotate(180deg)' : 'none', transition: transitions.allSlow, display: 'inline-block' }}>▼</span>
                </button>
                {previewOpen && (
                  <pre style={{ background: colors.bg.surface, border: `1px solid ${colors.border.default}`, borderRadius: radius.md, padding: 16, fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.readable, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                    {generatePreview(displayName, formFields)}
                  </pre>
                )}
              </div>

              {/* Error */}
              {error && (
                <div style={{ ...statusBadge(theme, 'error'), marginBottom: 16, borderRadius: radius.md, padding: '10px 14px', fontFamily: font.mono, fontSize: fontSize.sm }}>
                  {error}
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saveDisabled}
                style={buttonPrimary(theme, saveDisabled)}
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
        <div style={modalOverlayStyle(theme)}>
          <div style={{ ...modalCardStyle(theme), padding: 24, width: 340 }}>
            <div style={{ fontSize: fontSize.md, color: colors.text.primary, marginBottom: 8 }}>Delete schema?</div>
            <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: colors.text.inactive, marginBottom: 6 }}>
              {toDisplayName(deleteTarget)}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: colors.text.secondary, marginBottom: 20, lineHeight: 1.6 }}>
              This will delete the schema file, prompt file, and remove it from config.py. This cannot be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{ background: 'none', border: `1px solid ${colors.border.default}`, borderRadius: radius.md, padding: '6px 14px', color: colors.text.inactive, fontFamily: font.sans, fontSize: fontSize.base, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.text.primary }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.inactive }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                style={{ background: colors.status.error.bg, border: `1px solid ${colors.status.error.border}`, borderRadius: radius.md, padding: '6px 14px', color: colors.status.error.text, fontFamily: font.sans, fontSize: fontSize.base, cursor: deleting ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (!deleting) (e.currentTarget as HTMLElement).style.background = colors.status.error.bgHover }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = colors.status.error.bg }}
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
