/**
 * Client-side request scheduler: bounded concurrency + minimum spacing +
 * controlled retries with exponential backoff (honouring Retry-After).
 *
 * FACEIT does not publish a fixed per-key quota in a stable place, so we stay
 * conservative and react to HTTP 429 instead of assuming a number.
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterMs: number | null = null,
  ) {
    super(message);
  }
}

export interface LimiterOptions {
  concurrency: number;
  minIntervalMs: number;
  maxRetries: number;
  baseBackoffMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function isRetryable(e: unknown): boolean {
  if (e instanceof HttpError) return e.status === 429 || e.status >= 500;
  return e instanceof TypeError; // fetch network failure
}

export class RateLimiter {
  private active = 0;
  private lastStart = 0;
  private queue: (() => void)[] = [];
  private pausedUntil = 0;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;

  constructor(private o: LimiterOptions) {
    this.now = o.now ?? Date.now;
    this.sleep = o.sleep ?? defaultSleep;
  }

  get pending() {
    return this.queue.length + this.active;
  }

  private async acquire() {
    // Slots are handed over directly by release(), so concurrency is never exceeded.
    if (this.active >= this.o.concurrency) await new Promise<void>((r) => this.queue.push(r));
    else this.active++;
    const wait = Math.max(this.lastStart + this.o.minIntervalMs, this.pausedUntil) - this.now();
    this.lastStart = Math.max(this.now(), this.lastStart + this.o.minIntervalMs, this.pausedUntil);
    if (wait > 0) await this.sleep(wait);
  }

  private release() {
    const next = this.queue.shift();
    if (next) next();
    else this.active--;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.acquire();
      let error: unknown;
      try {
        return await fn();
      } catch (e) {
        error = e;
      } finally {
        this.release();
      }
      if (!isRetryable(error) || attempt >= this.o.maxRetries) throw error;
      const backoff =
        error instanceof HttpError && error.retryAfterMs !== null
          ? error.retryAfterMs
          : this.o.baseBackoffMs * 2 ** attempt;
      // A 429 pauses the whole queue, not only this request.
      if (error instanceof HttpError && error.status === 429) this.pausedUntil = this.now() + backoff;
      await this.sleep(backoff);
    }
  }
}
