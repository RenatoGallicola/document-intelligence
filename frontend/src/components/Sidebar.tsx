import type { Page } from '../App'

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
  model: string
}

const navItems: { id: Page; label: string; section: string }[] = [
  { id: 'processor', label: 'Processor', section: 'Extract' },
  { id: 'explorer', label: 'Output explorer', section: 'Extract' },
  { id: 'schemas', label: 'Schema manager', section: 'Configure' },
  { id: 'settings', label: 'Settings', section: 'Configure' },
]

export default function Sidebar({ currentPage, onNavigate, model }: Props) {
  const sections = [...new Set(navItems.map(i => i.section))]

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: '#111110',
      borderRight: '1px solid #1e1e1c',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1e1e1c' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 300, color: '#555550', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
          v0.1.0
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#e8e6e0', letterSpacing: '-0.01em' }}>
          Document Intelligence
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 0' }}>
        {sections.map(section => (
          <div key={section}>
            <div style={{
              padding: '16px 20px 8px',
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              fontWeight: 300,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: navItems.filter(i => i.section === section).some(i => i.id === currentPage) ? '#e8e6e0' : '#3a3a36',
              transition: 'color 0.15s'
            }}>
              {section}
            </div>
            {navItems.filter(i => i.section === section).map(item => {
              const active = currentPage === item.id
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
                    background: active ? '#161614' : 'transparent',
                    border: 'none',
                    borderLeft: `2px solid ${active ? '#c8a96e' : 'transparent'}`,
                    color: active ? '#e8e6e0' : '#666660',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 400,
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = '#b8b6b0'; (e.currentTarget as HTMLElement).style.background = '#161614' } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = '#666660'; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
                >
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: active ? '#c8a96e' : 'currentColor',
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

      <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e1c' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#444440', letterSpacing: '0.05em' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a7c59', flexShrink: 0 }} />
          {model} — connected
        </div>
      </div>
    </aside>
  )
}