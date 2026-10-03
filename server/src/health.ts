// The health page: is the database reachable, is the worker alive, and
// which settings still need filling in (names only, never values).
import type pg from "pg";

export interface HealthReport {
  ok: boolean;
  database: "ok" | "unreachable";
  worker: { status: "ok" | "quiet" | "never seen"; lastBeat: string | null };
  missingSettings: string[];
  checkedAt: string;
}

const WORKER_QUIET_AFTER_MS = 2 * 60 * 1000;

export async function healthReport(pool: pg.Pool, missingSettings: string[]): Promise<HealthReport> {
  let database: HealthReport["database"] = "ok";
  let lastBeat: Date | null = null;
  try {
    const res = await pool.query<{ beat: Date | null }>(
      "SELECT max(beat_at) AS beat FROM worker_heartbeats",
    );
    lastBeat = res.rows[0]?.beat ?? null;
  } catch {
    database = "unreachable";
  }
  const workerStatus = !lastBeat ? "never seen" : Date.now() - lastBeat.getTime() > WORKER_QUIET_AFTER_MS ? "quiet" : "ok";
  return {
    // The web service is healthy when it can reach its database. A quiet
    // worker is shown but doesn't fail the health check (Render would
    // otherwise restart the web service for a worker problem).
    ok: database === "ok",
    database,
    worker: { status: workerStatus, lastBeat: lastBeat?.toISOString() ?? null },
    missingSettings,
    checkedAt: new Date().toISOString(),
  };
}

function row(label: string, good: boolean, text: string): string {
  const color = good ? "#99cc99" : "#e9c0d1";
  return `<tr><th>${label}</th><td><span style="background:${color}">${text}</span></td></tr>`;
}

export function healthPage(r: HealthReport): string {
  const workerText =
    r.worker.status === "ok" ? "Running" : r.worker.status === "quiet" ? `Quiet since ${r.worker.lastBeat}` : "Not started yet";
  const settingsText = r.missingSettings.length ? `Still to add: ${r.missingSettings.join(", ")}` : "All set";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Social Studio status</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap">
<style>body{font-family:Montserrat,system-ui,sans-serif;background:#fbf8f3;color:#1d3c34;margin:0;padding:48px 16px}
main{max-width:560px;margin:auto;background:#fff;border:1px solid #e8eeeb;border-radius:12px;padding:24px}
h1{margin-top:0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 4px;border-top:1px solid #e8eeeb}
th{width:38%;font-weight:600}td span{display:inline-block;padding:3px 10px;border-radius:10px;color:#1d3c34}p{color:#5b6f69;font-size:14px}</style></head>
<body><main><h1>Social Studio is ${r.ok ? "up" : "having trouble"}</h1><table>
${row("Web app", true, "Running")}
${row("Database", r.database === "ok", r.database === "ok" ? "Connected" : "Can't reach it")}
${row("Worker", r.worker.status === "ok", workerText)}
${row("Settings", r.missingSettings.length === 0, settingsText)}
</table><p>Checked ${r.checkedAt}</p></main></body></html>`;
}
