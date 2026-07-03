import { useTheme } from '../theme/useTheme'
import { font, fontSize, letterSpacing, transitions } from '../theme/tokens'

interface Props {
  loading: boolean
  currentFile: string
  totalFiles: number
  completedFiles: number
}

export default function ProgressBar({ loading, currentFile, totalFiles, completedFiles }: Props) {
  const { theme } = useTheme()
  const { colors } = theme

  if (!loading) return null

  const isIndeterminate = totalFiles === 1
  const progress = totalFiles > 1 ? (completedFiles / totalFiles) * 100 : 0

  return (
    <div style={{
      position: 'relative',
      borderBottom: `1px solid ${colors.border.default}`,
    }}>
      {/* track */}
      <div style={{
        height: 2,
        background: colors.border.default,
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
              background: colors.accent.default,
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
            background: colors.accent.default,
            transition: transitions.widthSlow,
          }} />
        )}
      </div>

      {/* label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 28px',
        background: colors.bg.surface,
      }}>
        <div style={{
          fontFamily: font.mono,
          fontSize: fontSize.sm,
          color: colors.text.midGray,
          letterSpacing: letterSpacing.wide1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '70%',
        }}>
          {currentFile}
        </div>
        {totalFiles > 1 && (
          <div style={{
            fontFamily: font.mono,
            fontSize: fontSize.sm,
            color: colors.text.secondary,
            letterSpacing: letterSpacing.wide1,
            flexShrink: 0,
          }}>
            {completedFiles} / {totalFiles}
          </div>
        )}
      </div>
    </div>
  )
}
