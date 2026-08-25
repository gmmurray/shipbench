import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ThemeToggle from './ThemeToggle.svelte';

/** jsdom gives a real localStorage, but it persists across tests. */
function resetEnvironment() {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
}

beforeEach(resetEnvironment);
afterEach(resetEnvironment);

const button = (label: string) => screen.getByRole('button', { name: label });
const SYSTEM = 'Use system theme';
const LIGHT = 'Use light theme';
const DARK = 'Use dark theme';

describe('ThemeToggle', () => {
  it('exposes the three options as a labelled group', () => {
    render(ThemeToggle);
    expect(
      screen.getByRole('group', { name: 'Color theme' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('defaults to System when nothing is stored', () => {
    render(ThemeToggle);
    expect(button(SYSTEM)).toHaveAttribute('aria-pressed', 'true');
    expect(button(LIGHT)).toHaveAttribute('aria-pressed', 'false');
    expect(button(DARK)).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects a stored choice on mount', () => {
    // Static output cannot know the choice at build time, so the control has to
    // catch up on hydration or it shows System while the page renders dark.
    localStorage.setItem('theme', 'dark');
    render(ThemeToggle);
    expect(button(DARK)).toHaveAttribute('aria-pressed', 'true');
    expect(button(SYSTEM)).toHaveAttribute('aria-pressed', 'false');
  });

  it('ignores a stored value that is not a real choice', () => {
    localStorage.setItem('theme', 'sepia');
    render(ThemeToggle);
    expect(button(SYSTEM)).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies and persists an explicit light choice', async () => {
    const user = userEvent.setup();
    render(ThemeToggle);

    await user.click(button(LIGHT));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(button(LIGHT)).toHaveAttribute('aria-pressed', 'true');
    expect(button(SYSTEM)).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies and persists an explicit dark choice', async () => {
    const user = userEvent.setup();
    render(ThemeToggle);

    await user.click(button(DARK));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('returning to System removes both the attribute and the stored key', async () => {
    // Absence is what makes the media query take over — writing "system" into
    // storage or leaving data-theme behind would pin the OS default.
    const user = userEvent.setup();
    localStorage.setItem('theme', 'light');
    render(ThemeToggle);

    await user.click(button(SYSTEM));

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('theme')).toBeNull();
    expect(button(SYSTEM)).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps exactly one option pressed across changes', async () => {
    const user = userEvent.setup();
    render(ThemeToggle);

    for (const label of [LIGHT, DARK, SYSTEM, DARK]) {
      await user.click(button(label));
      const pressed = screen
        .getAllByRole('button')
        .filter(b => b.getAttribute('aria-pressed') === 'true');
      expect(pressed).toHaveLength(1);
      expect(pressed[0]).toHaveAccessibleName(label);
    }
  });

  it('is reachable and operable by keyboard', async () => {
    const user = userEvent.setup();
    render(ThemeToggle);

    await user.tab();
    expect(button(SYSTEM)).toHaveFocus();
    await user.tab();
    expect(button(LIGHT)).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('still applies the theme when storage throws', async () => {
    // Private mode: the choice must survive for the current page view even
    // though it cannot be persisted.
    const user = userEvent.setup();
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('SecurityError');
        },
        removeItem: () => {
          throw new Error('SecurityError');
        },
      },
    });

    try {
      render(ThemeToggle);
      await user.click(button(DARK));
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(button(DARK)).toHaveAttribute('aria-pressed', 'true');
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});
