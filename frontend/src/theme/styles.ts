import type { CSSProperties } from 'react'
import type { Theme } from './tokens'
import { font, fontSize, fontWeight, letterSpacing, radius, transitions } from './tokens'

export function topbarStyle(t: Theme): CSSProperties {
  return {
    height: 52,
    borderBottom: `1px solid ${t.colors.border.default}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    flexShrink: 0,
  }
}

export function sectionLabel(t: Theme): CSSProperties {
  return {
    fontFamily: font.mono,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.light,
    color: t.colors.text.secondary,
    letterSpacing: letterSpacing.wide5,
    textTransform: 'uppercase',
    marginBottom: 12,
  }
}

export function fieldLabel(t: Theme): CSSProperties {
  return {
    fontFamily: font.mono,
    fontSize: fontSize.sm,
    color: t.colors.text.secondary,
    letterSpacing: letterSpacing.wide3,
    textTransform: 'uppercase',
    marginBottom: 6,
  }
}

export function dividerStyle(t: Theme): CSSProperties {
  return {
    height: 1,
    background: t.colors.border.default,
    margin: '24px 0',
  }
}

export function inputStyle(t: Theme): CSSProperties {
  return {
    width: '100%',
    background: t.colors.bg.surface,
    border: `1px solid ${t.colors.border.default}`,
    borderRadius: radius.md,
    color: t.colors.text.tertiary,
    fontFamily: font.mono,
    fontSize: fontSize.base,
    padding: '8px 12px',
    outline: 'none',
    boxSizing: 'border-box',
  }
}

export function selectStyle(t: Theme): CSSProperties {
  return { ...inputStyle(t), cursor: 'pointer' }
}

export function statusBadge(t: Theme, status: 'success' | 'warning' | 'error'): CSSProperties {
  const s = t.colors.status[status]
  return {
    background: s.bg,
    color: s.text,
    border: `1px solid ${s.border}`,
  }
}

export function buttonPrimary(t: Theme, disabled: boolean): CSSProperties {
  return {
    background: disabled ? t.colors.border.default : t.colors.accent.default,
    color: disabled ? t.colors.text.secondary : t.colors.accent.contrastText,
    border: 'none',
    borderRadius: radius.md,
    padding: '8px 24px',
    fontFamily: font.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: transitions.allBase,
    whiteSpace: 'nowrap',
  }
}

export function cardStyle(t: Theme): CSSProperties {
  return {
    background: t.colors.bg.raised,
    border: `1px solid ${t.colors.border.default}`,
    borderRadius: radius.lg,
  }
}

export function navRowStyle(t: Theme, active: boolean): CSSProperties {
  return {
    background: active ? t.colors.bg.active : 'transparent',
    borderLeft: `2px solid ${active ? t.colors.accent.default : 'transparent'}`,
    color: active ? t.colors.text.primary : t.colors.text.inactive,
  }
}

export function modalOverlayStyle(t: Theme): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    background: t.colors.overlay.scrim,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  }
}

export function modalCardStyle(t: Theme): CSSProperties {
  return {
    background: t.colors.bg.surface,
    border: `1px solid ${t.colors.border.default}`,
    borderRadius: radius.lg,
  }
}
