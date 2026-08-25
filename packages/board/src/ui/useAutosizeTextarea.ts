import { type RefObject, useLayoutEffect, useRef } from 'react';

function supportsNativeFieldSizing(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('field-sizing', 'content')
  );
}

function resizeTextareaPreservingScroll(textarea: HTMLTextAreaElement): void {
  if (supportsNativeFieldSizing()) {
    textarea.style.height = '';
    return;
  }

  const ancestorScrollPositions: Array<{
    element: HTMLElement;
    left: number;
    top: number;
  }> = [];

  for (
    let ancestor = textarea.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    ancestorScrollPositions.push({
      element: ancestor,
      left: ancestor.scrollLeft,
      top: ancestor.scrollTop,
    });
  }

  const windowScrollPosition = { left: window.scrollX, top: window.scrollY };

  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;

  for (const { element, left, top } of ancestorScrollPositions) {
    element.scrollLeft = left;
    element.scrollTop = top;
  }

  if (windowScrollPosition.left !== 0 || windowScrollPosition.top !== 0) {
    window.scrollTo(windowScrollPosition.left, windowScrollPosition.top);
  }
}

export function useAutosizeTextarea(
  value: string,
  active: boolean,
): RefObject<HTMLTextAreaElement | null> {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (active && textarea?.value === value) {
      resizeTextareaPreservingScroll(textarea);
    }
  }, [active, value]);

  return textareaRef;
}
