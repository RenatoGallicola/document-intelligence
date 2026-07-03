import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ProgressBar from '../components/ProgressBar'

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

const divider: React.CSSProperties = {
  height: 1,
  background: '#1a1a18',
  margin: '24px 0',
}

import type { ProcessResult } from '../App'

interface Props {
  results: ProcessResult[]
  onResults: (results: ProcessResult[]) => void
  documentType: string
  onDocumentType: (type: string) => void
  files: File[]
  onFiles: (files: File[]) => void
  loading: boolean
  onLoading: (loading: boolean) => void
  currentFile: string
  onCurrentFile: (file: string) => void
  completedFiles: number
  onCompletedFiles: (count: number) => void
  totalFiles: number
  onTotalFiles: (count: number) => void
}

export default function Processor({ results, onResults, documentType, onDocumentType, files, onFiles, loading, onLoading, currentFile, onCurrentFile, completedFiles, onCompletedFiles, totalFiles, onTotalFiles }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [docTypes, setDocTypes] = useState<Array<{ id: string; label: string }>>([])
  const [schemasLoaded, setSchemasLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    axios.get<Array<{ id: string; class_name: string }>>('/api/schemas').then(res => {
      const types = res.data.map(s => ({
        id: s.id,
        label: s.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      }))
      setDocTypes(types)
      if (types.length > 0 && !types.find(t => t.id === documentType)) {
        onDocumentType(types[0].id)
      } else if (types.length === 0) {
        onDocumentType('')
      }
      setSchemasLoaded(true)
    }).catch(() => {
      setDocTypes([{ id: 'competitor_report', label: 'Competitor Report' }])
      setSchemasLoaded(true)
    })
  }, [])

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const pdfs = Array.from(incoming).filter(f => f.type === 'application/pdf')
    const names = new Set(files.map(f => f.name))
    onFiles([...files, ...pdfs.filter(f => !names.has(f.name))])
  }

  const removeFile = (name: string) => onFiles(files.filter(f => f.name !== name))

  const handleExtract = async () => {
    if (!files.length) return
    onLoading(true)
    onTotalFiles(files.length)
    onCompletedFiles(0)
    setError(null)
    const newResults: ProcessResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      onCurrentFile(file.name)
      const form = new FormData()
      form.append('file', file)
      form.append('document_type', documentType)
      try {
        const res = await axios.post('/api/documents/process', form)
        newResults.push({ filename: file.name, ...res.data })
        onCompletedFiles(i + 1)
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Unknown error'
        setError(`${file.name}: ${msg}`)
      }
    }

    onResults([...results, ...newResults])
    onFiles([])
    onLoading(false)
    onCurrentFile('')
  }

  const formatBytes = (b: number) => b < 1e6 ? `${(b / 1e3).toFixed(0)} kb` : `${(b / 1e6).toFixed(1)} mb`

  const noSchemas = schemasLoaded && docTypes.length === 0
  const dropDisabled = loading || noSchemas

  return (
    <>
      <div style={topbarStyle}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e6e0' }}>Processor</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3a3a36', letterSpacing: '0.05em' }}>
          {loading ? 'extracting...' : files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} ready` : results.length > 0 ? `${results.length} result${results.length > 1 ? 's' : ''}` : 'no files selected'}
        </div>
      </div>

      <ProgressBar
        loading={loading}
        currentFile={currentFile}
        totalFiles={totalFiles}
        completedFiles={completedFiles}
      />
      
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

        <div style={sectionLabel as React.CSSProperties}>Upload documents</div>

        {noSchemas && (
          <div style={{ background: '#1a1608', border: '1px solid #3a3020', borderRadius: 3, padding: '10px 14px', marginBottom: 12, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c8a96e' }}>
            No document schemas configured yet. Create one in Schema Manager before extracting.
          </div>
        )}

        {/* drop zone */}
        <div
          onClick={() => { if (!dropDisabled) inputRef.current?.click() }}
          onDragOver={e => { if (!dropDisabled) { e.preventDefault(); setDragging(true) } }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); if (!dropDisabled) addFiles(e.dataTransfer.files) }}
          onMouseEnter={() => { if (!dropDisabled) setHovering(true) }}
          onMouseLeave={() => setHovering(false)}
          style={{
            border: `1px dashed ${dragging || hovering ? '#555550' : '#2a2a26'}`,
            borderRadius: 4,
            padding: '40px 28px',
            textAlign: 'center',
            cursor: dropDisabled ? 'not-allowed' : 'pointer',
            background: dragging || hovering ? '#111110' : 'transparent',
            transition: 'all 0.2s',
            marginBottom: 12,
            pointerEvents: dropDisabled ? 'none' : 'auto',
            opacity: dropDisabled ? 0.4 : 1,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            disabled={dropDisabled}
            style={{ display: 'none' }}
            onChange={e => { if (!dropDisabled) addFiles(e.target.files) }}
          />
          <div style={{ width: 32, height: 32, border: '1px solid #2a2a26', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#444440' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          </div>
          <div style={{ fontSize: 13, color: '#888880', marginBottom: 4 }}>Drop PDF files here</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#333330', letterSpacing: '0.05em' }}>or click to browse</div>
        </div>

        {/* file list */}
        {files.map(f => (
          <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#111110', border: '1px solid #1a1a18', borderRadius: 3, marginBottom: 6 }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#c8a96e', letterSpacing: '0.05em', border: '1px solid #3a3020', padding: '2px 5px', borderRadius: 2, background: '#1a1608' }}>PDF</div>
            <div style={{ flex: 1, fontSize: 12, color: '#b8b6b0' }}>{f.name}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#333330' }}>{formatBytes(f.size)}</div>
            {!loading && (
              <button onClick={() => removeFile(f.name)} style={{ background: 'none', border: 'none', color: '#333330', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
            )}
          </div>
        ))}

        <div style={divider} />

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Document type</div>
            <select
              value={documentType}
              onChange={e => onDocumentType(e.target.value)}
              disabled={noSchemas}
              style={{ width: '100%', background: '#111110', border: '1px solid #1e1e1c', borderRadius: 3, color: noSchemas ? '#444440' : '#b8b6b0', fontFamily: 'DM Sans, sans-serif', fontSize: 12, padding: '8px 12px', outline: 'none' }}
            >
              {noSchemas
                ? <option value="">No schemas available</option>
                : docTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
            </select>
          </div>
          <button
            onClick={handleExtract}
            disabled={loading || !files.length || noSchemas}
            style={{
              background: loading || !files.length || noSchemas ? '#1a1a18' : '#c8a96e',
              color: loading || !files.length || noSchemas ? '#444440' : '#0a0a0a',
              border: 'none', borderRadius: 3, padding: '8px 24px',
              fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500,
              cursor: loading || !files.length || noSchemas ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Extracting...' : 'Extract'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#1a0d0d', border: '1px solid #3a1a1a', borderRadius: 3, padding: '10px 14px', marginBottom: 16, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c85050' }}>
            {error}
          </div>
        )}

        {/* results */}
        {results.length > 0 && (
          <>
            <div style={divider} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={sectionLabel as React.CSSProperties & { marginBottom: 0 }}>Results</div>
              <button
                onClick={() => onResults([])}
                style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#444440', letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase', padding: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#888880')}
                onMouseLeave={e => (e.currentTarget.style.color = '#444440')}
              >
                Clear
              </button>
            </div>
            {results.map(r => (
              <div key={r.filename} style={{ background: '#111110', border: '1px solid #1a1a18', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1a1a18' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#b8b6b0' }}>{r.filename}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 2, background: '#0d1f12', color: '#4a7c59', border: '1px solid #1a3020' }}>
                      {r.summary.extracted_count} / {r.summary.extracted_count + r.summary.missing_count} fields
                    </span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 2, background: '#1a1608', color: '#c8a96e', border: '1px solid #3a3020' }}>
                      {typeof r.summary.confidence === 'object' ? (r.summary.confidence as { value?: string })?.value : r.summary.confidence}
                    </span>
                  </div>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.summary.extracted_fields.map(f => (
                    <span key={f} style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', letterSpacing: '0.05em', padding: '3px 8px', background: '#0d0d0b', border: '1px solid #1a1a18', borderRadius: 2 }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}