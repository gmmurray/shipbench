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

/**
 * Whether this block offers a copy button.
 *
 * Copyable is the default, and both opt-outs are written at the source: the
 * `copyable` prop on CodeBlock.astro emits `data-copy-disabled`, and a
 * ```bash no-copy fence emits `data-copy="false"` through the Shiki
 * transformer in src/utils/shiki-copy-meta.mjs.
 *
 * This replaces an `isMultiline()` check that stood in for "is this runnable?"
 * and was wrong in both directions - single-line commands a reader would
 * actually run had no button, while an illustrative multi-line block did.
 */
function isCopyable(pre: HTMLPreElement): boolean {
  return !pre.hasAttribute('data-copy-disabled') && pre.dataset.copy !== 'false';
}

/**
 * The block's language, for the header strip's label. Markdown fences carry
 * `data-language` from Shiki; a CodeBlock.astro block carries none and gets no
 * label rather than a guessed one.
 *
 * `text` and `plaintext` are the fences that opt out of highlighting - a
 * directory tree, a table of values. Naming them "TEXT" above the block adds a
 * word without adding information, so they render with the strip but no label.
 */
const UNLABELLED_LANGUAGES = new Set(['plaintext', 'text']);

function languageLabel(pre: HTMLPreElement): string | null {
  const language = pre.dataset.language;
  return language && !UNLABELLED_LANGUAGES.has(language) ? language : null;
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
  if (pre.classList.contains('copy-enabled') || !isCopyable(pre)) {
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

  // A header strip above the code, rather than a button floating over it.
  //
  // The button used to sit `position: absolute; top: 8px; right: 8px` inside
  // the shell, which put its 36px band across the first code line's 16px band
  // on every block - measured, not assumed - and covered actual command text on
  // more than half the docs blocks. Because `.prose pre code` sets
  // `min-width: max-content` those lines scroll rather than wrap, so the reader
  // could not read what sat underneath without scrolling it out from under the
  // button. Reveal-on-hover is no answer on the viewport where it hurts most.
  //
  // The strip still lives in the shell rather than the scrolling `<pre>`, so the
  // button holds position while the code scrolls - the property
  // e2e/docs-rendering.spec.ts pins. It also gives the touch target room to meet
  // the 44px minimum the site's other mobile controls are held to, and a home
  // for the language label, matching the `.quickstart-head` strip the landing
  // page already puts above its code.
  const shell = document.createElement('div');
  shell.className = 'code-block-shell';

  const head = document.createElement('div');
  head.className = 'code-block-head';

  const language = languageLabel(pre);
  if (language) {
    const label = document.createElement('span');
    label.className = 'code-block-lang';
    label.textContent = language;
    head.append(label);
  }

  head.append(button);

  pre.classList.add('copy-enabled');
  pre.before(shell);
  shell.append(head, pre);
}

function setupCodeCopyButtons(): void {
  document
    .querySelectorAll<HTMLPreElement>(COPYABLE_BLOCK_SELECTOR)
    .forEach(addCopyButton);
}

setupCodeCopyButtons();
document.addEventListener('astro:page-load', setupCodeCopyButtons);
