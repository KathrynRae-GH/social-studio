"""The jobs table contract shared with the server (server/migrations).

A job is claimed with FOR UPDATE SKIP LOCKED so two workers never take the
same one. Failed jobs retry with a growing delay, up to MAX_ATTEMPTS.
"""

from __future__ import annotations

from typing import Any, Callable

from psycopg.types.json import Json

MAX_ATTEMPTS = 3

CLAIM_SQL = """
UPDATE jobs SET status = 'running', started_at = now(), attempts = attempts + 1
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'queued' AND run_after <= now()
  ORDER BY run_after
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING id, kind, payload, attempts
"""

Handler = Callable[[dict[str, Any]], dict[str, Any]]


def ping(payload: dict[str, Any]) -> dict[str, Any]:
    """A no-op job used to check the worker end to end."""
    return {"pong": True, "echo": payload.get("echo")}


HANDLERS: dict[str, Handler] = {"ping": ping}


def retry_delay_seconds(attempts: int) -> int:
    return 30 * (2 ** max(attempts - 1, 0))


def run_one(conn, handlers: dict[str, Handler] = HANDLERS) -> bool:
    """Claims and runs one job. Returns False when there was nothing to do."""
    with conn.transaction():
        row = conn.execute(CLAIM_SQL).fetchone()
    if row is None:
        return False
    job_id, kind, payload, attempts = row
    handler = handlers.get(kind)
    try:
        if handler is None:
            raise ValueError(f"No handler for job kind '{kind}'")
        result = handler(payload or {})
    except Exception as exc:  # noqa: BLE001 - every failure is recorded on the job
        final = attempts >= MAX_ATTEMPTS or handler is None
        conn.execute(
            """UPDATE jobs SET status = %s, error = %s, finished_at = CASE WHEN %s THEN now() END,
                   run_after = now() + make_interval(secs => %s)
               WHERE id = %s""",
            ("failed" if final else "queued", str(exc)[:2000], final, retry_delay_seconds(attempts), job_id),
        )
        conn.commit()
        return True
    conn.execute(
        "UPDATE jobs SET status = 'done', result = %s, error = NULL, finished_at = now() WHERE id = %s",
        (Json(result), job_id),
    )
    conn.commit()
    return True
