import { useState } from 'react'
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

const STORAGE_KEY = 'di-sidebar-collapsed'
const EXPANDED_WIDTH = 220
const COLLAPSED_WIDTH = 60

function SparkleIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d="M12 3 Q13 10 20 12 Q13 14 12 21 Q11 14 4 12 Q11 10 12 3 Z" />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: direction === 'right' ? 'rotate(180deg)' : 'none' }}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ProcessorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  )
}

function ExplorerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

function SchemaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h10M4 12h16M4 18h10" />
      <circle cx="17" cy="6" r="2" />
      <circle cx="10" cy="18" r="2" />
    </svg>
  )
}

const navItems: { id: Page; label: string; section: string; icon: () => React.ReactElement }[] = [
  { id: 'processor', label: 'Processor', section: 'Extract', icon: ProcessorIcon },
  { id: 'explorer', label: 'Output explorer', section: 'Extract', icon: ExplorerIcon },
  { id: 'schemas', label: 'Schema manager', section: 'Configure', icon: SchemaIcon },
  { id: 'settings', label: 'Settings', section: 'Configure', icon: SettingsIcon },
]

function readStoredCollapsed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export default function Sidebar({ currentPage, onNavigate, model, apiKeySet }: Props) {
  const { theme } = useTheme()
  const { colors } = theme
  const [collapsed, setCollapsed] = useState(readStoredCollapsed)
  const sections = [...new Set(navItems.map(i => i.section))]

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <aside style={{
      width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
      minWidth: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
      background: colors.bg.raised,
      borderRight: `1px solid ${colors.border.default}`,
      display: 'flex',
      flexDirection: 'column',
      transition: transitions.allSlow,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: collapsed ? '20px 0' : '24px 20px 20px',
        borderBottom: `1px solid ${colors.border.default}`,
      }}>
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={toggleCollapsed}
              title="Expand sidebar"
              style={{
                background: 'none',
                border: `1px solid ${colors.border.default}`,
                borderRadius: radius.sm,
                width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.text.readable,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.text.primary; (e.currentTarget as HTMLElement).style.borderColor = colors.border.hover }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.readable; (e.currentTarget as HTMLElement).style.borderColor = colors.border.default }}
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontFamily: font.mono, fontSize: fontSize.xs, fontWeight: fontWeight.light, color: colors.text.midGray, letterSpacing: letterSpacing.wide6, textTransform: 'uppercase' }}>
                v0.1.0
              </div>
              <button
                onClick={toggleCollapsed}
                title="Collapse sidebar"
                style={{
                  background: 'none',
                  border: `1px solid ${colors.border.default}`,
                  borderRadius: radius.sm,
                  width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.text.readable,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.text.primary; (e.currentTarget as HTMLElement).style.borderColor = colors.border.hover }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.readable; (e.currentTarget as HTMLElement).style.borderColor = colors.border.default }}
              >
                <ChevronIcon direction="left" />
              </button>
            </div>
            <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: colors.text.primary, letterSpacing: letterSpacing.tight }}>
              Document Intelligence
            </div>
          </>
        )}
      </div>

      <nav style={{ flex: 1, padding: '12px 0' }}>
        {sections.map(section => (
          <div key={section}>
            {!collapsed && (
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
            )}
            {navItems.filter(i => i.section === section).map(item => {
              const active = currentPage === item.id
              const row = navRowStyle(theme, active)
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 10,
                    width: '100%',
                    padding: collapsed ? '10px 0' : '8px 20px',
                    background: row.background,
                    border: 'none',
                    borderLeft: collapsed ? 'none' : row.borderLeft,
                    color: active ? colors.accent.default : row.color,
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
                  <Icon />
                  {!collapsed && item.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '16px 0' : '16px 20px',
        borderTop: `1px solid ${colors.border.default}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: font.mono, fontSize: fontSize.xs, color: colors.text.secondary, letterSpacing: letterSpacing.wide1 }} title={collapsed ? model : undefined}>
          <span title={`Gemini API — ${apiKeySet ? 'configured' : 'not configured'}`} style={{ display: 'flex' }}>
            <SparkleIcon color={apiKeySet ? colors.status.success.text : colors.status.error.text} />
          </span>
          {!collapsed && model}
        </div>
      </div>
    </aside>
  )
}
