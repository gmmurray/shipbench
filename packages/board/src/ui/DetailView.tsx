import type { TaskComment } from '@shipbench/core';
import { orderedTasksForColumn } from '@shipbench/core/layout';
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  RxArchive,
  RxArrowLeft,
  RxCheck,
  RxCopy,
  RxEyeOpen,
  RxPencil1,
  RxPlus,
  RxTrash,
} from 'react-icons/rx';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import { UNCATEGORIZED_STATUS } from '../store/boardStore.js';
import { localDateTime, relativeTime } from '../utils/time.js';
import { ArchiveTaskDialog } from './ArchiveTaskDialog.js';
import { Chevron } from './Chevron.js';
import { Markdown } from './Markdown.js';
import { DependencyMultiSelect, TagInput } from './MetadataInputs.js';
import { Select, type SelectOption } from './Select.js';
import { useAutosizeTextarea } from './useAutosizeTextarea.js';

export function DetailView({ slug }: { slug: string }) {
  const config = useBoardStore(state => state.config);
  const task = useBoardStore(state =>
    state.tasks.find(candidate => candidate.slug === slug),
  );
  const selectTask = useBoardStore(state => state.selectTask);
  const updateTask = useBoardStore(state => state.updateTask);
  const addComment = useBoardStore(state => state.addComment);
  const editComment = useBoardStore(state => state.editComment);
  const deleteComment = useBoardStore(state => state.deleteComment);
  const archiveTask = useBoardStore(state => state.archiveTask);
  const deleteTask = useBoardStore(state => state.deleteTask);
  const readOnly = useBoardStore(state => state.readOnly);
  const tasks = useBoardStore(state => state.tasks);
  const warnings = useBoardStore(state => state.warnings);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const tagSuggestions = useMemo(
    () => tasks.flatMap(candidate => candidate.frontmatter.tags ?? []),
    [tasks],
  );

  const dependentTasks = useMemo(
    () =>
      task
        ? tasks.filter(
            candidate =>
              candidate.slug !== task.slug &&
              candidate.frontmatter.depends_on?.includes(task.slug),
          )
        : [],
    [task, tasks],
  );

  const columnNavigation = useMemo(() => {
    if (!task || !config) {
      return null;
    }

    const validStatuses = new Set(config.columns.map(column => column.id));
    const columnId = validStatuses.has(task.frontmatter.status)
      ? task.frontmatter.status
      : UNCATEGORIZED_STATUS;
    // `done_column` is required, so this can no longer silently disagree with
    // the board's ordering — it used to be omitted here, making j/k navigation
    // through the done column run in a different order than the column shown.
    const siblings = orderedTasksForColumn(
      tasks,
      config.layout,
      columnId,
      validStatuses,
      config.done_column,
    );
    const currentIndex = siblings.findIndex(
      sibling => sibling.slug === task.slug,
    );

    if (siblings.length <= 1 || currentIndex === -1) {
      return null;
    }

    return {
      currentIndex,
      total: siblings.length,
      previousSlug: siblings[currentIndex - 1]?.slug ?? null,
      nextSlug: siblings[currentIndex + 1]?.slug ?? null,
    };
  }, [config, task, tasks]);

  useEffect(() => {
    if (!columnNavigation) {
      return;
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (
        (key === 'k' || event.key === 'ArrowUp') &&
        columnNavigation.previousSlug
      ) {
        event.preventDefault();
        selectTask(columnNavigation.previousSlug);
      }
      if (
        (key === 'j' || event.key === 'ArrowDown') &&
        columnNavigation.nextSlug
      ) {
        event.preventDefault();
        selectTask(columnNavigation.nextSlug);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [columnNavigation, selectTask]);

  if (!task || !config) {
    return (
      <div className="rounded-md border border-sb-iron bg-sb-surface p-6">
        <button
          className="font-mono text-[12px] text-sb-silver transition-colors hover:text-sb-frosted"
          type="button"
          onClick={() => selectTask(null)}
        >
          Tasks
        </button>
        <p className="mt-4 font-mono text-[12px] text-sb-silver">
          Task no longer exists.
        </p>
      </div>
    );
  }

  const statusLabel =
    config.columns.find(column => column.id === task.frontmatter.status)
      ?.label ?? task.frontmatter.status;

  return (
    <section className="mx-auto max-w-7xl">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)]">
        <article className="min-w-0 rounded-md border border-sb-iron bg-sb-surface">
          <div className="border-b border-sb-iron p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex h-8 items-center gap-2 rounded border border-sb-iron px-3 text-[13px] font-medium text-sb-silver transition-colors hover:border-sb-silver hover:text-sb-frosted focus-visible:border-sb-silver focus-visible:text-sb-frosted"
                type="button"
                onClick={() => selectTask(null)}
              >
                <RxArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                Back to board
              </button>
              {columnNavigation ? (
                <ColumnTaskNavigation
                  currentIndex={columnNavigation.currentIndex}
                  total={columnNavigation.total}
                  previousSlug={columnNavigation.previousSlug}
                  nextSlug={columnNavigation.nextSlug}
                  onSelect={selectTask}
                />
              ) : null}
            </div>
            <TitleInput
              readOnly={readOnly}
              value={task.frontmatter.title}
              onChange={value => void updateTask(task.slug, { title: value })}
            />
            <SlugCopyButton slug={task.slug} />
          </div>

          <TaskBodySection
            readOnly={readOnly}
            body={task.body}
            onSave={next => void updateTask(task.slug, {}, next)}
          />
          <TaskUpdatesSection
            readOnly={readOnly}
            comments={task.comments ?? []}
            onAddComment={text => addComment(task.slug, text)}
            onEditComment={(index, text) => editComment(task.slug, index, text)}
            onDeleteComment={index => deleteComment(task.slug, index)}
          />
        </article>

        <aside className="h-fit rounded-md border border-sb-iron bg-sb-surface p-4 lg:sticky lg:top-[calc(var(--sb-header-h)+1.25rem)] lg:max-h-[calc(100vh-var(--sb-header-h)-2.5rem)] lg:self-start lg:overflow-y-auto">
          <div className="space-y-4">
            <Field label="Status">
              <SelectField
                readOnly={readOnly}
                value={task.frontmatter.status}
                ariaLabel="Status"
                statusMarker
                options={config.columns.map(column => ({
                  value: column.id,
                  label: column.label,
                }))}
                readValue={statusLabel}
                onValueChange={value =>
                  void updateTask(task.slug, { status: value })
                }
              />
            </Field>
            <Field label="Priority">
              <SelectField
                readOnly={readOnly}
                value={task.frontmatter.priority ?? ''}
                ariaLabel="Priority"
                emptyOption={{ label: 'None' }}
                options={config.priority.values.map(priority => ({
                  value: priority,
                  label: priority,
                }))}
                readValue={task.frontmatter.priority ?? 'None'}
                onValueChange={value =>
                  void updateTask(task.slug, { priority: value || undefined })
                }
              />
            </Field>
            <MetaInput
              label="Assignee"
              readOnly={readOnly}
              value={task.frontmatter.assignee ?? ''}
              readValue={task.frontmatter.assignee ?? 'Unassigned'}
              onChange={value =>
                void updateTask(task.slug, { assignee: value || undefined })
              }
            />
            <TagInput
              readOnly={readOnly}
              tags={task.frontmatter.tags ?? []}
              suggestions={tagSuggestions}
              onChange={tags => void updateTask(task.slug, { tags })}
            />
            <DependencyMultiSelect
              readOnly={readOnly}
              currentTaskSlug={task.slug}
              dependencies={task.frontmatter.depends_on ?? []}
              tasks={tasks}
              doneColumn={config.done_column}
              warnings={warnings
                .filter(
                  warning =>
                    warning.slug === task.slug &&
                    warning.field === 'depends_on',
                )
                .map(warning => warning.message)}
              onChange={depends_on =>
                void updateTask(task.slug, { depends_on })
              }
            />

            <dl className="space-y-1.5 border-t border-sb-iron pt-4 font-mono text-[11px] text-sb-silver">
              <div className="flex justify-between gap-3">
                <dt>created</dt>
                <dd className="text-right text-sb-frosted">
                  {relativeTime(task.frontmatter.created)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>updated</dt>
                <dd className="text-right text-sb-frosted">
                  {relativeTime(task.frontmatter.updated)}
                </dd>
              </div>
            </dl>

            {readOnly ? null : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded border border-sb-iron text-[13px] font-medium text-sb-silver transition-colors hover:border-sb-silver hover:bg-sb-surface2 hover:text-sb-frosted"
                  type="button"
                  onClick={() => {
                    if (
                      task.frontmatter.status !== config.done_column &&
                      dependentTasks.length > 0
                    ) {
                      setArchiveDialogOpen(true);
                      return;
                    }
                    void archiveTask(task.slug);
                  }}
                >
                  <RxArchive aria-hidden="true" className="h-3.5 w-3.5" />
                  Archive task
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded border border-sb-iron text-[13px] font-medium text-sb-silver transition-colors hover:border-sb-silver hover:bg-sb-surface2 hover:text-sb-frosted"
                  type="button"
                  onClick={() => {
                    if (window.confirm('Delete this task?')) {
                      void deleteTask(task.slug);
                    }
                  }}
                >
                  <RxTrash aria-hidden="true" className="h-3.5 w-3.5" />
                  Delete task
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
      {readOnly ? null : (
        <ArchiveTaskDialog
          open={archiveDialogOpen}
          taskTitle={task.frontmatter.title}
          dependents={dependentTasks}
          onOpenChange={setArchiveDialogOpen}
          onConfirm={() => void archiveTask(task.slug, true)}
        />
      )}
    </section>
  );
}

function ColumnTaskNavigation({
  currentIndex,
  total,
  previousSlug,
  nextSlug,
  onSelect,
}: {
  currentIndex: number;
  total: number;
  previousSlug: string | null;
  nextSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="ml-auto inline-flex items-center gap-2">
      <span className="min-w-10 text-right font-mono text-[11px] tabular-nums text-sb-silver">
        {currentIndex + 1}/{total}
      </span>
      <div className="inline-flex overflow-hidden rounded border border-sb-iron">
        <button
          className="inline-flex h-8 w-8 items-center justify-center text-sb-silver transition-colors hover:bg-sb-surface2 hover:text-sb-frosted focus-visible:bg-sb-surface2 focus-visible:text-sb-frosted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          type="button"
          aria-label="Previous task in column"
          disabled={!previousSlug}
          onClick={() => {
            if (previousSlug) {
              onSelect(previousSlug);
            }
          }}
        >
          <Chevron className="h-2.5 w-2.5 -rotate-90" />
        </button>
        <button
          className="inline-flex h-8 w-8 items-center justify-center border-l border-sb-iron text-sb-silver transition-colors hover:bg-sb-surface2 hover:text-sb-frosted focus-visible:bg-sb-surface2 focus-visible:text-sb-frosted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          type="button"
          aria-label="Next task in column"
          disabled={!nextSlug}
          onClick={() => {
            if (nextSlug) {
              onSelect(nextSlug);
            }
          }}
        >
          <Chevron className="h-2.5 w-2.5 rotate-90" />
        </button>
      </div>
    </div>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  );
}

function SlugCopyButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const copySlug = async () => {
    if (!navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
      resetTimer.current = window.setTimeout(() => {
        setCopied(false);
        resetTimer.current = null;
      }, 1000);
    } catch {
      // Clipboard access can fail in older browsers or insecure contexts.
    }
  };

  return (
    <button
      className="group mt-2 inline-flex max-w-full cursor-copy items-center gap-1.5 rounded border border-transparent py-0.5 pr-2 font-mono text-[11px] text-sb-silver transition-colors hover:border-sb-iron hover:bg-sb-surface2 hover:text-sb-frosted focus-visible:border-sb-silver focus-visible:text-sb-frosted"
      type="button"
      aria-label={copied ? 'Copied task slug' : `Copy task slug ${slug}`}
      aria-live="polite"
      onClick={() => void copySlug()}
    >
      {copied ? (
        <RxCheck aria-hidden="true" className="h-3.5 w-3.5 text-sb-frosted" />
      ) : (
        <RxCopy
          aria-hidden="true"
          className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100"
        />
      )}
      <span className="truncate">{copied ? 'Copied' : slug}</span>
    </button>
  );
}

function TaskBodySection({
  readOnly,
  body,
  onSave,
}: {
  readOnly: boolean;
  body: string;
  onSave: (next: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const showTextarea = isEditing && !readOnly;
  const textareaRef = useAutosizeTextarea(draft, showTextarea);

  useEffect(() => {
    setDraft(body);
  }, [body]);

  const exitEditMode = () => {
    onSave(draft);
    setIsEditing(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return;

    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const nextValue = `${draft.slice(0, start)}  ${draft.slice(end)}`;
    setDraft(nextValue);

    window.requestAnimationFrame(() => {
      target.selectionStart = start + 2;
      target.selectionEnd = start + 2;
    });
  };

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-sb-silver">
          Description
        </h2>
        {readOnly ? null : (
          <button
            className="inline-flex h-8 items-center gap-2 rounded border border-sb-iron px-3 text-[13px] font-medium text-sb-silver transition-colors hover:border-sb-silver hover:text-sb-frosted"
            type="button"
            onClick={() => (isEditing ? exitEditMode() : setIsEditing(true))}
          >
            {isEditing ? (
              <RxEyeOpen aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <RxPencil1 aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {isEditing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      {showTextarea ? (
        <textarea
          aria-label="Task description"
          className="sb-editor min-h-80 w-full resize-none bg-transparent font-sans text-[13px] leading-relaxed text-sb-silver outline-none field-sizing-content placeholder:text-sb-silver"
          spellCheck={false}
          ref={textareaRef}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
      ) : (
        <div className="sb-markdown max-w-none">
          {body.trim() ? (
            <Markdown>{body}</Markdown>
          ) : (
            <p className="font-mono text-[12px] text-sb-silver">
              No description yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TaskUpdatesSection({
  readOnly,
  comments,
  onAddComment,
  onEditComment,
  onDeleteComment,
}: {
  readOnly: boolean;
  comments: TaskComment[];
  onAddComment: (text: string) => Promise<boolean>;
  onEditComment: (index: number, text: string) => Promise<boolean>;
  onDeleteComment: (index: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(
    null,
  );
  const canSubmit = draft.trim().length > 0 && !isSubmitting;

  if (comments.length === 0 && readOnly) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const submittedText = draft;
    setDraft('');
    setIsSubmitting(true);
    const saved = await onAddComment(submittedText);
    if (!saved) setDraft(submittedText);
    setIsSubmitting(false);
  };

  const beginEdit = (index: number) => {
    setConfirmDeleteIndex(null);
    setEditingIndex(index);
    setEditDraft(comments[index]?.text ?? '');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDraft('');
  };

  const handleEdit = async (
    event: FormEvent<HTMLFormElement>,
    index: number,
  ) => {
    event.preventDefault();
    if (!editDraft.trim() || isEditing) return;

    setIsEditing(true);
    const saved = await onEditComment(index, editDraft);
    if (saved) cancelEdit();
    setIsEditing(false);
  };

  const handleDelete = async (index: number) => {
    setConfirmDeleteIndex(null);
    await onDeleteComment(index);
  };

  return (
    <section
      className="border-t border-sb-divider p-5"
      aria-label="Task Updates"
    >
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-sb-silver">
          Task Updates
        </h2>
        <span className="h-px flex-1 bg-sb-divider" aria-hidden="true" />
        <span className="font-mono text-[11px] text-sb-silver">
          {comments.length}
        </span>
      </div>
      {comments.length > 0 ? (
        <ol className="grid gap-5">
          {comments.map((comment, index) => (
            <li
              className="border-t border-sb-divider pt-5 first:border-t-0 first:pt-0"
              key={`${comment.timestamp}-${index}`}
            >
              <div className="flex min-h-9 items-center justify-between gap-3">
                <time
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-sb-frosted"
                  dateTime={comment.timestamp}
                  title={comment.timestamp}
                >
                  {localDateTime(comment.timestamp)}
                </time>
                {readOnly || editingIndex === index ? null : (
                  <div className="flex shrink-0 items-center gap-2">
                    {confirmDeleteIndex === index ? (
                      <>
                        <button
                          className="inline-flex min-h-9 items-center rounded px-2 text-[13px] font-medium text-sb-silver transition-colors hover:text-sb-frosted"
                          type="button"
                          onClick={() => setConfirmDeleteIndex(null)}
                        >
                          Cancel
                        </button>
                        <button
                          aria-label={`Confirm delete task update ${index + 1}`}
                          className="inline-flex min-h-9 items-center gap-2 rounded border border-sb-danger px-2 text-[13px] font-medium text-sb-danger transition-colors hover:bg-sb-danger/10"
                          type="button"
                          onClick={() => void handleDelete(index)}
                        >
                          <RxTrash aria-hidden="true" className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          aria-label={`Edit task update ${index + 1}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded text-sb-silver transition-colors hover:bg-sb-surface2 hover:text-sb-frosted"
                          type="button"
                          onClick={() => beginEdit(index)}
                        >
                          <RxPencil1
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                        </button>
                        <button
                          aria-label={`Delete task update ${index + 1}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded text-sb-silver transition-colors hover:bg-sb-surface2 hover:text-sb-danger"
                          type="button"
                          onClick={() => {
                            setEditingIndex(null);
                            setConfirmDeleteIndex(index);
                          }}
                        >
                          <RxTrash aria-hidden="true" className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editingIndex === index ? (
                <form
                  className="mt-2"
                  onSubmit={event => void handleEdit(event, index)}
                >
                  <textarea
                    aria-label={`Task update ${index + 1} text`}
                    className="min-h-24 w-full resize-y rounded border border-sb-iron bg-sb-surface2 px-3 py-2 font-sans text-[13px] leading-relaxed text-sb-frosted outline-none transition-colors hover:border-sb-ironlit focus-visible:border-sb-accent disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isEditing}
                    value={editDraft}
                    onChange={event => setEditDraft(event.target.value)}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      className="inline-flex min-h-9 items-center rounded border border-sb-iron px-3 text-[13px] font-medium text-sb-frosted transition-colors hover:border-sb-ironlit hover:bg-sb-surface2 disabled:cursor-not-allowed disabled:opacity-40"
                      type="button"
                      disabled={isEditing}
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                    <button
                      className="inline-flex min-h-9 items-center gap-2 rounded bg-sb-accent px-3 text-[13px] font-semibold text-sb-canvas transition-colors hover:bg-sb-accent-hover active:bg-sb-accent-pressed disabled:cursor-not-allowed disabled:opacity-40"
                      type="submit"
                      disabled={!editDraft.trim() || isEditing}
                    >
                      <RxCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      {isEditing ? 'Saving…' : 'Save update'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="sb-markdown mt-2 max-w-none">
                  <Markdown>{comment.text}</Markdown>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="font-mono text-[12px] text-sb-silver">
          No task updates yet.
        </p>
      )}

      {readOnly ? null : (
        <form
          className="mt-5 border-t border-sb-iron pt-5"
          onSubmit={event => void handleSubmit(event)}
        >
          <label
            className="mb-2 block font-mono text-[11px] uppercase tracking-[0.14em] text-sb-silver"
            htmlFor="task-update-text"
          >
            Add a task update
          </label>
          <textarea
            id="task-update-text"
            aria-label="Task update text"
            className="min-h-20 w-full resize-y rounded border border-sb-iron bg-sb-surface2 px-3 py-2 font-sans text-[13px] leading-relaxed text-sb-frosted outline-none transition-colors placeholder:text-sb-silver/60 hover:border-sb-ironlit focus-visible:border-sb-accent disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isSubmitting}
            placeholder="A decision, scope change, or why something changed"
            value={draft}
            onChange={event => setDraft(event.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-[13px] text-sb-silver">
              Time-stamped by ShipBench. Keep timeless details in the
              description.
            </p>
            <button
              className="inline-flex h-9 items-center gap-2 rounded bg-sb-accent px-3 text-[13px] font-semibold text-sb-canvas transition-colors hover:bg-sb-accent-hover active:bg-sb-accent-pressed disabled:cursor-not-allowed disabled:opacity-40"
              type="submit"
              disabled={!canSubmit}
            >
              <RxPlus aria-hidden="true" className="h-3.5 w-3.5" />
              {isSubmitting ? 'Adding…' : 'Add task update'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function SelectField({
  readOnly,
  value,
  ariaLabel,
  options,
  emptyOption,
  statusMarker,
  readValue,
  onValueChange,
}: {
  readOnly: boolean;
  value: string;
  ariaLabel: string;
  options: SelectOption[];
  emptyOption?: { label: string };
  statusMarker?: boolean;
  readValue: string;
  onValueChange: (value: string) => void;
}) {
  if (readOnly) {
    return <ReadonlyValue>{readValue}</ReadonlyValue>;
  }
  return (
    <Select
      value={value}
      ariaLabel={ariaLabel}
      options={options}
      emptyOption={emptyOption}
      statusMarker={statusMarker}
      onValueChange={onValueChange}
    />
  );
}

function ReadonlyValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="min-h-9 rounded border border-sb-iron bg-sb-surface2 px-3 py-2 font-mono text-[12px] text-sb-frosted">
      {children}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-sb-silver">
        {label}
      </span>
      {children}
    </div>
  );
}

function TitleInput({
  readOnly,
  value,
  onChange,
}: {
  readOnly: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (readOnly) {
    return (
      <h1 className="font-sans text-xl font-semibold text-sb-frosted">
        {value}
      </h1>
    );
  }

  return (
    <input
      className="sb-editor w-full bg-transparent font-sans text-xl font-semibold text-sb-frosted outline-none placeholder:text-sb-silver"
      aria-label="Task title"
      value={draft}
      onBlur={() => {
        if (draft.trim() && draft !== value) {
          onChange(draft.trim());
        }
      }}
      onChange={event => setDraft(event.target.value)}
    />
  );
}

function MetaInput({
  label,
  readOnly,
  value,
  readValue,
  onChange,
}: {
  label: string;
  readOnly: boolean;
  value: string;
  readValue: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const inputId = useId();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (readOnly) {
    return (
      <Field label={label}>
        <ReadonlyValue>{readValue}</ReadonlyValue>
      </Field>
    );
  }

  return (
    <div className="grid gap-1.5">
      <label
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-sb-silver"
        htmlFor={inputId}
      >
        {label}
      </label>
      <input
        id={inputId}
        className="h-9 rounded border border-sb-iron bg-sb-surface2 px-3 font-mono text-[12px] text-sb-frosted outline-none transition-colors hover:border-sb-silver focus:border-sb-silver"
        value={draft}
        onBlur={() => onChange(draft)}
        onChange={event => setDraft(event.target.value)}
      />
    </div>
  );
}
