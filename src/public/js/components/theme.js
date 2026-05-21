/**
 * Theme Controller module.
 * Manages switching between Light (Cool Paper) and Dark (Neon Zinc) modes,
 * persisting the setting in localStorage.
 */
export function initTheme() {
  const savedTheme = localStorage.getItem('crypto-theme') || 'dark';
  setTheme(savedTheme);

  const themeToggler = document.getElementById('themeToggler');
  if (themeToggler) {
    themeToggler.addEventListener('click', () => {
      const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
    });
  }
}

function setTheme(theme) {
  const themeToggler = document.getElementById('themeToggler');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    if (themeToggler) {
      themeToggler.innerHTML = '🌙';
      themeToggler.title = 'Basculer en Mode Sombre';
    }
  } else {
    document.body.classList.remove('light-theme');
    if (themeToggler) {
      themeToggler.innerHTML = '☀️';
      themeToggler.title = 'Basculer en Mode Clair';
    }
  }
  localStorage.setItem('crypto-theme', theme);
}
