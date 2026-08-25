import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/intel-one-mono/400.css';
import '@fontsource/intel-one-mono/500.css';
import '@fontsource/intel-one-mono/600.css';
import '@fontsource/intel-one-mono/700.css';
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Board } from '../src/index.js';
import { createStubBoardApi } from './stubApi.js';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No #root element found in index.html.');

function Demo() {
  const [readOnly, setReadOnly] = useState(false);
  const api = useMemo(() => createStubBoardApi({ readOnly }), [readOnly]);

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 rounded-md border border-sb-iron bg-sb-surface2 p-2">
        <label className="flex items-center gap-2 font-mono text-[12px] text-sb-silver">
          <input
            checked={readOnly}
            className="h-4 w-4 accent-sb-silver"
            type="checkbox"
            onChange={event => setReadOnly(event.target.checked)}
          />
          Read-only demo
        </label>
      </div>
      <Board api={api} />
    </>
  );
}

createRoot(rootElement).render(<Demo />);
