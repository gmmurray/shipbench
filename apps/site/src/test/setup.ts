import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeAll } from 'vitest';

// jsdom has no layout engine and no dialog top layer. These stubs are the
// documented limit of component-level testing here: `showModal` is faked, so
// the focus trap it normally provides is NOT under test. That belongs to
// add-a-playwright-browser-verification-harness-for-shipbench-dev.
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    value: () => {},
    configurable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value(this: HTMLDialogElement) {
      this.open = true;
    },
    configurable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
});
