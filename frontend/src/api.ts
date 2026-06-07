export type JobStatus =
  | 'queued'
  | 'extracting'
  | 'synthesizing'
  | 'concatenating'
  | 'done'
  | 'error';

export type SegmentStatus = 'pending' | 'ready' | 'error';
export interface Segment {
  page: number;
  status: SegmentStatus;
}

export interface JobState {
  id: string;
  status: JobStatus;
  progress: number;
  fileName: string;
  sizeBytes: number;
  pages?: number;
  pageRange?: string;
  stylePrompt?: string;
  languages: string[];
  segments?: Segment[];
  totalSegments?: number;
  createdAt?: number;
  error?: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

const TOKEN_KEY = 'pdf2audio_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Wrapper that attaches the bearer token and surfaces JSON errors. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    throw new Error('Your session expired. Please sign in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed.');
  return data as T;
}

// ---- Auth ----
export async function register(email: string, password: string) {
  return request<{ token: string; user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  return request<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function me() {
  return request<{ user: AuthUser }>('/api/auth/me');
}

// ---- Jobs ----
export async function uploadPdf(file: File, prompt: string, pageRange: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  if (prompt) form.append('prompt', prompt);
  if (pageRange) form.append('pageRange', pageRange);
  const data = await request<{ jobId: string }>('/api/jobs', {
    method: 'POST',
    body: form,
  });
  return data.jobId;
}

export async function getJob(id: string): Promise<JobState> {
  return request<JobState>(`/api/jobs/${id}`);
}

export async function listJobs(): Promise<JobState[]> {
  return request<JobState[]>('/api/jobs');
}

/** Token is appended so <audio> and download links authorize without headers. */
export function audioUrl(id: string): string {
  const token = getToken();
  return `/api/jobs/${id}/audio${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

/** URL for a single page's audio (progressive playback). */
export function segmentAudioUrl(id: string, index: number): string {
  const token = getToken();
  return `/api/jobs/${id}/segments/${index}/audio${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}
