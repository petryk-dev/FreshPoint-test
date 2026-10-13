import { createApp } from './app.js';
import { config } from './config.js';
import { FilePredictionStore } from './store/filePredictionStore.js';

const store = new FilePredictionStore(config.PREDICTION_FILE);
const app = createApp({ store });

const server = app.listen(config.PORT, () => {
  console.log(`Server listening on http://localhost:${config.PORT}`);
});

// Graceful shutdown: stop accepting connections and let in-flight requests finish.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
