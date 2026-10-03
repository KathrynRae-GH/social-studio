import { useEffect, useMemo, useState } from "react";
import type { CalendarData, EntryView } from "../../../shared/content.ts";
import { KIND_LABELS, ROUTE_LABELS, STATUS_LABELS } from "../../../shared/channels.ts";
import type { Me } from "../../../shared/roles.ts";
import { api, downloadPack } from "../boutiqly.ts";
import { ErrorNote, StatusChip, Thumb, addDays, channelName, friendlyDate, friendlyTime, todayIn, weekStart } from "../components/bits.tsx";
import { SetupChecklist } from "../components/SetupChecklist.tsx";

type View = "week" | "list" | "month" | "grid";
const VIEWS: { id: View; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "list", label: "List" },
  { id: "month", label: "Month" },
  { id: "grid", label: "Instagram grid" },
];

function needsOk(e: EntryView): boolean {
  return e.status === "suggested" || e.status === "needs_attention" || (e.status === "approved" && e.dryRun);
}

interface Props {
  me: Me;
  hasOwner: boolean;
  onOpenTeam: () => void;
}

export function CalendarScreen({ me, hasOwner, onOpenTeam }: Props) {
  const timezone = me.brand?.timezone ?? "America/Chicago";
  const today = todayIn(timezone);
  const [view, setView] = useState<View>("week");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [data, setData] = useState<CalendarData | null>(null);
  const [error, setError] = useState("");

  async function load(range?: { from: string; to: string }) {
    setError("");
    try {
      setData(await api.calendar(range?.from, range?.to));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (view === "month") {
      const first = `${month}-01`;
      void load({ from: addDays(first, -7), to: addDays(first, 42) });
    } else {
      void load();
    }
  }, [view, month]);

  function replace(entry: EntryView) {
    setData((d) => (d ? { ...d, entries: d.entries.map((e) => (e.id === entry.id ? entry : e)) } : d));
  }
  function drop(id: string) {
    setData((d) => (d ? { ...d, entries: d.entries.filter((e) => e.id !== id) } : d));
  }

  const connected = (data?.accounts ?? []).some((a) => !a.expired);
  const showSetup = me.permissions.includes("manage_team") && (!hasOwner || !connected);

  return (
    <section>
      {showSetup && <SetupChecklist hasOwner={hasOwner} accountsConnected={connected} onOpenTeam={onOpenTeam} />}

      <div className="screen-head">
        <h1>Calendar</h1>
        <div className="filters" role="tablist" aria-label="Calendar view">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" aria-selected={view === v.id} className={view === v.id ? "chip-tab active" : "chip-tab"} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {data && !data.livePosting && (
        <p className="notice">
          Live posting is off for this shop. Approving shows exactly what would go to Boutiqly, but nothing is posted. Boutiqly's team turns it on from the Brand screen.
        </p>
      )}
      {data?.notices.map((n) => <p key={n} className="notice attention">{n}</p>)}
      <ErrorNote message={error} />
      {!data && !error && <p className="muted">Loading…</p>}

      {data && view === "week" && <WeekView data={data} today={today} onChange={replace} onRemove={drop} />}
      {data && view === "list" && <ListView data={data} today={today} onChange={replace} onRemove={drop} />}
      {data && view === "month" && (
        <MonthView data={data} month={month} today={today} setMonth={setMonth} onChange={replace} onRemove={drop} />
      )}
      {data && view === "grid" && <GridView data={data} />}
    </section>
  );
}

interface ViewProps {
  data: CalendarData;
  today: string;
  onChange: (e: EntryView) => void;
  onRemove: (id: string) => void;
}

function WeekView({ data, today, onChange, onRemove }: ViewProps) {
  // A rolling week from today, so what's coming up always shows.
  const end = addDays(today, 6);
  const pending = data.entries.filter((e) => needsOk(e) && e.date >= today);
  const thisWeek = data.entries.filter((e) => !needsOk(e) && e.date >= today && e.date <= end);
  return (
    <>
      <h2 className="section-title">Needs your OK ({pending.length})</h2>
      {pending.length === 0 && <p className="muted">Nothing waiting. New posts you add from the Library show up here.</p>}
      <div className="entry-list">
        {pending.map((e) => <EntryCard key={e.id} entry={e} timezone={data.timezone} onChange={onChange} onRemove={onRemove} />)}
      </div>
      <h2 className="section-title">Next 7 days, {friendlyDate(today)} to {friendlyDate(end)}</h2>
      {thisWeek.length === 0 && <p className="muted">Nothing approved for this week yet.</p>}
      <div className="entry-list">
        {thisWeek.map((e) => <EntryCard key={e.id} entry={e} timezone={data.timezone} onChange={onChange} onRemove={onRemove} />)}
      </div>
    </>
  );
}

function ListView({ data, today, onChange, onRemove }: ViewProps) {
  const start = weekStart(today);
  const end = addDays(start, 41);
  const days = useMemo(() => {
    const byDay = new Map<string, EntryView[]>();
    for (const e of data.entries) {
      if (e.date < start || e.date > end) continue;
      byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, start, end]);
  return (
    <>
      <p className="muted">Six weeks from {friendlyDate(start)}.</p>
      {days.length === 0 && <p className="muted">Nothing on the calendar for these six weeks yet.</p>}
      {days.map(([date, entries]) => (
        <div key={date} className="day-group">
          <h3 className={date === today ? "today" : ""}>{friendlyDate(date)}{date === today ? " · today" : ""}</h3>
          <div className="entry-list">
            {entries.map((e) => <EntryCard key={e.id} entry={e} timezone={data.timezone} onChange={onChange} onRemove={onRemove} />)}
          </div>
        </div>
      ))}
    </>
  );
}

function MonthView({ data, month, today, setMonth, onChange, onRemove }: ViewProps & { month: string; setMonth: (m: string) => void }) {
  const first = `${month}-01`;
  const gridStart = weekStart(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const [selected, setSelected] = useState<string | null>(null);
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${first}T12:00:00Z`));
  const shift = (by: number) => {
    const d = new Date(`${first}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + by);
    setMonth(d.toISOString().slice(0, 7));
  };
  const selectedEntry = data.entries.find((e) => e.id === selected);
  return (
    <>
      <div className="month-head">
        <button className="btn-secondary small" onClick={() => shift(-1)}>‹ Previous</button>
        <h2>{label}</h2>
        <button className="btn-secondary small" onClick={() => shift(1)}>Next ›</button>
      </div>
      <div className="month-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="month-dow">{d}</div>)}
        {cells.map((date) => {
          const entries = data.entries.filter((e) => e.date === date);
          return (
            <div key={date} className={`month-cell${date.slice(0, 7) !== month ? " other" : ""}${date === today ? " today" : ""}`}>
              <span className="month-day">{Number(date.slice(8))}</span>
              {entries.map((e) => (
                <button key={e.id} className={`month-item status-${e.status}`} onClick={() => setSelected(e.id)} title={`${channelName(e.channel)} · ${STATUS_LABELS[e.status]}`}>
                  {friendlyTime(e.time)} {channelName(e.channel)}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {selectedEntry && (
        <div className="selected-entry">
          <EntryCard entry={selectedEntry} timezone={data.timezone} onChange={onChange} onRemove={(id) => { setSelected(null); onRemove(id); }} />
        </div>
      )}
    </>
  );
}

function GridView({ data }: { data: CalendarData }) {
  const tiles = data.entries
    .filter((e) => e.channel === "instagram" && (e.kind === "post" || e.kind === "carousel" || e.kind === "reel"))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  return (
    <>
      <p className="muted">How the Instagram profile grid will look, newest first. Stories don't show on the grid.</p>
      {tiles.length === 0 && <p className="muted">No Instagram feed posts on the calendar yet.</p>}
      <div className="ig-grid">
        {tiles.map((e) => (
          <figure key={e.id} className="ig-tile">
            <Thumb asset={e.preview} className="ig-img" />
            <figcaption>
              <StatusChip status={e.status} dryRun={e.dryRun} />
              <span>{friendlyDate(e.date)}</span>
              {e.kind !== "post" && <span className="ig-kind">{KIND_LABELS[e.kind]}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

function EntryCard({ entry: e, timezone, onChange, onRemove }: { entry: EntryView; timezone: string; onChange: (e: EntryView) => void; onRemove: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [moving, setMoving] = useState(false);
  const [when, setWhen] = useState({ date: e.date, time: e.time });
  const sent = e.sentFrames > 0 || e.status === "scheduled" || e.status === "posted";
  const canApprove = needsOk(e);
  const planner = e.route === "publish" || e.route === "app_ping";
  const canDraft = planner && e.draftsSent < e.frames && e.status !== "scheduled" && e.status !== "posted";
  const byHand = (e.route === "pack" || e.route === "share_from_ig" || e.route === "app_ping") && (e.status === "approved" || e.status === "scheduled") && !e.dryRun;

  async function run<T>(fn: () => Promise<T>, after: (r: T) => void) {
    setBusy(true);
    setError("");
    try {
      after(await fn());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`entry-card status-border-${e.status}`}>
      <Thumb asset={e.preview} className="entry-thumb" />
      <div className="entry-body">
        <div className="entry-top">
          <strong>{e.pieceTitle || KIND_LABELS[e.kind]}</strong>
          <StatusChip status={e.status} dryRun={e.dryRun} />
        </div>
        <span className="muted small">
          {channelName(e.channel)} · {KIND_LABELS[e.kind]} · {friendlyDate(e.date)}, {friendlyTime(e.time)}
          {e.frames > 1 ? ` · ${e.frames} frames` : ""}
        </span>
        <span className="small route">{ROUTE_LABELS[e.route]}{e.route === "app_ping" && e.frames > 1 ? ", one ping per frame a minute apart" : ""}</span>
        {e.routeNote && <span className="small muted">{e.routeNote}</span>}
        {e.caption && <p className="entry-caption">{e.caption}</p>}
        {e.lastError && <p className="error small">{e.lastError}{e.sentFrames > 0 && e.frames > 1 ? ` (${e.sentFrames} of ${e.frames} frames sent; Approve again to send the rest)` : ""}</p>}
        {e.draftsSent > 0 && e.draftSentAt && (
          <span className="small muted">
            Draft in Boutiqly's social planner, sent {friendlyDate(new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(e.draftSentAt)))}. Drafts never post.
          </span>
        )}
        {note && <p className="notice small">{note}</p>}
        <ErrorNote message={error} />

        {moving && (
          <div className="field-row">
            <input type="date" value={when.date} onChange={(ev) => setWhen((w) => ({ ...w, date: ev.target.value }))} aria-label="Date" />
            <input type="time" value={when.time} onChange={(ev) => setWhen((w) => ({ ...w, time: ev.target.value }))} aria-label={`Time (${timezone})`} />
            <button className="btn-secondary small" disabled={busy} onClick={() => run(() => api.move(e.id, when.date, when.time), (r) => { setMoving(false); onChange(r.entry); })}>Save</button>
            <button className="btn-link small" onClick={() => setMoving(false)}>Cancel</button>
          </div>
        )}

        <div className="entry-actions">
          {canApprove && (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                run(() => api.approve(e.id), (r) => {
                  onChange(r.entry);
                  if (r.dryRun) {
                    setNote(`Live posting is off, so nothing was sent. With it on, Boutiqly would get ${r.dryRun.length} ${r.dryRun.length === 1 ? "post" : "posts"} for ${channelName(e.channel)}, starting ${friendlyDate(e.date)} at ${friendlyTime(e.time)}.`);
                  }
                })
              }
            >
              {busy ? "Sending…" : e.status === "needs_attention" ? "Try again" : "Approve"}
            </button>
          )}
          {canDraft && (
            <button
              className="btn-secondary small"
              disabled={busy}
              title="Creates a draft in Boutiqly's social planner. Drafts never post."
              onClick={() =>
                run(() => api.sendDraft(e.id), (r) => {
                  onChange(r.entry);
                  setNote(
                    r.alreadySent
                      ? "This is already in Boutiqly's social planner as a draft."
                      : `Sent. Open Boutiqly's social planner and look under Drafts to see ${e.frames > 1 ? `the ${e.frames} drafts` : "it"}. Drafts never post.`,
                  );
                })
              }
            >
              {e.draftsSent > 0 ? "Send the rest as drafts" : "Send to Boutiqly as a draft"}
            </button>
          )}
          {e.route === "pack" && e.status !== "suggested" && (
            <button className="btn-secondary small" disabled={busy} onClick={() => run(() => downloadPack(e.id, `${e.channel}-${e.date}.zip`), () => {})}>
              Download pack
            </button>
          )}
          {byHand && (
            <button className="btn-secondary small" disabled={busy} onClick={() => run(() => api.markPosted(e.id), (r) => onChange(r.entry))}>
              Mark posted
            </button>
          )}
          {!sent && !moving && <button className="btn-link small" onClick={() => setMoving(true)}>Move</button>}
          {!sent && (
            <button className="btn-link small" disabled={busy} onClick={() => run(() => api.unschedule(e.id), () => onRemove(e.id))}>
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
