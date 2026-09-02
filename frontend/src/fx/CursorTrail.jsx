import { useEffect } from 'react';
import { useTrip } from './TripContext.jsx';

/**
 * A short comet tail of hue-shifting dots following the pointer. Written with
 * direct DOM nodes rather than React state so it never triggers a re-render on
 * mouse move. Skipped entirely on touch devices, where there is no cursor.
 */
export const CursorTrail = () => {
  const { effects, intensity } = useTrip();

  useEffect(() => {
    if (!effects) return undefined;
    if (window.matchMedia?.('(hover: none)').matches) return undefined;

    const count = Math.round(8 + intensity * 6);
    const dots = Array.from({ length: count }, () => {
      const dot = document.createElement('div');
      dot.className = 'trail-dot';
      document.body.appendChild(dot);
      return { el: dot, x: 0, y: 0 };
    });

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let hue = 0;
    let frame;

    const onMove = (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const animate = () => {
      frame = requestAnimationFrame(animate);
      hue = (hue + 2.5) % 360;
      let x = mouseX;
      let y = mouseY;

      dots.forEach((dot, index) => {
        // Each dot eases toward the one ahead of it, producing the tail.
        dot.x += (x - dot.x) * 0.32;
        dot.y += (y - dot.y) * 0.32;
        const size = (count - index) * 1.6 * (0.6 + intensity * 0.3);
        dot.el.style.transform = `translate3d(${dot.x - size / 2}px, ${dot.y - size / 2}px, 0)`;
        dot.el.style.width = `${size}px`;
        dot.el.style.height = `${size}px`;
        dot.el.style.background = `hsl(${(hue + index * 18) % 360} 100% 62%)`;
        dot.el.style.opacity = String((1 - index / count) * 0.55);
        x = dot.x;
        y = dot.y;
      });
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      dots.forEach((dot) => dot.el.remove());
    };
  }, [effects, intensity]);

  return null;
};
