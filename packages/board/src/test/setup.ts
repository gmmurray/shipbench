import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // Sonner's toast store is module-level, so `cleanup()` does not reach it. A
  // toast raised by one test stays *active* — its dismiss timer belongs to the
  // Toaster that just got unmounted — and sonner replays still-active toasts to
  // every new subscriber, so the next `render()` mounts a Toaster already
  // holding the previous test's toasts. Dismissing marks them inactive, which
  // is what stops the replay.
  toast.dismiss();
});
