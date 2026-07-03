import { useEffect, useState, type ReactNode } from 'react'
import { themes, type ThemeName } from './tokens'
import { ThemeContext, type ThemeContextValue } from './context'

const STORAGE_KEY = 'di-theme'

function readStoredTheme(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(readStoredTheme)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeName)
    const { colors } = themes[themeName]
    document.documentElement.style.setProperty('--color-bg', colors.bg.base)
    document.documentElement.style.setProperty('--color-text', colors.text.primary)
    document.documentElement.style.setProperty('--color-scrollbar-thumb', colors.border.hover)
  }, [themeName])

  const value: ThemeContextValue = {
    theme: themes[themeName],
    themeName,
    setTheme: setThemeName,
    toggleTheme: () => setThemeName(prev => (prev === 'dark' ? 'light' : 'dark')),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
