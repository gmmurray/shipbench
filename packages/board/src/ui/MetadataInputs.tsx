import type { Task } from '@shipbench/core';
import { type KeyboardEvent, useId, useMemo, useState } from 'react';
import {
  RxCheckCircled,
  RxCircle,
  RxCross2,
  RxQuestionMarkCircled,
} from 'react-icons/rx';

type DependencyState = 'ready' | 'gating' | 'missing';

const DEPENDENCY_PRESENTATION: Record<
  DependencyState,
  { label: string; Icon: typeof RxCheckCircled }
> = {
  ready: { label: 'Ready', Icon: RxCheckCircled },
  gating: { label: 'Still gating', Icon: RxCircle },
  missing: { label: 'Missing', Icon: RxQuestionMarkCircled },
};

export function TagInput({
  readOnly,
  tags,
  suggestions,
  onChange,
}: {
  readOnly: boolean;
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const inputId = useId();
  const listboxId = `${inputId}-suggestions`;
  const helpId = `${inputId}-help`;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState('');

  const availableSuggestions = useMemo(() => {
    const selected = new Set(tags.map(tag => tag.toLocaleLowerCase()));
    const unique = new Map<string, string>();

    for (const suggestion of suggestions) {
      const trimmed = suggestion.trim();
      const normalized = trimmed.toLocaleLowerCase();
      if (trimmed && !selected.has(normalized) && !unique.has(normalized)) {
        unique.set(normalized, trimmed);
      }
    }

    const normalizedQuery = query.trim().toLocaleLowerCase();
    return [...unique.values()]
      .filter(suggestion =>
        normalizedQuery
          ? suggestion.toLocaleLowerCase().includes(normalizedQuery)
          : true,
      )
      .sort((a, b) => a.localeCompare(b));
  }, [query, suggestions, tags]);

  const addTag = (candidate: string) => {
    const tag = candidate.trim();
    if (!tag) return false;

    if (
      tags.some(
        existing => existing.toLocaleLowerCase() === tag.toLocaleLowerCase(),
      )
    ) {
      setAnnouncement(`${tag} is already selected.`);
      setQuery('');
      setActiveIndex(-1);
      return false;
    }

    onChange([...tags, tag]);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
    setAnnouncement(`Added tag ${tag}.`);
    return true;
  };

  const removeTag = (index: number) => {
    const tag = tags[index];
    if (!tag) return;
    onChange(tags.filter((_, candidateIndex) => candidateIndex !== index));
    setActiveIndex(-1);
    setAnnouncement(`Removed tag ${tag}.`);
  };

  const commitCurrent = () =>
    addTag(
      activeIndex >= 0 && isOpen
        ? (availableSuggestions[activeIndex] ?? query)
        : query,
    );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && availableSuggestions.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index => (index + 1) % availableSuggestions.length);
      return;
    }

    if (event.key === 'ArrowUp' && availableSuggestions.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index =>
        index <= 0 ? availableSuggestions.length - 1 : index - 1,
      );
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'Backspace' && !query && tags.length) {
      event.preventDefault();
      removeTag(tags.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ',') {
      if (query.trim() || activeIndex >= 0) {
        event.preventDefault();
        commitCurrent();
      }
      return;
    }

    if (event.key === 'Tab' && (query.trim() || activeIndex >= 0)) {
      commitCurrent();
    }
  };

  if (readOnly) {
    return (
      <MetadataField label="Tags">
        {tags.length ? (
          <ul
            className="flex min-h-9 flex-wrap items-center gap-1.5"
            aria-label="Task tags"
          >
            {tags.map(tag => (
              <li className="sb-metadata-token" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <ReadonlyEmpty />
        )}
      </MetadataField>
    );
  }

  const activeSuggestion =
    activeIndex >= 0 ? availableSuggestions[activeIndex] : undefined;

  return (
    <div className="relative grid gap-1.5">
      <label className="sb-metadata-label" htmlFor={inputId}>
        Tags
      </label>
      <span id={helpId} className="font-mono text-[11px] text-sb-silver">
        Enter, comma, or Tab adds a tag.
      </span>
      <div className="sb-form-control flex flex-wrap items-center gap-1.5 px-2 py-1.5">
        {tags.map((tag, index) => (
          <span
            className="sb-metadata-token inline-flex items-center gap-1"
            key={tag}
          >
            <span>{tag}</span>
            <button
              className="sb-token-action"
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => removeTag(index)}
            >
              <RxCross2 aria-hidden="true" className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          className="min-w-20 flex-1 bg-transparent py-0.5 font-mono text-[12px] text-sb-frosted outline-none placeholder:text-sb-silver"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-describedby={helpId}
          aria-expanded={isOpen && availableSuggestions.length > 0}
          aria-activedescendant={
            activeSuggestion ? `${listboxId}-${activeIndex}` : undefined
          }
          autoComplete="off"
          placeholder={tags.length ? 'Add tag' : 'Add tags'}
          value={query}
          onBlur={() => setIsOpen(false)}
          onChange={event => {
            setQuery(event.target.value.replaceAll(',', ''));
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>
      {isOpen && availableSuggestions.length ? (
        <div
          id={listboxId}
          className="sb-combobox-list"
          role="listbox"
          aria-label="Tag suggestions"
        >
          {availableSuggestions.map((suggestion, index) => (
            <button
              id={`${listboxId}-${index}`}
              className="sb-combobox-option block w-full text-left"
              role="option"
              aria-selected={index === activeIndex}
              key={suggestion}
              type="button"
              tabIndex={-1}
              onMouseDown={event => event.preventDefault()}
              onClick={() => addTag(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <LiveAnnouncement>{announcement}</LiveAnnouncement>
    </div>
  );
}

export function DependencyMultiSelect({
  readOnly,
  currentTaskSlug,
  dependencies,
  tasks,
  doneColumn,
  warnings,
  onChange,
}: {
  readOnly: boolean;
  currentTaskSlug: string;
  dependencies: string[];
  tasks: Task[];
  doneColumn: string;
  warnings: string[];
  onChange: (dependencies: string[]) => void;
}) {
  const inputId = useId();
  const listboxId = `${inputId}-tasks`;
  const helpId = `${inputId}-help`;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState('');

  const taskBySlug = useMemo(
    () => new Map(tasks.map(task => [task.slug, task])),
    [tasks],
  );
  const candidates = useMemo(() => {
    const selected = new Set(dependencies);
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) return [];

    return tasks
      .filter(task => task.slug !== currentTaskSlug && !selected.has(task.slug))
      .filter(task => {
        return `${task.slug} ${task.frontmatter.title}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }, [currentTaskSlug, dependencies, query, tasks]);

  const addDependency = (task: Task) => {
    onChange([...dependencies, task.slug]);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
    setAnnouncement(`Added dependency ${task.slug}.`);
  };

  const removeDependency = (dependency: string) => {
    onChange(dependencies.filter(candidate => candidate !== dependency));
    setActiveIndex(-1);
    setAnnouncement(`Removed dependency ${dependency}.`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && candidates.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index => (index + 1) % candidates.length);
      return;
    }

    if (event.key === 'ArrowUp' && candidates.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index => (index <= 0 ? candidates.length - 1 : index - 1));
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      const candidate = candidates[activeIndex];
      if (candidate) {
        event.preventDefault();
        addDependency(candidate);
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'Backspace' && !query && dependencies.length) {
      event.preventDefault();
      const dependency = dependencies.at(-1);
      if (dependency) removeDependency(dependency);
    }
  };

  const selectedTokens = dependencies.length ? (
    <ul className="grid gap-1.5" aria-label="Selected dependencies">
      {dependencies.map(dependency => {
        const task = taskBySlug.get(dependency);
        const state = getDependencyState(task, doneColumn);
        const { label, Icon } = DEPENDENCY_PRESENTATION[state];

        return (
          <li
            className={`sb-metadata-token flex min-w-0 items-center gap-2 ${
              state === 'ready' ? '' : 'border-sb-ironlit'
            }`}
            key={dependency}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{dependency}</span>
            <span className="shrink-0 text-[11px]">{label}</span>
            {readOnly ? null : (
              <button
                className="sb-token-action"
                type="button"
                aria-label={`Remove dependency ${dependency}`}
                onClick={() => removeDependency(dependency)}
              >
                <RxCross2 aria-hidden="true" className="h-3 w-3" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  ) : (
    <ReadonlyEmpty />
  );

  return (
    <div className="relative grid gap-1.5">
      {readOnly ? (
        <span className="sb-metadata-label">Depends on</span>
      ) : (
        <label className="sb-metadata-label" htmlFor={inputId}>
          Depends on
        </label>
      )}
      {readOnly ? null : (
        <>
          <span id={helpId} className="font-mono text-[11px] text-sb-silver">
            Search tasks, then use arrow keys and Enter to select.
          </span>
          <div className="sb-form-control flex items-center gap-2 px-3 py-2">
            <input
              id={inputId}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-sb-frosted outline-none placeholder:text-sb-silver"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-describedby={helpId}
              aria-expanded={isOpen && query.trim().length > 0}
              aria-activedescendant={
                activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
              }
              autoComplete="off"
              placeholder="Search tasks"
              value={query}
              onBlur={() => setIsOpen(false)}
              onChange={event => {
                setQuery(event.target.value);
                setIsOpen(true);
                setActiveIndex(-1);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={onKeyDown}
            />
          </div>
          {isOpen && query.trim() ? (
            <div
              className="sb-combobox-list"
              id={listboxId}
              role="listbox"
              aria-label="Task suggestions"
            >
              {candidates.length ? (
                candidates.map((candidate, index) => {
                  const state = getDependencyState(candidate, doneColumn);
                  const { label, Icon } = DEPENDENCY_PRESENTATION[state];

                  return (
                    <button
                      id={`${listboxId}-${index}`}
                      className="sb-combobox-option grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 text-left"
                      role="option"
                      aria-selected={index === activeIndex}
                      key={candidate.slug}
                      type="button"
                      tabIndex={-1}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => addDependency(candidate)}
                    >
                      <span className="truncate text-sb-frosted">
                        {candidate.slug}
                      </span>
                      <span className="row-span-2 inline-flex items-center gap-1.5 text-[11px] text-sb-silver">
                        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                        {label}
                      </span>
                      <span className="truncate text-[11px] text-sb-silver">
                        {candidate.frontmatter.title}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p
                  className="px-3 py-2 font-mono text-[11px] text-sb-silver"
                  role="status"
                >
                  No matching tasks.
                </p>
              )}
            </div>
          ) : null}
        </>
      )}
      {selectedTokens}
      {warnings.map(message => (
        <p
          key={message}
          className="font-mono text-[11px] leading-5 text-sb-frosted"
          role="alert"
        >
          {message}
        </p>
      ))}
      <LiveAnnouncement>{announcement}</LiveAnnouncement>
    </div>
  );
}

function getDependencyState(
  task: Task | undefined,
  doneColumn: string,
): DependencyState {
  if (!task) return 'missing';
  return task.frontmatter.status === doneColumn ? 'ready' : 'gating';
}

function MetadataField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="sb-metadata-label">{label}</span>
      {children}
    </div>
  );
}

function ReadonlyEmpty() {
  return (
    <span className="min-h-9 rounded border border-sb-iron bg-sb-surface2 px-3 py-2 font-mono text-[12px] text-sb-silver">
      None
    </span>
  );
}

function LiveAnnouncement({ children }: { children: string }) {
  return (
    <span
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </span>
  );
}
