/**
 * Port Diary logo — 3D diary icon (matches og:image / social brand).
 * @param {{ size?: number, showText?: boolean, className?: string }} props
 */
export default function Logo({ size = 32, showText = true, className = '' }) {
  const px = `${size}px`

  return (
    <span className={`pd-logo${className ? ` ${className}` : ''}`} style={{ '--logo-size': px }}>
      <img
        src="/logo-icon.png"
        srcSet="/logo-icon.png 1x, /logo-icon-512.png 2x"
        alt=""
        width={size}
        height={size}
        className="pd-logo-mark pd-logo-mark--icon"
        aria-hidden="true"
        draggable={false}
      />
      {showText && <span className="pd-logo-text">Port Diary</span>}
    </span>
  )
}
