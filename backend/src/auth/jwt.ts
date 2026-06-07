import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const EXPIRES_IN = '7d';

export function isSecretConfigured(): boolean {
  return Boolean(process.env.JWT_SECRET);
}

export function sign(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: EXPIRES_IN });
}

/** Returns the userId encoded in the token, or null if invalid/expired. */
export function verify(token: string): string | null {
  try {
    const payload = jwt.verify(token, SECRET) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
