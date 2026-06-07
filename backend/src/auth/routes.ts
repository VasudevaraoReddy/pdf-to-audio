import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, findByEmail, findById } from './users';
import { sign } from './jwt';
import { requireAuth } from './middleware';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (findByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser(email, passwordHash);
  res.status(201).json({ token: sign(user.id), user: { id: user.id, email: user.email } });
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const user = findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  res.json({ token: sign(user.id), user: { id: user.id, email: user.email } });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  const user = findById(req.userId!);
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
  res.json({ user: { id: user.id, email: user.email } });
});
