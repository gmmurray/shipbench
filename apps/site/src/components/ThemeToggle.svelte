<script lang="ts">
  // Three-state theme control — System / Light / Dark, mirroring Harbor's
  // ThemeToggle. See docs/design-doctrine.md › Theming.
  //
  // This component owns the *choice*, not the initial application: the page is
  // statically built, so a blocking inline script in BaseLayout.astro sets
  // `data-theme` before first paint. By the time this hydrates the theme is
  // already correct; it reads storage only to show which button is pressed.
  import { onMount } from 'svelte';

  type ThemeChoice = 'system' | 'light' | 'dark';

  const OPTIONS: { value: ThemeChoice; label: string }[] = [
    { value: 'system', label: 'Use system theme' },
    { value: 'light', label: 'Use light theme' },
    { value: 'dark', label: 'Use dark theme' },
  ];

  let choice = $state<ThemeChoice>('system');

  // Static output cannot know the stored choice at build time, so the server
  // markup always shows System until this runs. Re-runs after a ClientRouter
  // swap, since the island is recreated with the new page.
  onMount(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') choice = stored;
    } catch {
      /* Private mode: leave it on System. */
    }
  });

  function select(next: ThemeChoice) {
    choice = next;

    // Apply first — this cannot throw, and the visible result matters more
    // than persistence if storage is unavailable.
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = next;

    try {
      if (next === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch {
      /* Choice still applies for this page view. */
    }
  }
</script>

<div class="theme-toggle" role="group" aria-label="Color theme">
  {#each OPTIONS as option (option.value)}
    <button
      type="button"
      class="theme-toggle-btn"
      class:active={choice === option.value}
      aria-label={option.label}
      aria-pressed={choice === option.value}
      title={option.label}
      onclick={() => select(option.value)}
    >
      {#if option.value === 'system'}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="3" width="12" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
          <path d="M6 13.5h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      {:else if option.value === 'light'}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.4" />
          <path
            d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
      {:else}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M13.2 9.6A5.6 5.6 0 1 1 6.4 2.8a4.4 4.4 0 0 0 6.8 6.8Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        </svg>
      {/if}
    </button>
  {/each}
</div>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--iron);
    border-radius: 2px;
  }

  .theme-toggle-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 5px;
    color: var(--silver);
    background: transparent;
    border: 0;
    border-radius: 2px;
    cursor: pointer;
    /* Doctrine: interaction shifts color, never size. */
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .theme-toggle-btn:hover {
    color: var(--frosted);
  }

  .theme-toggle-btn.active {
    color: var(--accent);
    background: var(--accent-soft);
  }

  .theme-toggle-btn svg {
    display: block;
    width: 14px;
    height: 14px;
  }

  /* Touch targets get the 44px minimum where the control is finger-driven.
     Width is left to the container — in the drawer it sits beside a label. */
  @media (max-width: 760px) {
    .theme-toggle-btn {
      min-width: 44px;
      min-height: 44px;
    }

    .theme-toggle-btn svg {
      width: 16px;
      height: 16px;
    }
  }
</style>
