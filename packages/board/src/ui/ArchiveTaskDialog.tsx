import * as Dialog from '@radix-ui/react-dialog';
import type { Task } from '@shipbench/core';
import { RxArchive, RxCross2 } from 'react-icons/rx';

export function ArchiveTaskDialog({
  open,
  taskTitle,
  dependents,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  taskTitle: string;
  dependents: Task[];
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-sb-iron bg-sb-surface p-5 outline-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-sb-frosted">
                Archive task?
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] leading-relaxed text-sb-silver">
                “{taskTitle}” is not done, and these live tasks depend on it:
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

          <ul
            aria-label="Tasks depending on this task"
            className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded border border-sb-iron bg-sb-surface2 p-3"
          >
            {dependents.map(dependent => (
              <li className="min-w-0" key={dependent.slug}>
                <p className="truncate text-[13px] text-sb-frosted">
                  {dependent.frontmatter.title}
                </p>
                <p className="truncate font-mono text-[11px] text-sb-silver">
                  {dependent.slug}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[12px] leading-relaxed text-sb-silver">
            Archive anyway only if you intend to treat this dependency as
            satisfied.
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                className="h-9 rounded border border-sb-iron bg-transparent px-3 text-[13px] font-medium text-sb-frosted transition-colors hover:border-sb-silver hover:bg-sb-surface2"
                type="button"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              className="inline-flex h-9 items-center gap-2 rounded bg-sb-accent px-4 text-[13px] font-semibold text-sb-canvas transition-colors hover:bg-sb-accent-hover active:bg-sb-accent-pressed"
              type="button"
              onClick={() => {
                onOpenChange(false);
                onConfirm();
              }}
            >
              <RxArchive aria-hidden="true" className="h-3.5 w-3.5" />
              Archive anyway
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
