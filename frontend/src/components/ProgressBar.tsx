interface Props {
  loading: boolean
  currentFile: string
  totalFiles: number
  completedFiles: number
}

export default function ProgressBar({ loading, currentFile, totalFiles, completedFiles }: Props) {
  if (!loading) return null

  const isIndeterminate = totalFiles === 1
  const progress = totalFiles > 1 ? (completedFiles / totalFiles) * 100 : 0

  return (
    <div style={{
      position: 'relative',
      borderBottom: '1px solid #1a1a18',
    }}>
      {/* track */}
      <div style={{
        height: 2,
        background: '#1a1a18',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {isIndeterminate ? (
          <>
            <style>{`
              @keyframes indeterminate {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
              }
            `}</style>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '25%',
              background: '#c8a96e',
              animation: 'indeterminate 1.4s ease-in-out infinite',
            }} />
          </>
        ) : (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${progress}%`,
            background: '#c8a96e',
            transition: 'width 0.4s ease',
          }} />
        )}
      </div>

      {/* label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 28px',
        background: '#0d0d0b',
      }}>
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 11,
          color: '#555550',
          letterSpacing: '0.05em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '70%',
        }}>
          {currentFile}
        </div>
        {totalFiles > 1 && (
          <div style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 11,
            color: '#444440',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}>
            {completedFiles} / {totalFiles}
          </div>
        )}
      </div>
    </div>
  )
}