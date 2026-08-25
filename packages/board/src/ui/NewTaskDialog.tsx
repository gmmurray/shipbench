import * as Dialog from '@radix-ui/react-dialog';
import {
  type KeyboardEvent,
  type ReactNode,
  type SubmitEvent,
  useRef,
  useState,
} from 'react';
import { RxCross2, RxPlus } from 'react-icons/rx';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import { Select } from './Select.js';

export function NewTaskDialog({
  initialStatus,
  trigger,
}: {
  initialStatus?: string;
  trigger?: ReactNode;
} = {}) {
  const config = useBoardStore(state => state.config);
  const createTask = useBoardStore(state => state.createTask);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [addAnother, setAddAnother] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const hasInitialStatus = Boolean(
    initialStatus &&
      config?.columns.some(column => column.id === initialStatus),
  );
  const defaultStatus =
    hasInitialStatus && initialStatus
      ? initialStatus
      : (config?.default_column ?? config?.columns.at(0)?.id ?? '');
  const selectedStatus = status || defaultStatus;

  const reset = () => {
    setTitle('');
    setStatus('');
    setPriority('');
    setAddAnother(false);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    void createTask(trimmed, {
      status: selectedStatus || undefined,
      priority: priority || undefined,
    });

    if (addAnother) {
      setTitle('');
      window.requestAnimationFrame(() => titleInputRef.current?.focus());
      return;
    }

    setOpen(false);
    reset();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded bg-sb-accent px-3 text-[13px] font-semibold text-sb-canvas transition-colors hover:bg-sb-accent-hover active:bg-sb-accent-pressed"
            type="button"
          >
            <RxPlus aria-hidden="true" className="h-3.5 w-3.5" />
            New task
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-sb-iron bg-sb-surface p-5 outline-none"
          onOpenAutoFocus={event => {
            event.preventDefault();
            titleInputRef.current?.focus();
          }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-sb-frosted">
                New task
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] text-sb-silver">
                Add a task to the board. You can edit details after creating.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="rounded p-1 text-sb-silver transition-colors hover:text-sb-frosted"
                type="button"
              >
                <RxCross2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form
            className="grid gap-4"
            onKeyDown={onKeyDown}
            onSubmit={onSubmit}
          >
            <label className="grid gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-sb-silver">
                Title
              </span>
              <input
                ref={titleInputRef}
                className="h-9 rounded border border-sb-iron bg-sb-surface2 px-3 font-mono text-[12px] text-sb-frosted outline-none transition-colors placeholder:text-sb-silver hover:border-sb-silver focus:border-sb-silver"
                placeholder="Setup auth"
                value={title}
                onChange={event => setTitle(event.target.value)}
              />
            </label>

            <div className="grid gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-sb-silver">
                Status
              </span>
              <Select
                value={selectedStatus}
                ariaLabel="Status"
                statusMarker
                placeholder={
                  config?.columns.find(
                    column => column.id === config.default_column,
                  )?.label ??
                  config?.columns.at(0)?.label ??
                  '—'
                }
                options={
                  config?.columns.map(column => ({
                    value: column.id,
                    label: column.label,
                  })) ?? []
                }
                onValueChange={setStatus}
              />
            </div>

            <div className="grid gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-sb-silver">
                Priority
              </span>
              <Select
                value={priority}
                ariaLabel="Priority"
                placeholder={config?.priority.default ?? '—'}
                options={
                  config?.priority.values.map(value => ({
                    value,
                    label: value,
                  })) ?? []
                }
                onValueChange={setPriority}
              />
            </div>

            <div className="mt-2 flex items-center justify-end gap-2">
              <label className="mr-auto inline-flex h-9 items-center gap-2 text-[13px] text-sb-silver">
                <input
                  className="h-4 w-4 accent-sb-silver"
                  type="checkbox"
                  checked={addAnother}
                  onChange={event => setAddAnother(event.target.checked)}
                />
                Add another
              </label>
              <Dialog.Close asChild>
                <button
                  className="h-9 rounded border border-sb-iron bg-transparent px-3 text-[13px] font-medium text-sb-frosted transition-colors hover:border-sb-silver hover:bg-sb-surface2"
                  type="button"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                className="h-9 rounded bg-sb-accent px-4 text-[13px] font-semibold text-sb-canvas transition-colors hover:bg-sb-accent-hover active:bg-sb-accent-pressed disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!title.trim()}
                type="submit"
              >
                Create task
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
