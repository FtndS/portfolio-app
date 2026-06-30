import { createContext, useContext, useCallback, useState } from 'react'

const STORAGE_KEY = 'portdiary-theme'
const ThemeContext = createContext({ theme: 'dark', setTheme: () => {}, toggleTheme: () => {} })

export function getStoredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'light' ? '#f3ede4' : '#0f0f12'
  const favicon = document.querySelector('link[rel="icon"]')
  if (favicon) {
    favicon.href = theme === 'light' ? '/favicon-light.svg' : '/favicon.svg'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  )

  const setTheme = useCallback((next) => {
    applyTheme(next)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
