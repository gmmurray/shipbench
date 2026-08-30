function enhanceProse(prose: HTMLElement): void {
  let copyStatus = prose.querySelector<HTMLElement>('.heading-link-status');
  if (!copyStatus) {
    copyStatus = document.createElement('span');
    copyStatus.className = 'heading-link-status';
    copyStatus.setAttribute('role', 'status');
    copyStatus.setAttribute('aria-live', 'polite');
    prose.prepend(copyStatus);
  }

  prose.querySelectorAll<HTMLElement>('h2[id], h3[id]').forEach(heading => {
    if (heading.querySelector(':scope > .heading-anchor')) return;

    const anchor = document.createElement('a');
    const headingLabel = heading.textContent?.trim() || 'section';
    anchor.className = 'heading-anchor';
    anchor.href = `#${heading.id}`;
    anchor.textContent = '#';
    anchor.title = 'Copy link to this section';
    anchor.setAttribute('aria-label', `Copy link to ${headingLabel}`);
    heading.append(anchor);
  });
}

function setupProseEnhancements(): void {
  document.querySelectorAll<HTMLElement>('.prose').forEach(enhanceProse);
}

document.addEventListener('click', async event => {
  if (!(event.target instanceof Element)) return;

  const anchor = event.target.closest('.heading-anchor');
  if (!(anchor instanceof HTMLAnchorElement)) return;

  const copyStatus = anchor
    .closest('.prose')
    ?.querySelector<HTMLElement>('.heading-link-status');
  if (!copyStatus) return;

  try {
    await navigator.clipboard.writeText(anchor.href);
    const heading = anchor.parentElement?.textContent?.replace(/#$/, '').trim();
    copyStatus.textContent = `Link copied to ${heading || 'section'}`;
  } catch {
    // The native anchor navigation still provides a usable permalink when
    // clipboard access is unavailable or denied.
  }
});

setupProseEnhancements();
document.addEventListener('astro:page-load', setupProseEnhancements);
