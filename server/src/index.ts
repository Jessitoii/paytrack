import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();

app.listen({ port: env.PORT, host: env.HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`PayTrack API server running at ${address}`);
});
