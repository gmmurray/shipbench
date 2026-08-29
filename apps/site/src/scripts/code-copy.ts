const COPYABLE_BLOCK_SELECTOR = '[data-code-block], .prose pre';
const COMMENT_MARKER = '__SHIPBENCH_COPY_COMMENT__';
const PROMPT_MARKER = '__SHIPBENCH_COPY_PROMPT__';
const SHELL_LANGUAGES = new Set([
  'bash',
  'console',
  'fish',
  'powershell',
  'ps1',
  'sh',
  'shell',
  'shellscript',
  'zsh',
]);

const resetTimers = new WeakMap<HTMLButtonElement, number>();

function codeSource(pre: HTMLPreElement): HTMLElement {
  return pre.querySelector<HTMLElement>('code') ?? pre;
}

function isMultiline(pre: HTMLPreElement): boolean {
  const source = codeSource(pre);
  return (
    source.querySelectorAll('.line').length > 1 ||
    /\r?\n/.test(source.textContent ?? '')
  );
}

function clipboardText(pre: HTMLPreElement): string {
  const source = codeSource(pre);
  const clone = source.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll<HTMLElement>('.comment, [data-copy-ignore]')
    .forEach(element => {
      element.replaceWith(document.createTextNode(COMMENT_MARKER));
    });
  clone.querySelectorAll<HTMLElement>('.prompt').forEach(element => {
    element.replaceWith(document.createTextNode(PROMPT_MARKER));
  });
  clone.querySelectorAll('.code-copy-button').forEach(element => {
    element.remove();
  });

  const isShell = SHELL_LANGUAGES.has(pre.dataset.language ?? '');
  const lines = (clone.textContent ?? '').replace(/\r\n?/g, '\n').split('\n');
  const cleaned: string[] = [];

  for (const originalLine of lines) {
    const hadCommentMarkup = originalLine.includes(COMMENT_MARKER);
    const line = originalLine
      .replaceAll(COMMENT_MARKER, '')
      .replace(new RegExp(`^[\\t ]*${PROMPT_MARKER}[\\t ]*`), '')
      .replace(/^[\t ]*(?:›|\$)[\t ]+/, '')
      .replace(/[\t ]+$/, '');

    if (
      (hadCommentMarkup && line.trim() === '') ||
      (isShell && /^\s*#/.test(line))
    ) {
      continue;
    }

    if (line === '' && cleaned.at(-1) === '') {
      continue;
    }

    cleaned.push(line);
  }

  while (cleaned[0] === '') cleaned.shift();
  while (cleaned.at(-1) === '') cleaned.pop();

  return cleaned.join('\n');
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.inset = '0 auto auto -9999px';
  document.body.append(textarea);
  textarea.select();

  try {
    // `execCommand` is deprecated, and that is the point — this is the fallback
    // for the contexts `navigator.clipboard` does not exist in, notably any
    // non-secure origin. Reached only when the modern path is unavailable, so
    // removing it would silently break copy rather than modernise anything.
    //
    // Called through a cast because the deprecation is carried on the lib.dom
    // signature, and `astro check` surfaces it as a hint on every run. The cast
    // replaces the `Document` type rather than intersecting with it — an
    // intersection leaves the deprecated overload in the set and the hint
    // survives.
    const legacy = document as unknown as {
      execCommand(commandId: string): boolean;
    };
    return legacy.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

async function writeClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through for denied permissions and browsers without a usable secure context.
    }
  }

  return legacyCopy(text);
}

function setButtonState(
  button: HTMLButtonElement,
  state: 'copied' | 'failed',
): void {
  const previousTimer = resetTimers.get(button);
  if (previousTimer) window.clearTimeout(previousTimer);

  button.dataset.copyState = state;
  button.textContent = state === 'copied' ? 'Copied ✓' : 'Copy unavailable';
  button.setAttribute(
    'aria-label',
    state === 'copied'
      ? 'Code copied to clipboard'
      : 'Copy unavailable in this browser',
  );

  const timer = window.setTimeout(() => {
    delete button.dataset.copyState;
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code to clipboard');
    resetTimers.delete(button);
  }, 3000);
  resetTimers.set(button, timer);
}

function addCopyButton(pre: HTMLPreElement): void {
  if (
    pre.hasAttribute('data-copy-disabled') ||
    pre.classList.contains('copy-enabled') ||
    !isMultiline(pre)
  ) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy-button';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code to clipboard');
  button.setAttribute('aria-live', 'polite');

  button.addEventListener('click', async () => {
    const text = clipboardText(pre);
    const copied = text.length > 0 && (await writeClipboard(text));
    setButtonState(button, copied ? 'copied' : 'failed');
  });

  pre.classList.add('copy-enabled');
  pre.append(button);
}

function setupCodeCopyButtons(): void {
  document
    .querySelectorAll<HTMLPreElement>(COPYABLE_BLOCK_SELECTOR)
    .forEach(addCopyButton);
}

setupCodeCopyButtons();
document.addEventListener('astro:page-load', setupCodeCopyButtons);
