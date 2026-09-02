import { useEffect, useRef } from 'react';
import { useTrip } from './TripContext.jsx';

/**
 * The background light show.
 *
 * A single full-screen fragment shader does the heavy lifting: fractal noise is
 * domain-warped, folded through a kaleidoscope, pushed down a rotating tunnel,
 * and then sampled three times at slightly different offsets so the red, green
 * and blue channels separate the way they would through a prism.
 *
 * Everything scales off `u_intensity` (0 → 3), which the trip slider drives. At
 * 0 the canvas is not rendered at all.
 */

const VERTEX = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2  u_resolution;
uniform float u_time;
uniform float u_intensity;

const float TAU = 6.28318530718;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

// Fractal Brownian motion: stacked octaves of noise, each finer and fainter.
float fbm(vec2 p) {
  float total = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    total += amp * noise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return total;
}

// Fold the plane into n-fold mirror symmetry — the kaleidoscope.
vec2 kaleido(vec2 p, float segments, float spin) {
  float a = atan(p.y, p.x) + spin;
  float r = length(p);
  float seg = TAU / segments;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  return vec2(cos(a), sin(a)) * r;
}

// The scalar field everything is coloured from.
float pattern(vec2 uv, float t, float k) {
  // Two rounds of domain warping: feed noise back into the coordinates.
  vec2 q = vec2(fbm(uv + vec2(0.0, t * 0.35)), fbm(uv + vec2(5.2, 1.3 - t * 0.28)));
  vec2 r = vec2(fbm(uv + 3.4 * q + vec2(1.7, 9.2) + t * 0.22),
                fbm(uv + 3.4 * q + vec2(8.3, 2.8) - t * 0.19));

  float f = fbm(uv + 3.0 * r);

  // A tunnel: rings racing outward from the centre.
  float rad = length(uv);
  float tunnel = sin(1.0 / max(rad, 0.06) * (1.2 + k * 0.5) - t * 2.4);

  // Interference ripples.
  float ripple = sin(uv.x * 5.0 + t * 1.6) + sin(uv.y * 6.0 - t * 1.25)
               + sin(rad * 9.0 - t * 3.0);

  return f * 1.35 + tunnel * 0.30 * k + ripple * 0.12;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

  float k = clamp(u_intensity / 1.5, 0.0, 2.0);
  float t = u_time * (0.16 + 0.10 * k);

  // Breathe: the whole field slowly inhales and exhales.
  uv *= 1.0 + 0.10 * k * sin(u_time * 0.9);

  // Kaleidoscope. More segments and faster spin the higher the intensity;
  // at the very bottom of the range it stays unfolded.
  float segments = 2.0 + floor(k * 4.0);
  if (k > 0.15) uv = kaleido(uv, segments, u_time * 0.10 * k);

  // Slow overall rotation on top of the fold.
  float ca = cos(u_time * 0.045), sa = sin(u_time * 0.045);
  uv = mat2(ca, -sa, sa, ca) * uv;

  uv *= 1.6;

  // Prism split: sample the field three times, offset per channel.
  float off = 0.028 * k;
  float pr = pattern(uv + vec2(off, off * 0.4), t, k);
  float pg = pattern(uv, t, k);
  float pb = pattern(uv - vec2(off, off * 0.4), t, k);

  // Cosine palette, cycling hue over time.
  vec3 a = vec3(0.50, 0.28, 0.68);
  vec3 b = vec3(0.52, 0.46, 0.42);
  vec3 c = vec3(1.00, 1.05, 0.95);
  vec3 d = vec3(0.00, 0.22, 0.56) + u_time * 0.020;

  vec3 color = vec3(
    (a + b * cos(TAU * (c.r * pr + d.r))).r,
    (a + b * cos(TAU * (c.g * pg + d.g))).g,
    (a + b * cos(TAU * (c.b * pb + d.b))).b
  );

  // Hot cores where the field peaks — the bright filaments.
  float glow = pow(max(pg, 0.0), 3.0);
  color += vec3(1.0, 0.55, 0.95) * glow * 0.55 * k;

  // Saturate hard, then keep the middle of the screen calm enough to read over.
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(lum), color, 1.0 + 0.55 * k);
  color *= smoothstep(1.45, 0.20, length(uv) * 0.62);

  gl_FragColor = vec4(max(color, 0.0) * (0.55 + 0.30 * k), 1.0);
}
`;

const compile = (gl, type, source, label) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // Silent shader failures are miserable to debug, so say so out loud.
    console.warn(`[plasma] ${label} shader failed:`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

export const PlasmaBackground = () => {
  const canvasRef = useRef(null);
  const { effects, intensity } = useTrip();
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    if (!effects) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: true });
    if (!gl) return undefined;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX, 'vertex');
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT, 'fragment');
    if (!vertex || !fragment) return undefined;

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[plasma] link failed:', gl.getProgramInfoLog(program));
      return undefined;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const positionLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uIntensity = gl.getUniformLocation(program, 'u_intensity');

    // Rendered below native resolution: this is a blurred backdrop, so the
    // extra pixels would cost battery for no visible gain.
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.55;
      canvas.width = Math.max(1, Math.floor(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let frame;
    let paused = document.hidden;
    const onVisibility = () => {
      paused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const start = performance.now();
    const render = (now) => {
      frame = requestAnimationFrame(render);
      if (paused) return;
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform1f(uIntensity, intensityRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, [effects]);

  if (!effects) return null;
  return <canvas ref={canvasRef} className="plasma-canvas" aria-hidden="true" />;
};

/** Slow, blurred colour blobs drifting behind the plasma. */
export const BlobField = () => {
  const { effects } = useTrip();
  if (!effects) return null;

  const blobs = [
    { color: '#ff2bd6', top: '2%', left: '0%', duration: '22s', delay: '0s' },
    { color: '#22e4ff', top: '44%', left: '58%', duration: '29s', delay: '-8s' },
    { color: '#39ff14', top: '66%', left: '10%', duration: '26s', delay: '-15s' },
    { color: '#a855f7', top: '10%', left: '62%', duration: '33s', delay: '-22s' },
    { color: '#ffb703', top: '78%', left: '70%', duration: '37s', delay: '-30s' },
  ];

  return (
    <div className="blob-field" aria-hidden="true">
      {blobs.map((blob) => (
        <div
          key={blob.color}
          className="blob"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${blob.color}, transparent 70%)`,
            top: blob.top,
            left: blob.left,
            animationDuration: blob.duration,
            animationDelay: blob.delay,
          }}
        />
      ))}
    </div>
  );
};

/**
 * A dark wash between the light show and the interface. The plasma is gorgeous
 * but it destroys text contrast on its own; this keeps every panel readable
 * without dimming the effects themselves.
 */
export const Scrim = () => <div className="scrim" aria-hidden="true" />;

export const Grain = () => {
  const { effects } = useTrip();
  if (!effects) return null;
  return <div className="grain" aria-hidden="true" />;
};

/** Drifting rainbow scanlines, VHS-style. Only appears past the halfway mark. */
export const Scanlines = () => {
  const { effects, intensity } = useTrip();
  if (!effects || intensity < 1.1) return null;
  return <div className="scanlines" aria-hidden="true" />;
};
