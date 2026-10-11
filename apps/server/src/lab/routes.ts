import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { ALGORITHMS } from '@av/shared';

import { LabError, type LabRunner } from './runner';

const ids = ALGORITHMS.map((a) => a.id) as [string, ...string[]];

const traceSchema = z.object({
  algorithm: z.enum(ids),
  input: z.string().max(65536),
  traceFrom: z.number().int().min(0).max(10000).optional(),
});

const benchSchema = z.object({
  algorithm: z.enum(ids),
  input: z.string().max(65536),
});

type Handler = (req: Request, res: Response) => Promise<void>;

const wrap = (handler: Handler) => (req: Request, res: Response, next: NextFunction) => {
  handler(req, res).catch(next);
};

export function labRoutes(runner: LabRunner): Router {
  const router = Router();

  router.get(
    '/sources/:id',
    wrap(async (req, res) => {
      const id = String(req.params['id']);
      res.json({ id, ...(await runner.source(id)) });
    }),
  );

  router.post(
    '/trace',
    wrap(async (req, res) => {
      const body = traceSchema.parse(req.body);
      res.json({ events: await runner.trace(body.algorithm, body.input, body.traceFrom) });
    }),
  );

  router.post(
    '/bench',
    wrap(async (req, res) => {
      const body = benchSchema.parse(req.body);
      res.json(await runner.bench(body.algorithm, body.input));
    }),
  );

  return router;
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Invalid request', code: 'invalid_request' });
    return;
  }
  if (error instanceof LabError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  res.status(500).json({ error: 'Internal server error', code: 'internal' });
}
