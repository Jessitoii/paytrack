import { buildApp } from './app.js';
import { env } from './config/env.js';
import { WorkService } from './modules/work/work.service.js';

const app = buildApp();

app.listen({ port: env.PORT, host: env.HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`PayTrack API server running at ${address}`);

  // Periodic Auto-Start Engine: Check scheduled shifts every 60 seconds
  setInterval(async () => {
    try {
      const autoStarted = await WorkService.checkAndTriggerAutoStarts();
      if (autoStarted.length > 0) {
        console.log(`[AutoStartEngine] Auto-started ${autoStarted.length} scheduled work session(s).`);
      }
    } catch (e) {
      console.error('[AutoStartEngine] Error checking scheduled shifts:', e);
    }
  }, 60 * 1000);
});
