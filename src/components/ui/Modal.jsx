export default function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="modal-overlay">
      <div className={`modal-panel${wide ? ' modal-panel--wide' : ''}`}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
