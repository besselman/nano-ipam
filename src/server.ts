import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import subnetsRouter from './routes/subnets.js';
import allocationsRouter from './routes/allocations.js';
import statsRouter from './routes/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/css') && !req.path.startsWith('/js') && !req.path.startsWith('/favicon')) {
      const ms = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api/subnets', subnetsRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api', statsRouter);

// Resolve static public directory (supports both src/public in dev and dist/public in build)
const candidateDirs = [
  path.join(__dirname, 'public'),
  path.join(__dirname, '..', 'src', 'public'),
  path.join(process.cwd(), 'src', 'public'),
  path.join(process.cwd(), 'public'),
];

let publicDir = candidateDirs[0];
for (const dir of candidateDirs) {
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html'))) {
    publicDir = dir;
    break;
  }
}

app.use(express.static(publicDir));

// Fallback to index.html for SPA client navigation
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start listening
const server = app.listen(PORT, HOST, () => {
  console.log(`
┌────────────────────────────────────────────────────────┐
│                   nano-ipam started                    │
│   Listening on: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}               │
│   Environment:  ${process.env.NODE_ENV || 'production'}                            │
│   Static files: ${publicDir}
└────────────────────────────────────────────────────────┘
  `);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\nShutting down nano-ipam gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
