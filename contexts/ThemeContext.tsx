import React, { createContext, useContext, useMemo } from 'react';

type ThemeMode = 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  /** @deprecated App is light-only; no-op */
  setTheme: (_next: 'light' | 'dark') => void;
  /** @deprecated App is light-only; no-op */
  toggleTheme: () => void;
  hydrated: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      theme: 'light' as const,
      setTheme: () => {},
      toggleTheme: () => {},
      hydrated: true,
    }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside ThemeProvider.');
  return value;
}
