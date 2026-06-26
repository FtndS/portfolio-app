import { useTheme } from '../lib/theme'

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={`theme-toggle ${className}`.trim()} role="group" aria-label="เลือกธีม">
      <button
        type="button"
        className={theme === 'light' ? 'active' : ''}
        onClick={() => setTheme('light')}
        title="โหมดสว่าง"
        aria-pressed={theme === 'light'}
      >
        สว่าง
      </button>
      <button
        type="button"
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => setTheme('dark')}
        title="โหมดมืด"
        aria-pressed={theme === 'dark'}
      >
        มืด
      </button>
    </div>
  )
}
