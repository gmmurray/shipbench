// Bundled fonts for the self-contained standalone build. Embedded hosts
// (Harbor) load the same families themselves, so the library entry
// (index.tsx) deliberately does not import these.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/intel-one-mono/400.css';
import '@fontsource/intel-one-mono/500.css';
import '@fontsource/intel-one-mono/600.css';
import '@fontsource/intel-one-mono/700.css';
import type { BoardAPI, TaskFrontmatter } from '@shipbench/core';
import { createBoard } from './index.js';
import { applyStoredBoardTheme } from './ui/BoardThemeToggle.js';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function jsonBody(value: unknown): RequestInit {
  return {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  };
}

const api: BoardAPI = {
  getConfig: () => request('/api/config'),
  listTasks: () => request('/api/tasks'),
  listArchivedTasks: () => request('/api/tasks/archived'),
  createTask: (title: string, fields?: Partial<TaskFrontmatter>) =>
    request('/api/tasks', {
      method: 'POST',
      ...jsonBody({ title, fields }),
    }),
  updateTask: (slug: string, fields: Partial<TaskFrontmatter>, body?: string) =>
    request(`/api/tasks/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      ...jsonBody({ fields, body }),
    }),
  addComment: (slug: string, text: string) =>
    request(`/api/tasks/${encodeURIComponent(slug)}/comments`, {
      method: 'POST',
      ...jsonBody({ text }),
    }),
  editComment: (slug: string, index: number, text: string) =>
    request(
      `/api/tasks/${encodeURIComponent(slug)}/comments/${encodeURIComponent(index)}`,
      {
        method: 'PATCH',
        ...jsonBody({ text }),
      },
    ),
  deleteComment: (slug: string, index: number) =>
    request(
      `/api/tasks/${encodeURIComponent(slug)}/comments/${encodeURIComponent(index)}`,
      { method: 'DELETE' },
    ),
  async moveTask(slug: string, toStatus: string) {
    const result = await this.reorderTask(slug, toStatus, -1);
    return result.task;
  },
  reorderTask: (slug: string, toStatus: string, position: number) =>
    request(`/api/tasks/${encodeURIComponent(slug)}/reorder`, {
      method: 'POST',
      ...jsonBody({ toStatus, position }),
    }),
  archiveTask: (slug: string, options?: { force?: boolean }) =>
    request(`/api/tasks/${encodeURIComponent(slug)}/archive`, {
      method: 'POST',
      ...jsonBody(options ?? {}),
    }),
  unarchiveTask: (slug: string) =>
    request(`/api/tasks/${encodeURIComponent(slug)}/unarchive`, {
      method: 'POST',
    }),
  deleteTask: (slug: string) =>
    request(`/api/tasks/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
  onTasksChanged(callback: () => void) {
    const events = new EventSource('/api/events');
    events.addEventListener('tasks-changed', callback);
    return () => events.close();
  },
  // `resolveRepoLink` is deliberately absent. The files a task links to are on
  // disk, but every way to open them costs something the CLI board should not
  // pay: an editor deep link (`vscode://file/…`) assumes an editor, and serving
  // them turns the board server into an arbitrary-repo-file server. Repo links
  // render as plain visible paths instead — honest, and readable enough to act
  // on. Harbor, which has a real destination, implements the method.
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No #root element found in index.html.');

// Honor a persisted theme override before first render (System follows the OS
// via CSS with no script).
applyStoredBoardTheme();

createBoard(rootElement, { api, themeControl: true });
