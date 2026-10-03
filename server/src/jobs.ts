// The jobs table, shared with the Python worker (worker/worker/jobs.py).
import type pg from "pg";

export interface JobRow {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  result: Record<string, unknown> | null;
  error: string | null;
}

export async function enqueueJob(pool: pg.Pool, brandId: string, kind: string, payload: Record<string, unknown>): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO jobs (brand_id, kind, payload) VALUES ($1, $2, $3) RETURNING id",
    [brandId, kind, JSON.stringify(payload)],
  );
  return rows[0]!.id;
}

export async function getJob(pool: pg.Pool, brandId: string, jobId: string): Promise<JobRow | null> {
  const { rows } = await pool.query<JobRow>(
    "SELECT id, status, result, error FROM jobs WHERE id = $1 AND brand_id = $2",
    [jobId, brandId],
  );
  return rows[0] ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Waits for the worker to finish a job (or for the time limit).
export async function waitForJob(pool: pg.Pool, brandId: string, jobId: string, timeoutMs: number, pollMs = 500): Promise<JobRow | null> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const job = await getJob(pool, brandId, jobId);
    if (!job || job.status === "done" || job.status === "failed" || Date.now() >= until) return job;
    await sleep(pollMs);
  }
}

// Rendered files the worker left for us, in frame order.
export async function takeOutputs(pool: pg.Pool, jobId: string): Promise<{ frame: number; mime: string; data: Buffer }[]> {
  const { rows } = await pool.query<{ frame: number; mime: string; data: Buffer }>(
    "SELECT frame, mime, data FROM render_outputs WHERE job_id = $1 ORDER BY frame",
    [jobId],
  );
  return rows;
}

export async function clearOutputs(pool: pg.Pool, jobId: string): Promise<void> {
  await pool.query("DELETE FROM render_outputs WHERE job_id = $1", [jobId]);
}

// Runs fn while holding a database lock on key; returns null if someone else
// holds it (they're already doing the same work).
export async function tryWithLock<T>(pool: pg.Pool, key: string, fn: () => Promise<T>): Promise<T | null> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [key]);
    if (!rows[0]?.ok) return null;
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]);
    }
  } finally {
    client.release();
  }
}
