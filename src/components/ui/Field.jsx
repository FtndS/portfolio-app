export default function Field({ label, children }) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}
