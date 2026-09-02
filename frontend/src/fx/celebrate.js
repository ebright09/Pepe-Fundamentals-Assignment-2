import confetti from 'canvas-confetti';

/**
 * Celebration effects.
 *
 * Everything here is a no-op when the trip context reports calm mode; the
 * caller passes `enabled` so these helpers stay plain functions and can be
 * called from event handlers without hooks.
 */

const NEON = ['#ff2bd6', '#22e4ff', '#39ff14', '#ffb703', '#a855f7', '#ffffff'];

/** How hard to celebrate, read from the same CSS variable the slider drives. */
const trip = () => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--trip');
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.max(value, 0) : 1;
};

/** A two-sided burst, used whenever a contact is saved. */
export const burstConfetti = (enabled = true) => {
  if (!enabled) return;
  const k = trip();
  const base = {
    particleCount: Math.round(70 + 70 * k),
    spread: 78 + 22 * k,
    colors: NEON,
    shapes: ['circle', 'square', 'star'],
    disableForReducedMotion: true,
  };
  confetti({ ...base, origin: { x: 0.15, y: 0.7 }, angle: 60 });
  confetti({ ...base, origin: { x: 0.85, y: 0.7 }, angle: 120 });
  confetti({ ...base, particleCount: Math.round(40 * k), origin: { x: 0.5, y: 0.9 }, angle: 90, startVelocity: 55 });
};

/** A bigger, longer shower for high-priority contacts. */
export const megaConfetti = (enabled = true) => {
  if (!enabled) return;
  const k = trip();
  const end = Date.now() + 1400 + 900 * k;
  const tick = () => {
    confetti({
      particleCount: Math.round(4 + 6 * k),
      startVelocity: 42,
      spread: 360,
      ticks: 90,
      colors: NEON,
      shapes: ['circle', 'square', 'star'],
      scalar: 1.1,
      disableForReducedMotion: true,
      origin: { x: Math.random(), y: Math.random() * 0.5 },
    });
    if (Date.now() < end) requestAnimationFrame(tick);
  };
  tick();
};

/** A single upward pop, used for edits and smaller wins. */
export const popConfetti = (enabled = true, origin = { x: 0.5, y: 0.6 }) => {
  if (!enabled) return;
  confetti({
    particleCount: 45,
    spread: 55,
    startVelocity: 34,
    colors: NEON,
    origin,
    disableForReducedMotion: true,
  });
};
