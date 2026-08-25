// @vitest-environment jsdom

import type { BoardAPI, ShipbenchConfig } from '@shipbench/core';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardStoreProvider } from '../store/BoardStoreProvider.js';
import { SyncEffects } from './SyncEffects.js';

const POLL_INTERVAL_MS = 60_000;

const config: ShipbenchConfig = {
  version: 1,
  name: 'Test Project',
  columns: [{ id: 'todo', label: 'To Do' }],
  default_column: 'todo',
  done_column: 'todo',
  done_display: { max: 20 },
  priority: { values: ['medium'], default: 'medium' },
  schema: { custom_fields: {} },
  layout: {},
};

function makeApi(overrides: Partial<BoardAPI> = {}): BoardAPI {
  return {
    getConfig: vi.fn(async () => config),
    listTasks: vi.fn(async () => ({ tasks: [], warnings: [] })),
    listArchivedTasks: vi.fn(async () => ({ tasks: [], warnings: [] })),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    addComment: vi.fn(),
    editComment: vi.fn(),
    deleteComment: vi.fn(),
    moveTask: vi.fn(),
    reorderTask: vi.fn(),
    archiveTask: vi.fn(),
    unarchiveTask: vi.fn(),
    deleteTask: vi.fn(),
    ...overrides,
  };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function mount(api: BoardAPI) {
  return render(
    <BoardStoreProvider api={api}>
      <SyncEffects api={api} />
    </BoardStoreProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  setVisibility('visible');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SyncEffects', () => {
  it('polls every 60s when the tab is visible and onTasksChanged is not provided', () => {
    const api = makeApi();
    mount(api);

    expect(api.listTasks).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(api.listTasks).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 2);
    });
    expect(api.listTasks).toHaveBeenCalledTimes(3);
  });

  it('skips the poll tick when the tab is hidden', () => {
    const api = makeApi();
    mount(api);

    setVisibility('hidden');
    // The visibilitychange->hidden should not refresh, and the interval tick
    // that follows should also be a no-op.
    expect(api.listTasks).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(api.listTasks).not.toHaveBeenCalled();
  });

  it('refreshes when the tab returns to visible', () => {
    const api = makeApi();
    mount(api);

    setVisibility('hidden');
    expect(api.listTasks).not.toHaveBeenCalled();

    act(() => {
      setVisibility('visible');
    });
    expect(api.listTasks).toHaveBeenCalledTimes(1);
  });

  it('uses onTasksChanged instead of polling when the api provides it', () => {
    const unsubscribe = vi.fn();
    const onTasksChanged = vi.fn(() => unsubscribe);
    const api = makeApi({ onTasksChanged });

    mount(api);

    expect(onTasksChanged).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 5);
    });
    expect(api.listTasks).not.toHaveBeenCalled();
  });

  it('refreshes when the onTasksChanged callback fires', () => {
    let fire: (() => void) | undefined;
    const onTasksChanged = vi.fn((cb: () => void) => {
      fire = cb;
      return () => {};
    });
    const api = makeApi({ onTasksChanged });

    mount(api);

    expect(fire).toBeDefined();
    act(() => {
      fire?.();
    });
    expect(api.listTasks).toHaveBeenCalledTimes(1);
  });

  it('cleans up interval, visibility listener, and onTasksChanged subscription on unmount', () => {
    const unsubscribe = vi.fn();
    const withSubscription = makeApi({
      onTasksChanged: vi.fn(() => unsubscribe),
    });
    const subscribed = mount(withSubscription);
    subscribed.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    const withPolling = makeApi();
    const polling = mount(withPolling);
    polling.unmount();

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
      setVisibility('hidden');
      setVisibility('visible');
    });
    expect(withPolling.listTasks).not.toHaveBeenCalled();
  });
});
