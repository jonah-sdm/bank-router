import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Global "Quick Add" state so any page can ask the app to open a create/edit
// modal for a bank / lp / client / affinity rule over the current view.
//
//   const { openQuickAdd, closeQuickAdd, current } = useQuickAdd();
//   openQuickAdd({ kind: 'bank' });
//   openQuickAdd({ kind: 'client', record: existingClient });   // edit
//
// Kinds: 'bank' | 'lp' | 'client' | 'affinity'

const QuickAddContext = createContext(null);

export function QuickAddProvider({ children }) {
  const [current, setCurrent] = useState(null);

  const openQuickAdd = useCallback((payload) => {
    setCurrent(payload);
  }, []);
  const closeQuickAdd = useCallback(() => {
    setCurrent(null);
  }, []);

  const value = useMemo(
    () => ({ current, openQuickAdd, closeQuickAdd }),
    [current, openQuickAdd, closeQuickAdd]
  );

  return <QuickAddContext.Provider value={value}>{children}</QuickAddContext.Provider>;
}

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error('useQuickAdd must be used inside <QuickAddProvider>');
  return ctx;
}
