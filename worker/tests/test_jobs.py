import os

import pytest

from worker.jobs import MAX_ATTEMPTS, ping, retry_delay_seconds, run_one

DB = os.environ.get("TEST_DATABASE_URL")


def test_ping():
    assert ping({"echo": "hi"}) == {"pong": True, "echo": "hi"}


def test_retry_delay_grows():
    assert [retry_delay_seconds(n) for n in (1, 2, 3)] == [30, 60, 120]


@pytest.fixture
def conn():
    if not DB:
        pytest.skip("TEST_DATABASE_URL not set")
    import psycopg

    with psycopg.connect(DB) as c:
        if c.execute("SELECT to_regclass('public.jobs')").fetchone()[0] is None:
            pytest.skip("jobs table missing: run the server migrations first")
        c.execute("DELETE FROM jobs")
        c.commit()
        yield c
        c.execute("DELETE FROM jobs")
        c.commit()


def test_runs_a_queued_job(conn):
    conn.execute("""INSERT INTO jobs (kind, payload) VALUES ('ping', '{"echo": 1}')""")
    conn.commit()
    assert run_one(conn) is True
    status, result = conn.execute("SELECT status, result FROM jobs").fetchone()
    assert status == "done" and result == {"pong": True, "echo": 1}
    assert run_one(conn) is False


def test_failing_job_retries_then_fails(conn):
    def boom(_payload):
        raise RuntimeError("nope")

    conn.execute("INSERT INTO jobs (kind) VALUES ('boom')")
    conn.commit()
    for attempt in range(1, MAX_ATTEMPTS + 1):
        conn.execute("UPDATE jobs SET run_after = now()")
        conn.commit()
        assert run_one(conn, {"boom": boom}) is True
        status, error = conn.execute("SELECT status, error FROM jobs").fetchone()
        assert error == "nope"
        assert status == ("failed" if attempt == MAX_ATTEMPTS else "queued")


def test_unknown_kind_fails_at_once(conn):
    conn.execute("INSERT INTO jobs (kind) VALUES ('mystery')")
    conn.commit()
    run_one(conn)
    assert conn.execute("SELECT status FROM jobs").fetchone()[0] == "failed"
