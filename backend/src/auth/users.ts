import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const DB_FILE = path.join(STORAGE_DIR, 'users.json');

const users = new Map<string, User>();

function persist(): void {
  try {
    mkdirSync(STORAGE_DIR, { recursive: true });
    writeFileSync(DB_FILE, JSON.stringify([...users.values()], null, 2));
  } catch (err) {
    console.error('[users] failed to persist:', err);
  }
}

function load(): void {
  if (!existsSync(DB_FILE)) return;
  try {
    const raw = JSON.parse(readFileSync(DB_FILE, 'utf8')) as User[];
    for (const u of raw) users.set(u.id, u);
  } catch (err) {
    console.error('[users] failed to load:', err);
  }
}

load();

export function findByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return [...users.values()].find((u) => u.email === normalized);
}

export function findById(id: string): User | undefined {
  return users.get(id);
}

export function createUser(email: string, passwordHash: string): User {
  const user: User = {
    id: randomUUID(),
    email: email.trim().toLowerCase(),
    passwordHash,
    createdAt: Date.now(),
  };
  users.set(user.id, user);
  persist();
  return user;
}
