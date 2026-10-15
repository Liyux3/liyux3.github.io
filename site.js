document.documentElement.classList.add('js');

const themeButton = document.querySelector('[data-theme-control]');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let themeMode = document.documentElement.dataset.theme || null;
const isDarkTheme = () => themeMode ? themeMode === 'dark' : systemTheme.matches;
function applyTheme() {
  if (themeMode === null) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = themeMode;
  const isDark = isDarkTheme();
  const label = `Switch to ${isDark ? 'light' : 'dark'} mode`;
  themeButton.dataset.mode = isDark ? 'dark' : 'light';
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = isDark ? '#171719' : '#ffffff';
}
themeButton?.addEventListener('click', () => {
  themeMode = isDarkTheme() ? 'light' : 'dark';
  try { localStorage.setItem('yuxian.theme', themeMode); } catch { /* Current-page theme still works. */ }
  applyTheme();
});
systemTheme.addEventListener('change', applyTheme);
window.addEventListener('storage', event => {
  if (event.key !== 'yuxian.theme' && event.key !== null) return;
  themeMode = ['dark', 'light'].includes(event.newValue) ? event.newValue : null;
  applyTheme();
});
if (themeButton) applyTheme();

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const value = document.getElementById(button.dataset.copy).textContent;
    const status = button.querySelector('[role="status"]');
    try {
      await navigator.clipboard.writeText(value);
      status.textContent = 'Copied';
    } catch {
      status.textContent = 'Select text to copy';
      const range = document.createRange();
      range.selectNodeContents(document.getElementById(button.dataset.copy));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    setTimeout(() => { status.textContent = 'Copy'; }, 2500);
  });
}
