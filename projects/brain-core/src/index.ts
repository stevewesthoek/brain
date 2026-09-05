import { startBrainCoreServer } from './api/server.js';
import { startMachineTelemetryCollector } from './adapters/machine-telemetry.js';

startMachineTelemetryCollector();
const server = await startBrainCoreServer();

const stop = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

process.once('SIGINT', () => void stop().finally(() => process.exit(0)));
process.once('SIGTERM', () => void stop().finally(() => process.exit(0)));
