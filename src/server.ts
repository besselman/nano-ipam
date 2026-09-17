import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

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

// Check for SSL/TLS Certificate & Private Key
let sslCertPath = process.env.SSL_CERT_PATH;
let sslKeyPath = process.env.SSL_KEY_PATH;

if (!sslCertPath || !sslKeyPath) {
  const searchLocations = [
    { cert: path.join(process.cwd(), 'certs', 'cert.pem'), key: path.join(process.cwd(), 'certs', 'key.pem') },
    { cert: path.join(process.cwd(), 'certs', 'fullchain.pem'), key: path.join(process.cwd(), 'certs', 'privkey.pem') },
    { cert: '/var/lib/nano-ipam/certs/cert.pem', key: '/var/lib/nano-ipam/certs/key.pem' },
    { cert: '/var/lib/nano-ipam/certs/fullchain.pem', key: '/var/lib/nano-ipam/certs/privkey.pem' },
    { cert: '/etc/nano-ipam/certs/cert.pem', key: '/etc/nano-ipam/certs/key.pem' },
    { cert: '/etc/nano-ipam/certs/fullchain.pem', key: '/etc/nano-ipam/certs/privkey.pem' },
  ];
  for (const loc of searchLocations) {
    if (fs.existsSync(loc.cert) && fs.existsSync(loc.key)) {
      sslCertPath = loc.cert;
      sslKeyPath = loc.key;
      break;
    }
  }
}

let sslOptions: https.ServerOptions | null = null;
if (sslCertPath && sslKeyPath && fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)) {
  try {
    sslOptions = {
      cert: fs.readFileSync(sslCertPath),
      key: fs.readFileSync(sslKeyPath),
    };
    if (process.env.SSL_CA_PATH && fs.existsSync(process.env.SSL_CA_PATH)) {
      sslOptions.ca = fs.readFileSync(process.env.SSL_CA_PATH);
    }
  } catch (err: any) {
    console.error(`[SSL Error] Failed to read SSL certificate or key: ${err.message}`);
  }
}

// Create appropriate server (HTTPS or HTTP)
let server: http.Server | https.Server;
const isHttps = Boolean(sslOptions);

if (isHttps && sslOptions) {
  server = https.createServer(sslOptions, app);
} else {
  server = http.createServer(app);
}

server.listen(PORT, HOST, () => {
  const protocol = isHttps ? 'https' : 'http';
  console.log(`
┌────────────────────────────────────────────────────────┐
│                   Nano IPAM started                    │
│   Listening on: ${protocol}://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}               │
│   Protocol:     ${isHttps ? 'HTTPS (TLS/SSL Enabled)' : 'HTTP (Unencrypted)'}          │
│   Certificate:  ${isHttps ? sslCertPath : 'None (Set SSL_CERT_PATH & SSL_KEY_PATH)'} │
│   Environment:  ${process.env.NODE_ENV || 'production'}                            │
│   Static files: ${publicDir}
└────────────────────────────────────────────────────────┘
  `);
});

// Optional HTTP-to-HTTPS redirect server if running HTTPS on port 443
let redirectServer: http.Server | null = null;
const redirectPort = Number(process.env.HTTP_REDIRECT_PORT) || (isHttps && PORT === 443 ? 80 : null);
if (isHttps && redirectPort) {
  const redirectApp = express();
  redirectApp.use((req, res) => {
    const host = req.headers.host?.split(':')[0] || 'localhost';
    const targetUrl = PORT === 443 ? `https://${host}${req.url}` : `https://${host}:${PORT}${req.url}`;
    res.redirect(301, targetUrl);
  });
  redirectServer = redirectApp.listen(redirectPort, HOST, () => {
    console.log(`[HTTP Redirect] Listening on http://${HOST}:${redirectPort} -> redirecting to HTTPS`);
  });
}

// Graceful shutdown
const shutdown = () => {
  console.log('\nShutting down Nano IPAM gracefully...');
  server.close(() => {
    if (redirectServer) {
      redirectServer.close(() => {
        console.log('Redirect server closed.');
        process.exit(0);
      });
    } else {
      console.log('Server closed.');
      process.exit(0);
    }
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
