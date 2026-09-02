import { useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { Fireworks as FireworksEngine } from 'fireworks-js';
import { useTrip } from './TripContext.jsx';

/**
 * A full-screen fireworks layer that other components can trigger through
 * `useFireworks().launch()` — used on sign-in and when a high-priority contact
 * is added. The engine idles stopped and runs only in short bursts, so it costs
 * nothing while the app is just sitting there.
 */

const FireworksContext = createContext({ launch: () => {} });

export const FireworksProvider = ({ children }) => {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const stopTimerRef = useRef(null);
  const { effects } = useTrip();
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  useEffect(() => {
    if (!effects || !containerRef.current) return undefined;

    const engine = new FireworksEngine(containerRef.current, {
      autoresize: true,
      opacity: 0.55,
      acceleration: 1.02,
      friction: 0.97,
      gravity: 1.4,
      particles: 90,
      traceLength: 3,
      explosion: 6,
      intensity: 32,
      flickering: 45,
      lineWidth: { explosion: { min: 1, max: 3 }, trace: { min: 1, max: 2 } },
      hue: { min: 250, max: 360 },
      delay: { min: 12, max: 26 },
      brightness: { min: 55, max: 85 },
      decay: { min: 0.012, max: 0.03 },
      sound: { enabled: false },
    });
    engineRef.current = engine;

    return () => {
      clearTimeout(stopTimerRef.current);
      engine.stop(true);
      engineRef.current = null;
    };
  }, [effects]);

  const launch = useCallback((durationMs = 2600) => {
    if (!effectsRef.current) return;
    const engine = engineRef.current;
    if (!engine) return;
    clearTimeout(stopTimerRef.current);
    if (!engine.isRunning) engine.start();
    stopTimerRef.current = setTimeout(() => engine.waitStop(), durationMs);
  }, []);

  return (
    <FireworksContext.Provider value={{ launch }}>
      <div
        ref={containerRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40"
        style={{ display: effects ? 'block' : 'none' }}
      />
      {children}
    </FireworksContext.Provider>
  );
};

export const useFireworks = () => useContext(FireworksContext);
