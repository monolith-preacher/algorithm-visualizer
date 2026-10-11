import fs from 'node:fs';
import type { IncomingMessage, Server } from 'node:http';
import path from 'node:path';

import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';

import type { HealthResponse, SandboxStatus, ServerMessage } from '@av/shared';

import type { Config } from './config';
import { errorHandler, labRoutes } from './lab/routes';
import { LabRunner } from './lab/runner';
import { PlaygroundSession, parseClientMessage } from './playground/session';
import { checkSandbox, Semaphore } from './sandbox/docker';
import type { Workspaces } from './sandbox/workspace';

export interface AppContext {
  app: express.Express;
  attach(server: Server): void;
  refreshSandbox(): Promise<SandboxStatus>;
}

export function createApp(config: Config, workspaces: Workspaces): AppContext {
  const app = express();
  const lab = new LabRunner(config);
  const semaphore = new Semaphore(config.maxConcurrentSandboxes);
  let sandbox: SandboxStatus = { available: false, reason: 'Checking Docker…', image: config.sandboxImage };

  const refreshSandbox = async (): Promise<SandboxStatus> => {
    sandbox = await checkSandbox(config);
    return sandbox;
  };

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', async (_req, res) => {
    const body: HealthResponse = {
      ok: true,
      lab: await lab.status(),
      sandbox: sandbox.available ? sandbox : await refreshSandbox(),
      limits: config.limits,
    };
    res.json(body);
  });
  app.use('/api/lab', labRoutes(lab));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'not_found' });
  });

  // Production: serve the built web client.
  if (fs.existsSync(path.join(config.webDist, 'index.html'))) {
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api|\/ws).*/, (_req, res) => {
      res.sendFile(path.join(config.webDist, 'index.html'));
    });
  }
  app.use(errorHandler);

  const originAllowed = (req: IncomingMessage): boolean => {
    const origin = req.headers.origin;
    if (!origin) {
      return true;
    }
    if (config.allowedOrigins.includes(origin)) {
      return true;
    }
    try {
      // Same origin only (the Vite dev proxy preserves the Host header).
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  };

  const attach = (server: Server): void => {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
    server.on('upgrade', (req, socket, head) => {
      if (req.url !== '/ws/playground' || !originAllowed(req)) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    });
    wss.on('connection', (ws: WebSocket) => {
      const send = (message: ServerMessage): void => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(message));
        }
      };
      const session = new PlaygroundSession(config, workspaces, semaphore, () => sandbox, send);
      void refreshSandbox().then((status) => send({ type: 'hello', sandbox: status, limits: config.limits }));
      // Messages are handled in order; a slow compile does not reorder later input.
      let chain = Promise.resolve();
      ws.on('message', (data) => {
        const message = parseClientMessage(data.toString());
        if (!message) {
          send({ type: 'error', message: 'Malformed message' });
          return;
        }
        if (message.type === 'stop' || message.type === 'stdin' || message.type === 'stdin_eof' || message.type === 'debug_stop' || (message.type === 'debug_command' && message.command === 'pause')) {
          // Control messages must not wait behind a running operation.
          void session.handle(message).catch((e: Error) => send({ type: 'error', message: e.message }));
          return;
        }
        chain = chain
          .then(() => session.handle(message))
          .catch((e: Error) => send({ type: 'error', message: e.message }));
      });
      ws.on('close', () => {
        void session.dispose();
      });
    });
  };

  return { app, attach, refreshSandbox };
}
