'use client';

import { useEffect, useSyncExternalStore } from 'react';

const OPTIONS = ['auto', 'dark', 'light'] as const;
type Theme = (typeof OPTIONS)[number];
const KEY = 'substrata-theme';

function apply(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener('substrata-theme', onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener('substrata-theme', onStoreChange);
  };
}

function snapshot(): Theme {
  const stored = window.localStorage.getItem(KEY);
  return OPTIONS.includes(stored as Theme) ? (stored as Theme) : 'auto';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, snapshot, (): Theme => 'auto');
  useEffect(() => {
    apply(theme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => theme === 'auto' && apply('auto');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  return (
    <div className="theme-toggle" role="group" aria-label="Colour mode">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          className="theme-toggle-option"
          onClick={() => {
            window.localStorage.setItem(KEY, option);
            window.dispatchEvent(new Event('substrata-theme'));
            apply(option);
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
