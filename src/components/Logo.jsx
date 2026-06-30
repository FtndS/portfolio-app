import { useTheme } from '../lib/theme'

/**
 * Port Diary logo — notebook + rising chart mark (theme-aware).
 * @param {{ size?: number, showText?: boolean, className?: string }} props
 */
export default function Logo({ size = 32, showText = true, className = '' }) {
  const { theme } = useTheme()
  const markSrc = theme === 'light' ? '/logo-mark-light.svg' : '/logo-mark.svg'

  return (
    <span className={`pd-logo${className ? ` ${className}` : ''}`} style={{ '--logo-size': `${size}px` }}>
      <img
        src={markSrc}
        alt=""
        width={size}
        height={size}
        className="pd-logo-mark"
        aria-hidden="true"
        draggable={false}
      />
      {showText && <span className="pd-logo-text">Port Diary</span>}
    </span>
  )
}
