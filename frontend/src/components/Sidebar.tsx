import type { Page } from '../App'
import { useTheme } from '../theme/useTheme'
import { font, fontSize, fontWeight, letterSpacing, radius, transitions } from '../theme/tokens'
import { navRowStyle } from '../theme/styles'

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
  model: string
  apiKeySet: boolean
}

function SparkleIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d="M12 3 Q13 10 20 12 Q13 14 12 21 Q11 14 4 12 Q11 10 12 3 Z" />
    </svg>
  )
}

const navItems: { id: Page; label: string; section: string }[] = [
  { id: 'processor', label: 'Processor', section: 'Extract' },
  { id: 'explorer', label: 'Output explorer', section: 'Extract' },
  { id: 'schemas', label: 'Schema manager', section: 'Configure' },
  { id: 'settings', label: 'Settings', section: 'Configure' },
]

export default function Sidebar({ currentPage, onNavigate, model, apiKeySet }: Props) {
  const { theme } = useTheme()
  const { colors } = theme
  const sections = [...new Set(navItems.map(i => i.section))]

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: colors.bg.raised,
      borderRight: `1px solid ${colors.border.default}`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${colors.border.default}` }}>
        <div style={{ fontFamily: font.mono, fontSize: fontSize.xs, fontWeight: fontWeight.light, color: colors.text.midGray, letterSpacing: letterSpacing.wide6, textTransform: 'uppercase', marginBottom: 4 }}>
          v0.1.0
        </div>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: colors.text.primary, letterSpacing: letterSpacing.tight }}>
          Document Intelligence
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 0' }}>
        {sections.map(section => (
          <div key={section}>
            <div style={{
              padding: '16px 20px 8px',
              fontFamily: font.mono,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.light,
              letterSpacing: letterSpacing.wide5,
              textTransform: 'uppercase',
              color: navItems.filter(i => i.section === section).some(i => i.id === currentPage) ? colors.text.primary : colors.text.muted,
              transition: transitions.colorFast,
            }}>
              {section}
            </div>
            {navItems.filter(i => i.section === section).map(item => {
              const active = currentPage === item.id
              const row = navRowStyle(theme, active)
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 20px',
                    background: row.background,
                    border: 'none',
                    borderLeft: row.borderLeft,
                    color: row.color,
                    cursor: 'pointer',
                    fontSize: fontSize.md,
                    fontFamily: font.sans,
                    fontWeight: fontWeight.regular,
                    textAlign: 'left',
                    transition: transitions.allBase,
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = colors.text.tertiary; (e.currentTarget as HTMLElement).style.background = colors.bg.active } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = colors.text.inactive; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
                >
                  <div style={{
                    width: 6, height: 6, borderRadius: radius.full,
                    background: active ? colors.accent.default : 'currentColor',
                    opacity: active ? 1 : 0.5,
                    flexShrink: 0
                  }} />
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: `1px solid ${colors.border.default}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: font.mono, fontSize: fontSize.xs, color: colors.text.secondary, letterSpacing: letterSpacing.wide1 }}>
          <SparkleIcon color={apiKeySet ? colors.status.success.text : colors.status.error.text} />
          {model}
        </div>
      </div>
    </aside>
  )
}
