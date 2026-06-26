import { useTheme } from '../lib/theme'

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={`theme-toggle ${className}`.trim()} role="group" aria-label="เลือกธีม">
      <button
        type="button"
        className={theme === 'light' ? 'active' : ''}
        onClick={() => setTheme('light')}
        title="Light mode"
        aria-pressed={theme === 'light'}
      >
        ☀️
      </button>
      <button
        type="button"
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => setTheme('dark')}
        title="Dark mode"
        aria-pressed={theme === 'dark'}
      >
        🌙
      </button>
    </div>
  )
}
