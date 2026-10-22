import { describe, expect, it, vi } from "vitest";
import { QueueError, ServiceQueue } from "../adapters/local-service/queue";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function settle() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("ServiceQueue", () => {
  it("runs exactly one task at a time and exposes only capability views", async () => {
    const gates = [deferred<string>(), deferred<string>()];
    const calls: string[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    const queue = new ServiceQueue<{ secret: string }>({
      execute: async payload => {
        calls.push(payload.secret);
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        const answer = await gates[calls.length - 1].promise;
        concurrent -= 1;
        return answer;
      },
      release: vi.fn(),
    });
    const first = queue.submit({ secret: "private-one" });
    const second = queue.submit({ secret: "private-two" });
    expect(first.id).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(first)).not.toContain("private-one");
    expect(queue.get(first.id)).not.toHaveProperty("payload");
    expect(queue.get(second.id)?.position).toBe(1);
    await settle();
    expect(calls).toEqual(["private-one"]);
    gates[0].resolve("result-one");
    await settle();
    expect(calls).toEqual(["private-one", "private-two"]);
    gates[1].resolve("result-two");
    await settle();
    expect(queue.get(first.id)).toMatchObject({ status: "completed", result: "result-one" });
    expect(queue.get(second.id)).toMatchObject({ status: "completed", result: "result-two" });
    expect(maxConcurrent).toBe(1);
  });

  it("pause cancels waiting jobs and releases only after the active call finishes", async () => {
    const active = deferred<string>();
    const release = vi.fn();
    const queue = new ServiceQueue({ execute: () => active.promise, release });
    const first = queue.submit({ n: 1 });
    const second = queue.submit({ n: 2 });
    await settle();
    queue.pause();
    expect(queue.get(second.id)).toMatchObject({ status: "cancelled", position: 0 });
    expect(queue.status()).toMatchObject({ paused: true, active: true, waiting: 0, accepting: false });
    expect(release).not.toHaveBeenCalled();
    expect(() => queue.submit({ n: 3 })).toThrowError(expect.objectContaining({ code: "paused" }));
    active.resolve("done");
    await settle();
    expect(queue.get(first.id)?.status).toBe("completed");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("enforces waiting, rolling-hour, and per-process limits with distinct errors", async () => {
    let now = 1_000_000;
    const hold = deferred<void>();
    const queue = new ServiceQueue({ execute: () => hold.promise, release: () => {}, maxWaiting: 1, hourlyLimit: 2, sessionLimit: 3, now: () => now });
    queue.submit({ n: 1 });
    await settle();
    queue.submit({ n: 2 });
    expect(() => queue.submit({ n: 3 })).toThrowError(expect.objectContaining({ code: "busy" }));
    hold.resolve();
    await settle();
    await settle();
    expect(() => queue.submit({ n: 3 })).toThrowError(expect.objectContaining({ code: "limit" }));
    now += 60 * 60 * 1000 + 1;
    const third = queue.submit({ n: 3 });
    expect(third.status).toMatch(/queued|running/);
    expect(queue.status().remaining_session).toBe(0);
    expect(() => queue.submit({ n: 4 })).toThrowError(expect.objectContaining({ code: "limit" }));
    expect(new QueueError("busy", "busy").code).toBe("busy");
  });

  it("expires terminal records lazily after the configured TTL", async () => {
    let now = 50;
    const queue = new ServiceQueue({ execute: async () => 42, release: () => {}, now: () => now, ttlMs: 100 });
    const job = queue.submit({ privateData: "do not return" });
    await settle();
    expect(queue.get(job.id)).toMatchObject({ status: "completed", result: 42 });
    now += 101;
    expect(queue.get(job.id)).toBeNull();
  });

  it("restores rolling 24-hour capacity automatically after the daily limit expires", async () => {
    let now = 2_000_000;
    const queue = new ServiceQueue<{ value: string }>({
      execute: async payload => payload.value,
      release: () => {},
      now: () => now,
      hourlyLimit: 12,
      sessionLimit: Number.MAX_SAFE_INTEGER,
      dailyLimit: 1,
    });
    const first = queue.submit({ value: "first" });
    await settle();
    expect(queue.get(first.id)?.status).toBe("completed");
    expect(queue.status()).toMatchObject({ accepting: false, remaining_session: 0 });
    expect(() => queue.submit({ value: "blocked" })).toThrowError(expect.objectContaining({ code: "limit" }));

    now += 24 * 60 * 60 * 1000 + 1;
    expect(queue.status()).toMatchObject({ paused: false, accepting: true, remaining_session: 1 });
    const second = queue.submit({ value: "second" });
    await settle();
    expect(queue.get(second.id)?.status).toBe("completed");
    expect(queue.status()).toMatchObject({ accepting: false, remaining_session: 0 });
  });

  it("keeps failed jobs terminal, frees their payload, and resumes without overlapping release", async () => {
    const cleanup = deferred<void>();
    const started: number[] = [];
    const release = vi.fn(() => cleanup.promise);
    const queue = new ServiceQueue<{ n: number; secret?: string }>({
      execute: async payload => {
        started.push(payload.n);
        if (payload.n === 1) throw new Error("inference failed");
        return "ok";
      },
      release,
    });
    const failed = queue.submit({ n: 1, secret: "sensitive" });
    await settle();
    expect(queue.get(failed.id)).toMatchObject({ status: "failed", error: "inference failed" });
    expect(queue.get(failed.id)).not.toHaveProperty("payload");
    queue.pause();
    await settle();
    expect(release).toHaveBeenCalledTimes(1);
    queue.resume();
    const next = queue.submit({ n: 2 });
    expect(started).toEqual([1]);
    cleanup.resolve();
    await settle();
    await settle();
    expect(started).toEqual([1, 2]);
    expect(queue.get(next.id)?.status).toBe("completed");
  });
});
