// Doctrine: Component primitives › Toast. Sonner is the mechanism; this is the
// visual shape — bordered surface2 fill, mono content. Semantic outcomes read
// pre-attentively: a colored Radix glyph + matching left-border. Info/loading
// stay neutral — a silver Radix glyph, keeping them out of the meaning lane.
//
// These used to render three chevrons in iron/silver/frosted: the retired
// stepped brand mark, redrawn inline. The Iconography rules forbid recreating
// the mark, and the mark it stood for is now a ship that turns to mush at 14px.
import {
  RxCheckCircled,
  RxCrossCircled,
  RxExclamationTriangle,
  RxInfoCircled,
  RxUpdate,
} from 'react-icons/rx';
import { Toaster as SonnerToaster } from 'sonner';

const infoMark = (
  <RxInfoCircled className="h-4 w-4 shrink-0 text-sb-silver" aria-hidden />
);
// Static: rotating it would be the only motion in the system.
const loadingMark = (
  <RxUpdate className="h-4 w-4 shrink-0 text-sb-silver" aria-hidden />
);

export function BoardToaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={8}
      icons={{
        success: (
          <RxCheckCircled className="h-4 w-4 text-sb-success" aria-hidden />
        ),
        error: (
          <RxCrossCircled className="h-4 w-4 text-sb-danger" aria-hidden />
        ),
        warning: (
          <RxExclamationTriangle
            className="h-4 w-4 text-sb-warning"
            aria-hidden
          />
        ),
        info: infoMark,
        loading: loadingMark,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[356px] items-center gap-3 rounded-md border border-sb-iron bg-sb-surface2 px-3.5 py-3',
          success: 'border-l-2 border-l-sb-success',
          error: 'border-l-2 border-l-sb-danger',
          warning: 'border-l-2 border-l-sb-warning',
          content: 'min-w-0 flex-1',
          title: 'font-mono text-[13px] text-sb-frosted',
          description: 'font-mono text-[11px] text-sb-silver',
          actionButton:
            'rounded border border-sb-iron px-2.5 py-1.5 font-mono text-[11px] text-sb-frosted transition-colors hover:border-sb-silver hover:bg-sb-surface',
        },
      }}
    />
  );
}
