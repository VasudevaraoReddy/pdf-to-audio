import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { jobsRouter } from './routes/jobs';
import { authRouter } from './auth/routes';
import { isSecretConfigured } from './auth/jwt';

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ttsConfigured: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/jobs', jobsRouter);

// Centralized error handler (covers multer file-size/type errors).
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unexpected server error.';
  res.status(400).json({ error: message });
});

app.listen(PORT, () => {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn(
      '[warn] GOOGLE_APPLICATION_CREDENTIALS is not set — TTS calls will fail until you configure it (see .env.example).'
    );
  }
  if (!isSecretConfigured()) {
    console.warn(
      '[warn] JWT_SECRET is not set — using an insecure dev default. Set it in .env for real use.'
    );
  }
  console.log(`PDF→Audio backend listening on http://localhost:${PORT}`);
});
