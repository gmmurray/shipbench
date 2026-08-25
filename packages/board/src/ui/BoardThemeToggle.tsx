// Doctrine: Theming. Standalone-only three-state theme control (System / Light /
// Dark). The standalone board is a client-only SPA with no server, so the
// explicit choice persists in localStorage (the embedded board has no toggle —
// it inherits the Harbor host's `data-theme`). "System" follows the OS via the
// CSS media query.

import { useState } from 'react';
import type { IconType } from 'react-icons';
import { RxDesktop, RxMoon, RxSun } from 'react-icons/rx';

type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'sb-theme';

const OPTIONS: { value: ThemeChoice; label: string; Icon: IconType }[] = [
  { value: 'system', label: 'System theme', Icon: RxDesktop },
  { value: 'light', label: 'Light theme', Icon: RxSun },
  { value: 'dark', label: 'Dark theme', Icon: RxMoon },
];

function readStored(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Apply the persisted choice to <html> before first render. Called by the
 *  standalone entry so the override is honored as early as possible. */
export function applyStoredBoardTheme(): void {
  const root = document.documentElement;
  const choice = readStored();
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = choice;
}

function select(choice: ThemeChoice): void {
  const root = document.documentElement;
  try {
    if (choice === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem(STORAGE_KEY);
    } else {
      root.dataset.theme = choice;
      localStorage.setItem(STORAGE_KEY, choice);
    }
  } catch {
    // Storage unavailable (private mode) — still apply for this session.
    if (choice === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = choice;
  }
}

export function BoardThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readStored);

  return (
    <div className="inline-flex h-9 items-center gap-0.5 rounded border border-sb-iron px-0.5">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => {
              setChoice(value);
              select(value);
            }}
            className={`rounded p-1.5 transition-colors ${
              active
                ? 'bg-sb-accent/15 text-sb-accent'
                : 'text-sb-silver hover:text-sb-frosted'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
