export default function AIDrawer({ open, onClose, children }) {
  return (
    <>
      {open && (
        <button
          type="button"
          className="dash-ai-backdrop"
          onClick={onClose}
          aria-label="ปิด AI"
        />
      )}
      <aside
        className={`dash-ai-drawer${open ? ' dash-ai-drawer--open' : ''}`}
        aria-label="AI assistant"
        aria-hidden={!open}
      >
        <div className="dash-ai-drawer-head">
          <div>
            <h2 className="dash-ai-drawer-title">🤖 AI</h2>
            <p className="dash-ai-drawer-sub">Copilot · วิเคราะห์พอร์ต · สรุปข่าว</p>
          </div>
          <button
            type="button"
            className="dash-ai-drawer-close"
            onClick={onClose}
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
        <div className="dash-ai-drawer-body">
          {children}
        </div>
      </aside>
    </>
  )
}
