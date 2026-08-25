import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import { classifyLink } from '../utils/links.js';

/**
 * Markdown rendering for task bodies and updates. Both surfaces get the same
 * link behaviour — configuring one and leaving the other bare is the easiest
 * way to ship this half-broken.
 *
 * `urlTransform` is deliberately not overridden. `defaultUrlTransform`
 * sanitizes hrefs against react-markdown's safe-protocol allowlist, and in
 * Harbor's remote mode this content arrives from a GitHub repo, so that
 * filtering matters. Relative paths pass through it untouched, which leaves
 * every link decision to `components.a` below — after sanitization, not
 * instead of it.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown components={{ a: MarkdownLink }}>{children}</ReactMarkdown>
  );
}

/** Host-supplied URLs get the same sanitization react-markdown applies to authored ones. */
function safeHref(url: string | null): string | null {
  if (!url) return null;
  return defaultUrlTransform(url) || null;
}

type AnchorProps = ComponentPropsWithoutRef<'a'> & { node?: unknown };

function MarkdownLink({ href, children, node: _node, ...props }: AnchorProps) {
  const link = classifyLink(href ?? '');
  const selectTask = useBoardStore(state => state.selectTask);
  const resolveRepoLink = useBoardStore(state => state.resolveRepoLink);
  const linkedTaskSlug = useBoardStore(state =>
    link.kind === 'repo' &&
    link.taskSlug !== null &&
    state.tasks.some(task => task.slug === link.taskSlug)
      ? link.taskSlug
      : null,
  );

  if (!href) return <>{children}</>;

  if (link.kind === 'default') {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  if (link.kind === 'external') {
    return (
      <a href={href} rel="noopener noreferrer" target="_blank" {...props}>
        {children}
      </a>
    );
  }

  // A link to another task opens it in place. This needs nothing from the host
  // — the destination is the board itself.
  if (linkedTaskSlug) {
    return (
      <a
        href={href}
        {...props}
        onClick={event => {
          event.preventDefault();
          selectTask(linkedTaskSlug);
        }}
      >
        {children}
      </a>
    );
  }

  const resolved = resolveRepoLink
    ? safeHref(resolveRepoLink(link.path))
    : null;

  // No reachable destination — the CLI board, or a host that declined this
  // path. A visible path the reader can act on beats an anchor that 404s.
  if (!resolved) {
    return <span className="sb-md-path">{`${link.path}${link.suffix}`}</span>;
  }

  return (
    <a
      href={`${resolved}${link.suffix}`}
      rel="noopener noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  );
}
