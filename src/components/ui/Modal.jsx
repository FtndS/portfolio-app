export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
