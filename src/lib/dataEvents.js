import { useEffect } from 'react';

// Tiny global pub-sub over CustomEvent. Used to broadcast data-store changes
// (banks / lps / clients / affinity / weights) so that any mounted page can
// re-fetch when something changes anywhere else in the app.
//
//   emit('clients')                   // from an upsertClient() / deleteClient()
//   useDataChange('clients', reload)  // from a page that displays clients
//   useDataChange('*',       reload)  // subscribe to any kind

const EVENT = 'sdm:data-changed';

export function emit(kind) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { kind } }));
}

export function useDataChange(kind, cb) {
  useEffect(() => {
    const handler = (e) => {
      if (kind === '*' || e.detail?.kind === kind) cb();
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
}
