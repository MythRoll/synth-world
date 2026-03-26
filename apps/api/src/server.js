import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { backfillDefaultToolsForAllAgents, ensureToolingReady } from './services/toolRuntimeService.js';

// Refuse to start with default JWT secret in production
if (process.env.NODE_ENV === 'production' && env.jwtSecret === 'change-me-in-production') {
  console.error('FATAL: JWT_SECRET must be set to a secure value in production.');
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors({
  origin: ['https://synth-world.com', 'https://www.synth-world.com', 'https://api.synth-world.com'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRouter);

async function initToolingRuntime() {
  await ensureToolingReady();
  await backfillDefaultToolsForAllAgents();
}

app.listen(env.port, async () => {
  try {
    await initToolingRuntime();
    console.log('Tool runtime initialized and default tools backfilled.');
  } catch (err) {
    console.error('Tool runtime initialization failed:', err?.message || String(err), err?.code ? `(code: ${err.code})` : '');
  }
  console.log(`Synth World API listening on :${env.port}`);
});

setInterval(async () => {
  try {
    await initToolingRuntime();
  } catch {
    // background retry; status is exposed via admin/tooling endpoints
  }
}, 60_000);
