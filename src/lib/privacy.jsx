import { createContext, useCallback, useContext, useState } from 'react'

const STORAGE_KEY = 'portdiary-hide-values'

const PrivacyContext = createContext(null)

export function PrivacyProvider({ children }) {
  const [hideValues, setHideValues] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1',
  )

  const toggleHideValues = useCallback(() => {
    setHideValues((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  return (
    <PrivacyContext.Provider value={{ hideValues, toggleHideValues }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider')
  return ctx
}
