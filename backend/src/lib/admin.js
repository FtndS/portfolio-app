export function getBootstrapAdminEmail() {
  return (process.env.ADMIN_EMAIL || process.env.AI_OWNER_EMAIL || 'tanadon.sangkhatorn@gmail.com')
    .trim()
    .toLowerCase()
}

export function isAdminRole(role) {
  return role === 'admin'
}
