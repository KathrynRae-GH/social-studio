import { useEffect, useMemo, useState } from "react";
import type { CalendarData, EntryView, PlanResult, SendResult } from "../../../shared/content.ts";
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

// Upcoming entries that still need a person: not locked yet, or a problem.
function needsOk(e: EntryView): boolean {
  return e.status === "suggested" || e.status === "needs_attention" || (e.status === "approved" && !e.locked);
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

      {data && <PlanBar data={data} today={today} onDone={() => void load(view === "month" ? { from: addDays(`${month}-01`, -7), to: addDays(`${month}-01`, 42) } : undefined)} />}
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

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Plan my calendar → lock → send: the three one-click steps.
function PlanBar({ data, today, onDone }: { data: CalendarData; today: string; onDone: () => void }) {
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [planned, setPlanned] = useState<PlanResult | null>(null);
  const [sent, setSent] = useState<SendResult | null>(null);
  const upcoming = data.entries.filter((e) => e.date >= today);
  const unlocked = upcoming.filter((e) => e.status === "approved" && !e.locked).length;
  const toSend = upcoming.filter((e) => e.locked && (e.status === "approved" || e.status === "needs_attention") && (e.route === "publish" || e.route === "app_ping") && (data.livePosting || e.draftsSent === 0)).length;
  const anyPlanned = upcoming.some((e) => e.status !== "suggested");

  async function run<T>(label: string, fn: () => Promise<T>, after: (r: T) => void) {
    setBusy(label);
    setError("");
    try {
      after(await fn());
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card plan-bar">
      <div className="plan-step">
        <h2>1. Plan</h2>
        <p className="small">
          {data.waiting > 0
            ? <><strong>{data.waiting}</strong> approved {data.waiting === 1 ? "post is" : "posts are"} waiting for a date. Claude puts them in a good order and spreads them out; nothing already on the calendar moves.</>
            : "Approve posts in the Library, then Claude puts them on the calendar."}
        </p>
        <div className="field-row">
          <label className="field">
            <span>How far ahead</span>
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              <option value={4}>Next 4 weeks</option>
              <option value={8}>Next 8 weeks</option>
              <option value={12}>Next 12 weeks</option>
            </select>
          </label>
          <button className="btn-secondary" disabled={!!busy || data.waiting === 0} onClick={() => run("Claude is planning your calendar…", () => api.plan(weeks, false), (r) => { setPlanned(r); setSent(null); })}>
            Plan my calendar
          </button>
          {anyPlanned && (
            <button className="btn-link small" disabled={!!busy || data.waiting === 0} onClick={() => run("Claude is planning 4 more weeks…", () => api.plan(4, true), (r) => { setPlanned(r); setSent(null); })}>
              Plan 4 more weeks after that
            </button>
          )}
        </div>
      </div>

      <div className="plan-step">
        <h2>2. Lock</h2>
        <p className="small">Happy with a date? Lock it. Locked posts don't move, and Claude plans around them.</p>
        <button className="btn-secondary" disabled={!!busy || unlocked === 0} onClick={() => run("Locking…", () => api.lockAll(), () => {})}>
          Lock all {unlocked > 0 ? unlocked : ""} planned
        </button>
      </div>

      <div className="plan-step">
        <h2>3. Send</h2>
        <p className="small">
          {data.livePosting
            ? "Sends every locked post to Boutiqly's social planner, scheduled. Each one goes once."
            : "Live posting is off for this shop, so locked posts go to Boutiqly's social planner as drafts (drafts never post). Each one goes once."}
        </p>
        <button className="btn-primary" disabled={!!busy || toSend === 0} onClick={() => run("Sending to Boutiqly…", () => api.sendLocked(), (r) => { setSent(r); setPlanned(null); })}>
          Send {toSend > 0 ? toSend : ""} locked to Boutiqly
        </button>
      </div>

      {busy && <p className="notice plan-wide">{busy}</p>}
      <ErrorNote message={error} />
      {planned && (
        <div className="notice plan-wide">
          <p>
            {planned.placed > 0 ? `Placed ${planned.placed} on the calendar, ${friendlyDate(planned.from)} to ${friendlyDate(planned.to)}.` : "Nothing new was placed."}
            {planned.note ? ` ${planned.note}` : ""}
            {planned.costCents > 0 ? ` (Claude cost ${dollars(planned.costCents)}.)` : ""}
          </p>
          {planned.notPlaced.length > 0 && (
            <ul className="small">
              {planned.notPlaced.map((n) => <li key={n.pieceId}><strong>{n.title}</strong>: {n.reason}</li>)}
            </ul>
          )}
        </div>
      )}
      {sent && (
        <div className="notice plan-wide">
          <p>
            {sent.live
              ? `Scheduled ${sent.scheduled} in Boutiqly's social planner.`
              : `Sent ${sent.drafted} to Boutiqly's social planner as drafts. Look under Drafts there.`}
            {sent.alreadySent ? ` ${sent.alreadySent} had already gone as drafts, so they weren't sent again.` : ""}
            {sent.byHand ? ` ${sent.byHand} go out by hand (download their packs below).` : ""}
          </p>
          {sent.problems.length > 0 && (
            <ul className="small">
              {sent.problems.map((p) => <li key={p.entryId}>{p.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
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
      <h2 className="section-title">Not locked yet ({pending.length})</h2>
      {pending.length === 0 && <p className="muted">Nothing waiting. Planned posts show up here until you lock them.</p>}
      <div className="entry-list">
        {pending.map((e) => <EntryCard key={e.id} entry={e} timezone={data.timezone} onChange={onChange} onRemove={onRemove} />)}
      </div>
      <h2 className="section-title">Next 7 days, {friendlyDate(today)} to {friendlyDate(end)}</h2>
      {thisWeek.length === 0 && <p className="muted">Nothing locked for this week yet.</p>}
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
                <button key={e.id} className={`month-item status-${e.status}`} onClick={() => setSelected(e.id)} title={`${channelName(e.channel)} · ${e.locked && e.status === "approved" ? "Locked" : STATUS_LABELS[e.status]}`}>
                  {e.locked && e.status === "approved" ? "🔒 " : ""}{friendlyTime(e.time)} {channelName(e.channel)}
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
              <StatusChip status={e.status} locked={e.locked} />
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
  const [moving, setMoving] = useState(false);
  const [when, setWhen] = useState({ date: e.date, time: e.time });
  const sent = e.sentFrames > 0 || e.status === "scheduled" || e.status === "posted";
  const byHand = (e.route === "pack" || e.route === "share_from_ig" || e.route === "app_ping") && (e.status === "approved" || e.status === "scheduled") && e.locked;
  const canLock = e.status === "approved" || e.status === "needs_attention";

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
    <article className={`entry-card status-border-${e.status}${e.locked ? " locked" : ""}`}>
      <Thumb asset={e.preview} className="entry-thumb" />
      <div className="entry-body">
        <div className="entry-top">
          <strong>{e.pieceTitle || KIND_LABELS[e.kind]}</strong>
          <StatusChip status={e.status} locked={e.locked} />
        </div>
        <span className="muted small">
          {channelName(e.channel)} · {KIND_LABELS[e.kind]} · {friendlyDate(e.date)}, {friendlyTime(e.time)}
          {e.frames > 1 ? ` · ${e.frames} frames` : ""}
        </span>
        <span className="small route">{ROUTE_LABELS[e.route]}{e.route === "app_ping" && e.frames > 1 ? ", one ping per frame a minute apart" : ""}</span>
        {e.routeNote && <span className="small muted">{e.routeNote}</span>}
        {e.status === "suggested" && <span className="small muted">From before approvals moved to the Library: approve the post there, then plan again.</span>}
        {e.caption && <p className="entry-caption">{e.caption}</p>}
        {e.lastError && <p className="error small">{e.lastError}{e.sentFrames > 0 && e.frames > 1 ? ` (${e.sentFrames} of ${e.frames} frames sent; Send again sends the rest)` : ""}</p>}
        {e.draftsSent > 0 && e.draftSentAt && e.status !== "scheduled" && e.status !== "posted" && (
          <span className="small muted">
            Draft in Boutiqly's social planner, sent {friendlyDate(new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(e.draftSentAt)))}. Drafts never post.
          </span>
        )}
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
          {canLock && !e.locked && (
            <button className="btn-secondary small" disabled={busy} onClick={() => run(() => api.lock(e.id, true), (r) => onChange(r.entry))}>🔒 Lock</button>
          )}
          {e.locked && !sent && (
            <button className="btn-link small" disabled={busy} onClick={() => run(() => api.lock(e.id, false), (r) => onChange(r.entry))}>Unlock</button>
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
          {!sent && !e.locked && !moving && <button className="btn-link small" onClick={() => setMoving(true)}>Move</button>}
          {!sent && !e.locked && (
            <button className="btn-link small" disabled={busy} onClick={() => run(() => api.unschedule(e.id), () => onRemove(e.id))}>
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
