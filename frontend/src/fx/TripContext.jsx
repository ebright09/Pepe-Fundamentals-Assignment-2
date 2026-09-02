import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

/**
 * Global control of the visual intensity.
 *
 * `intensity` runs 0 → 2 and is published as the CSS custom property `--trip`,
 * which every animation in index.css scales from. `calm` short-circuits all of
 * it. Visitors who have asked their operating system for reduced motion start
 * in calm mode automatically, and the choice is remembered per browser.
 */

const TripContext = createContext(null);
const STORAGE_KEY = 'networking-tracker:trip';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const readStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const TripProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    const stored = readStored();
    if (stored) return stored;
    return { intensity: 1, calm: prefersReducedMotion() };
  });

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--trip', String(state.calm ? 0 : state.intensity));
    root.classList.toggle('calm', state.calm);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private browsing — the setting simply will not persist */
    }
  }, [state]);

  const setIntensity = useCallback(
    (intensity) => setState((s) => ({ ...s, intensity, calm: intensity === 0 ? s.calm : false })),
    []
  );
  const toggleCalm = useCallback(() => setState((s) => ({ ...s, calm: !s.calm })), []);

  const value = useMemo(
    () => ({ ...state, setIntensity, toggleCalm, effects: !state.calm }),
    [state, setIntensity, toggleCalm]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
};

export const useTrip = () => {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside a TripProvider');
  return ctx;
};
