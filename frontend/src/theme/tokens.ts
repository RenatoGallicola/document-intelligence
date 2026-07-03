export interface ThemeColors {
  bg: {
    base: string
    surface: string
    raised: string
    active: string
    hover: string
  }
  border: {
    default: string
    hover: string
  }
  text: {
    primary: string
    tertiary: string
    readable: string
    inactive: string
    midGray: string
    secondary: string
    muted: string
    quaternary: string
  }
  accent: {
    default: string
    contrastText: string
  }
  status: {
    success: { bg: string; text: string; border: string }
    warning: { bg: string; text: string; border: string }
    error: { bg: string; text: string; border: string; bgHover: string }
  }
  overlay: {
    scrim: string
  }
}

export type ThemeName = 'dark' | 'light'

export interface Theme {
  name: ThemeName
  colors: ThemeColors
}

export const dark: Theme = {
  name: 'dark',
  colors: {
    bg: {
      base: '#0a0a0a',
      surface: '#0d0d0b',
      raised: '#111110',
      active: '#161614',
      hover: '#0f0f0d',
    },
    border: {
      default: '#1a1a18',
      hover: '#2a2a26',
    },
    text: {
      primary: '#e8e6e0',
      tertiary: '#b8b6b0',
      readable: '#888880',
      inactive: '#666660',
      midGray: '#555550',
      secondary: '#444440',
      muted: '#3a3a36',
      quaternary: '#333330',
    },
    accent: {
      default: '#c8a96e',
      contrastText: '#0a0a0a',
    },
    status: {
      success: { bg: '#0d1f12', text: '#4a7c59', border: '#1a3020' },
      warning: { bg: '#1a1608', text: '#c8a96e', border: '#3a3020' },
      error: { bg: '#1a0d0d', text: '#c85050', border: '#3a1a1a', bgHover: '#2a1010' },
    },
    overlay: { scrim: 'rgba(0,0,0,0.6)' },
  },
}

export const light: Theme = {
  name: 'light',
  colors: {
    bg: {
      base: '#faf8f4',
      surface: '#f2efe7',
      raised: '#ffffff',
      active: '#efe8d8',
      hover: '#f6f2e9',
    },
    border: {
      default: '#e5e1d5',
      hover: '#cfc8b6',
    },
    text: {
      primary: '#1a1815',
      tertiary: '#35312a',
      readable: '#4f4a3b',
      inactive: '#66604e',
      midGray: '#78725f',
      secondary: '#8f8977',
      muted: '#b0ab9b',
      quaternary: '#c9c4b6',
    },
    accent: {
      default: '#c8a96e',
      contrastText: '#0a0a0a',
    },
    status: {
      success: { bg: '#e8f2ea', text: '#2f6b42', border: '#b9d9c0' },
      warning: { bg: '#faf3e0', text: '#8a6d2f', border: '#e6d9ae' },
      error: { bg: '#fbe9e9', text: '#b03636', border: '#eec3c3', bgHover: '#f6d4d4' },
    },
    overlay: { scrim: 'rgba(0,0,0,0.6)' },
  },
}

export const themes: Record<ThemeName, Theme> = { dark, light }

export const font = {
  sans: "'DM Sans', sans-serif",
  mono: "'DM Mono', monospace",
} as const

export const fontSize = {
  xxs: 9,
  xs: 10,
  sm: 11,
  base: 12,
  md: 13,
  lg: 15,
  xl: 16,
} as const

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
} as const

export const letterSpacing = {
  tight: '-0.01em',
  wide1: '0.05em',
  wide2: '0.06em',
  wide3: '0.08em',
  wide4: '0.1em',
  wide5: '0.12em',
  wide6: '0.15em',
} as const

export const radius = {
  sm: 2,
  md: 3,
  lg: 4,
  full: '50%',
} as const

export const transitions = {
  colorFast: 'color 0.15s ease',
  allBase: 'all 0.15s ease',
  allSlow: 'all 0.2s ease',
  opacityBase: 'opacity 0.15s ease',
  widthSlow: 'width 0.4s ease',
} as const
