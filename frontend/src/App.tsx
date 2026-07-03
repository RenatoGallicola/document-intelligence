import { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from './components/Sidebar'
import Processor from './pages/Processor'
import OutputExplorer from './pages/OutputExplorer'
import SchemaManager from './pages/SchemaManager'
import Settings from './pages/Settings'
import { useTheme } from './theme/useTheme'

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
  const { theme } = useTheme()
  const [currentPage, setCurrentPage] = useState<Page>('processor')
  const [documentType, setDocumentType] = useState('competitor_report')
  const [files, setFiles] = useState<File[]>([])
  const [currentFile, setCurrentFile] = useState<string>('')
  const [completedFiles, setCompletedFiles] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ProcessResult[]>([])
  const [model, setModel] = useState('gemini-3.5-flash')
  const [apiKeySet, setApiKeySet] = useState(false)

  useEffect(() => {
    axios.get('/api/settings').then(res => {
      setModel(res.data.model)
      setApiKeySet(res.data.api_key_set)
    })
  }, [])

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
      case 'settings': return <Settings model={model} onModel={setModel} apiKeySet={apiKeySet} onApiKeySet={setApiKeySet} />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: theme.colors.bg.base }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} model={model} apiKeySet={apiKeySet} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: theme.colors.bg.surface }}>
        {renderPage()}
      </main>
    </div>
  )
}