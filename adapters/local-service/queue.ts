import { randomBytes } from "node:crypto";

export type QueueJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type QueueErrorCode = "paused" | "busy" | "limit";

export class QueueError extends Error {
  constructor(readonly code: QueueErrorCode, message: string) {
    super(message);
    this.name = "QueueError";
  }
}

export interface QueueJobView {
  id: string;
  status: QueueJobStatus;
  position: number;
}

export interface QueueJobRecord extends QueueJobView {
  result?: unknown;
  error?: string;
}

export interface ServiceQueueStatus {
  paused: boolean;
  active: boolean;
  waiting: number;
  accepting: boolean;
  remaining_hour: number;
  remaining_session: number;
}

export interface ServiceQueueOptions<T> {
  execute: (payload: T) => Promise<unknown>;
  release: () => Promise<unknown> | unknown;
  onPausedChange?: (paused: boolean) => void;
  initialPaused?: boolean;
  now?: () => number;
  maxWaiting?: number;
  hourlyLimit?: number;
  sessionLimit?: number;
  dailyLimit?: number;
  ttlMs?: number;
}

interface Entry<T> {
  id: string;
  status: QueueJobStatus;
  position: number;
  payload: T | undefined;
  result?: unknown;
  error?: string;
  finishedAt?: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A single-process, strictly serial queue. State and payloads stay in memory. */
export class ServiceQueue<T = unknown> {
  private readonly execute: (payload: T) => Promise<unknown>;
  private readonly release: () => Promise<unknown> | unknown;
  private readonly onPausedChange?: (paused: boolean) => void;
  private readonly now: () => number;
  private readonly maxWaiting: number;
  private readonly hourlyLimit: number;
  private readonly sessionLimit: number;
  private readonly dailyLimit: number;
  private readonly ttlMs: number;
  private paused: boolean;
  private active = false;
  private entries = new Map<string, Entry<T>>();
  private waiting: Entry<T>[] = [];
  private submissions: number[] = [];
  private dailySubmissions: number[] = [];
  private sessionSubmissions = 0;
  private worker: Promise<void> | null = null;

  constructor(options: ServiceQueueOptions<T>) {
    this.execute = options.execute;
    this.release = options.release;
    this.onPausedChange = options.onPausedChange;
    this.now = options.now ?? Date.now;
    this.maxWaiting = options.maxWaiting ?? 3;
    this.hourlyLimit = options.hourlyLimit ?? 12;
    this.sessionLimit = options.sessionLimit ?? 100;
    this.dailyLimit = options.dailyLimit ?? Number.POSITIVE_INFINITY;
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1000;
    this.paused = options.initialPaused ?? false;
  }

  submit(payload: T): QueueJobView {
    this.purgeExpired();
    this.pruneSubmissions();
    this.pruneDailySubmissions();
    if (this.paused) throw new QueueError("paused", "The service is paused.");
    if (this.waiting.length >= this.maxWaiting) throw new QueueError("busy", "The waiting queue is full.");
    if (this.submissions.length >= this.hourlyLimit || this.sessionSubmissions >= this.sessionLimit || this.dailySubmissions.length >= this.dailyLimit) {
      throw new QueueError("limit", "The service submission limit has been reached.");
    }

    const entry: Entry<T> = {
      id: randomBytes(32).toString("hex"),
      status: "queued",
      position: this.waiting.length + 1,
      payload,
    };
    this.entries.set(entry.id, entry);
    this.waiting.push(entry);
    const submittedAt = this.now();
    this.submissions.push(submittedAt);
    this.dailySubmissions.push(submittedAt);
    this.sessionSubmissions += 1;
    this.startWorker();
    return this.view(entry);
  }

  get(id: string): QueueJobRecord | null {
    this.purgeExpired();
    const entry = this.entries.get(id);
    if (!entry) return null;
    return {
      ...this.view(entry),
      ...(entry.status === "completed" ? { result: entry.result } : {}),
      ...(entry.status === "failed" ? { error: entry.error } : {}),
    };
  }

  status(): ServiceQueueStatus {
    this.purgeExpired();
    this.pruneSubmissions();
    this.pruneDailySubmissions();
    const remainingHour = Math.max(0, this.hourlyLimit - this.submissions.length);
    const remainingSession = Math.min(
      Math.max(0, this.sessionLimit - this.sessionSubmissions),
      Math.max(0, this.dailyLimit - this.dailySubmissions.length),
    );
    return {
      paused: this.paused,
      active: this.active,
      waiting: this.waiting.length,
      accepting: !this.paused && this.waiting.length < this.maxWaiting && remainingHour > 0 && remainingSession > 0,
      remaining_hour: remainingHour,
      remaining_session: remainingSession,
    };
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    for (const entry of this.waiting.splice(0)) {
      entry.status = "cancelled";
      entry.position = 0;
      entry.payload = undefined;
      entry.finishedAt = this.now();
    }
    this.onPausedChange?.(true);
    if (!this.worker) this.startWorker();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.onPausedChange?.(false);
    this.startWorker();
  }

  private view(entry: Entry<T>): QueueJobView {
    return { id: entry.id, status: entry.status, position: entry.position };
  }

  private pruneSubmissions(): void {
    const cutoff = this.now() - HOUR_MS;
    while (this.submissions.length > 0 && this.submissions[0] <= cutoff) this.submissions.shift();
  }

  private pruneDailySubmissions(): void {
    const cutoff = this.now() - DAY_MS;
    while (this.dailySubmissions.length > 0 && this.dailySubmissions[0] <= cutoff) this.dailySubmissions.shift();
  }

  private purgeExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, entry] of this.entries) {
      if (entry.finishedAt !== undefined && entry.finishedAt <= cutoff) this.entries.delete(id);
    }
  }

  private startWorker(): void {
    if (this.worker) return;
    this.worker = this.drain().finally(() => {
      this.worker = null;
      // A resume or submit may have arrived while release() was pending.
      if (!this.paused && this.waiting.length > 0) this.startWorker();
    });
  }

  private async drain(): Promise<void> {
    while (true) {
      while (!this.paused && this.waiting.length > 0) {
        const entry = this.waiting.shift()!;
        this.updatePositions();
        entry.status = "running";
        entry.position = 0;
        this.active = true;
        const payload = entry.payload;
        try {
          entry.result = await this.execute(payload as T);
          entry.status = "completed";
        } catch (error) {
          entry.error = error instanceof Error ? error.message : String(error);
          entry.status = "failed";
        } finally {
          entry.payload = undefined;
          entry.finishedAt = this.now();
          this.active = false;
        }
      }

      // Release only at an idle boundary. Keep the worker lock through release so
      // resume/submit cannot overlap a new model invocation with GPU cleanup.
      if (this.paused || this.waiting.length === 0) {
        try {
          await this.release();
        } catch {
          // Release failures do not rewrite the completed job outcome; later idle
          // boundaries can retry cleanup.
        }
      }
      if (this.paused || this.waiting.length === 0) return;
    }
  }

  private updatePositions(): void {
    this.waiting.forEach((entry, index) => { entry.position = index + 1; });
  }
}
