import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp({ config });

app.listen(config.port, () => {
  console.log(`Networking Tracker API listening on http://localhost:${config.port}`);
  console.log(`  Data API : ${config.dataApiUrl}`);
  console.log(`  JWKS     : ${config.jwksUrl}`);
  console.log(`  CORS     : ${config.allowedOrigins.join(', ')}`);
});
