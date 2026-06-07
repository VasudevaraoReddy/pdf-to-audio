import { NextFunction, Request, Response } from 'express';
import { verify } from './jwt';

// Augment Express's Request so handlers can read req.userId after requireAuth.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  // Prefer the Authorization header; fall back to a ?token= query param so that
  // <audio src> and download <a href> (which can't set headers) still authorize.
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : typeof req.query.token === 'string'
      ? req.query.token
      : '';
  const userId = token ? verify(token) : null;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.userId = userId;
  next();
}
