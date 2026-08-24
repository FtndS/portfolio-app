(function () {
  var STORAGE_KEY = 'portdiary-theme'

  function currentTheme() {
    var t = localStorage.getItem(STORAGE_KEY)
    if (t === 'light' || t === 'dark') return t
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = theme === 'light' ? '#f4efe7' : '#0f0f12'
    syncButtons(theme)
  }

  function syncButtons(theme) {
    document.querySelectorAll('[data-set-theme]').forEach(function (btn) {
      var on = btn.getAttribute('data-set-theme') === theme
      btn.classList.toggle('active', on)
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
  }

  applyTheme(currentTheme())

  document.addEventListener('DOMContentLoaded', function () {
    syncButtons(currentTheme())
    document.querySelectorAll('[data-set-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyTheme(btn.getAttribute('data-set-theme'))
      })
    })
  })
})()
