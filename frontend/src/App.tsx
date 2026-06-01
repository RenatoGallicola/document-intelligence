import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Processor from './pages/Processor'
import OutputExplorer from './pages/OutputExplorer'
import SchemaManager from './pages/SchemaManager'
import Settings from './pages/Settings'

export type Page = 'processor' | 'explorer' | 'schemas' | 'settings'

export interface ProcessResult {
  filename: string
  summary: {
    extracted_count: number
    missing_count: number
    confidence: string
    extracted_fields: string[]
    missing_fields: string[]
  }
  data: Record<string, unknown>
  output_path: string
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('processor')
  const [documentType, setDocumentType] = useState('competitor_report')
  const [files, setFiles] = useState<File[]>([])
  const [currentFile, setCurrentFile] = useState<string>('')
  const [completedFiles, setCompletedFiles] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const [loading, setLoading] = useState(false) 
  const [results, setResults] = useState<ProcessResult[]>([])

  const renderPage = () => {
    switch (currentPage) {
      case 'processor': return (
        <Processor
          results={results}
          onResults={setResults}
          documentType={documentType}
          onDocumentType={setDocumentType}
          files={files}
          onFiles={setFiles}
          loading={loading}
          onLoading={setLoading}
          currentFile={currentFile}
          onCurrentFile={setCurrentFile}
          completedFiles={completedFiles}
          onCompletedFiles={setCompletedFiles}
          totalFiles={totalFiles}
          onTotalFiles={setTotalFiles}
        />
      )
      case 'explorer': return <OutputExplorer />
      case 'schemas': return <SchemaManager />
      case 'settings': return <Settings />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0d0b' }}>
        {renderPage()}
      </main>
    </div>
  )
}