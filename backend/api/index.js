/**
 * Vercel serverless entry point.
 *
 * Vercel routes every request to this function (see vercel.json) and Express
 * handles the routing from there, so the same app runs locally with
 * `npm run dev` and in production as a function.
 */
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const app = createApp({ config: loadConfig() });

export default app;
