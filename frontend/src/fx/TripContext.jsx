import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

/**
 * Global control of the visual intensity.
 *
 * `intensity` runs 0 → 3 and is published as the CSS custom property `--trip`,
 * which every animation in index.css scales from. Past 1.6 the app enters
 * "melt" territory: extra layers switch on and the whole interface starts
 * warping. `calm` short-circuits all of it. Visitors who have asked their
 * operating system for reduced motion start in calm mode automatically, and
 * the choice is remembered per browser.
 */

export const MAX_TRIP = 3;
export const MELT_THRESHOLD = 1.6;

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
    // Default sits above the midpoint: this app is supposed to be a lot.
    return { intensity: 1.5, calm: prefersReducedMotion() };
  });

  useEffect(() => {
    const root = document.documentElement;
    const level = state.calm ? 0 : state.intensity;
    root.style.setProperty('--trip', String(level));
    root.classList.toggle('calm', state.calm);
    // A separate class rather than a threshold in every rule, so the heavier
    // layers can be switched on and off in one place.
    root.classList.toggle('melting', !state.calm && level >= MELT_THRESHOLD);
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
  /** Slam everything to maximum. */
  const maxTrip = useCallback(() => setState({ intensity: MAX_TRIP, calm: false }), []);

  const value = useMemo(
    () => ({
      ...state,
      setIntensity,
      toggleCalm,
      maxTrip,
      effects: !state.calm,
      melting: !state.calm && state.intensity >= MELT_THRESHOLD,
    }),
    [state, setIntensity, toggleCalm, maxTrip]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
};

export const useTrip = () => {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside a TripProvider');
  return ctx;
};
