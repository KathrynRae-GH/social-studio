"""Social Studio worker: renders and long Claude jobs (from Milestone 3).

For now it proves it's alive (a heartbeat the health page reads) and runs
jobs from the jobs table.
"""

from __future__ import annotations

import os
import signal
import socket
import time

import psycopg

from .jobs import run_one

VERSION = "0.1.0"
HEARTBEAT_EVERY = 30  # seconds
IDLE_SLEEP = 2  # seconds between empty polls

_stopping = False


def _stop(*_args) -> None:
    global _stopping
    _stopping = True


def heartbeat(conn, worker_id: str) -> None:
    conn.execute(
        """INSERT INTO worker_heartbeats (worker_id, beat_at, version) VALUES (%s, now(), %s)
           ON CONFLICT (worker_id) DO UPDATE SET beat_at = now(), version = excluded.version""",
        (worker_id, VERSION),
    )
    conn.commit()


def tables_ready(conn) -> bool:
    row = conn.execute("SELECT to_regclass('public.worker_heartbeats') IS NOT NULL").fetchone()
    conn.commit()
    return bool(row and row[0])


def main() -> None:
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    url = os.environ.get("DATABASE_URL", "postgresql://localhost:5432/social_studio")
    worker_id = os.environ.get("RENDER_INSTANCE_ID") or socket.gethostname()

    while not _stopping:
        try:
            with psycopg.connect(url) as conn:
                # The web service creates the tables on its first start.
                while not _stopping and not tables_ready(conn):
                    print("Waiting for the database tables…", flush=True)
                    time.sleep(10)
                print(f"Worker {worker_id} running", flush=True)
                last_beat = 0.0
                while not _stopping:
                    if time.monotonic() - last_beat >= HEARTBEAT_EVERY:
                        heartbeat(conn, worker_id)
                        last_beat = time.monotonic()
                    if not run_one(conn):
                        time.sleep(IDLE_SLEEP)
        except psycopg.OperationalError as exc:
            print(f"Database connection problem, retrying in 10s: {exc}", flush=True)
            time.sleep(10)
    print("Worker stopped", flush=True)


if __name__ == "__main__":
    main()
