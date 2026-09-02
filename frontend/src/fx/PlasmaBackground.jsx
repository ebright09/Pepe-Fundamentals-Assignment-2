import { useEffect, useRef } from 'react';
import { useTrip } from './TripContext.jsx';

/**
 * A WebGL plasma field: layered sine interference sampled per pixel and mapped
 * through a rotating palette. If WebGL is unavailable the canvas simply stays
 * empty and the CSS blob field behind it carries the look on its own.
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

// Smooth 2D value noise, used to warp the plasma so it never looks like a grid.
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

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.18;

  // Domain warp: feed noise back into the coordinates a couple of times.
  vec2 warped = uv;
  warped += 0.55 * vec2(noise(uv * 2.1 + t), noise(uv * 2.1 - t + 4.7));
  warped += 0.35 * vec2(noise(warped * 3.4 - t * 0.7), noise(warped * 3.4 + t * 0.5));

  float plasma =
      sin(warped.x * 4.0 + t * 1.7)
    + sin(warped.y * 5.0 - t * 1.2)
    + sin(length(warped * 3.0) * 3.0 - t * 2.1)
    + noise(warped * 4.0 + t) * 2.0;
  plasma *= 0.25;

  // Rotating neon palette: magenta -> cyan -> acid green -> violet.
  vec3 a = vec3(0.52, 0.24, 0.72);
  vec3 b = vec3(0.48, 0.40, 0.36);
  vec3 c = vec3(1.00, 1.00, 1.00);
  vec3 d = vec3(0.00, 0.22, 0.56);
  vec3 color = a + b * cos(6.28318 * (c * plasma + d + t * 0.12));

  // Vignette keeps the centre of the screen readable behind the UI.
  float vignette = smoothstep(1.25, 0.15, length(uv));
  color *= vignette;

  gl_FragColor = vec4(color * u_intensity, 1.0);
}
`;

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
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

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return undefined;

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
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

    // Half-resolution rendering: this is a blurred backdrop, so the extra
    // pixels would cost battery for no visible gain.
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
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
      gl.uniform1f(uIntensity, 0.45 + intensityRef.current * 0.4);
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
    { color: '#ff2bd6', top: '4%', left: '2%', duration: '26s', delay: '0s' },
    { color: '#22e4ff', top: '46%', left: '58%', duration: '34s', delay: '-8s' },
    { color: '#39ff14', top: '68%', left: '14%', duration: '30s', delay: '-16s' },
    { color: '#a855f7', top: '12%', left: '62%', duration: '38s', delay: '-24s' },
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
 * A dark wash between the light show and the interface. The plasma and blobs
 * are gorgeous but they destroy text contrast on their own; this keeps every
 * panel readable without dimming the effects themselves.
 */
export const Scrim = () => <div className="scrim" aria-hidden="true" />;

export const Grain = () => {
  const { effects } = useTrip();
  if (!effects) return null;
  return <div className="grain" aria-hidden="true" />;
};
