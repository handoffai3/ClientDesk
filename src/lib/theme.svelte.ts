export type ThemeMode = 'light' | 'dark' | 'system';

export const theme = $state<{ mode: ThemeMode }>({ mode: 'system' });

function apply() {
  const dark =
    theme.mode === 'dark' ||
    (theme.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function initTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') theme.mode = saved;
  } catch {}
  apply();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
}

export function setTheme(mode: ThemeMode) {
  theme.mode = mode;
  try {
    localStorage.setItem('theme', mode);
  } catch {}
  apply();
}
