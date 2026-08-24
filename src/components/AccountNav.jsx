import ThemeToggle from './ThemeToggle'

export default function AccountNav({
  extra = null,
  leadingUtil = null,
  onHelp,
  onSettings,
  onAdmin,
  onLogout,
  logoutLabel = 'ออก',
}) {
  return (
    <>
      {extra}
      <ThemeToggle />
      <div className="dash-header-util" role="group" aria-label="เมนูบัญชี">
        {leadingUtil}
        {onHelp && (
          <button
            type="button"
            className="dash-util-btn dash-util-btn--help"
            onClick={onHelp}
            title="ช่วยเหลือ / แจ้งปัญหา"
            aria-label="ช่วยเหลือ"
          >
            ช่วยเหลือ
          </button>
        )}
        {onSettings && (
          <button
            type="button"
            className="dash-util-btn"
            onClick={onSettings}
            title="ตั้งค่าบัญชี"
            aria-label="ตั้งค่าบัญชี"
          >
            ตั้งค่า
          </button>
        )}
        {onAdmin && (
          <button
            type="button"
            className="dash-util-btn dash-util-btn--admin"
            onClick={onAdmin}
            title="Admin"
            aria-label="Admin"
          >
            Admin
          </button>
        )}
        {onLogout && (
          <button
            type="button"
            className="dash-util-btn dash-util-btn--logout"
            onClick={onLogout}
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
          >
            {logoutLabel}
          </button>
        )}
      </div>
    </>
  )
}
