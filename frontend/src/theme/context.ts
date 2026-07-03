import { createContext } from 'react'
import type { Theme, ThemeName } from './tokens'

export interface ThemeContextValue {
  theme: Theme
  themeName: ThemeName
  setTheme: (name: ThemeName) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
