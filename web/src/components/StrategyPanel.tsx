import { useEffect, useRef, useState } from "react";
import type { Me } from "../../../shared/roles.ts";
import { CHANNELS, channel } from "../../../shared/channels.ts";
import { DAYS, DAY_LABELS, MAX_PILLARS, MAX_SLOTS, slotLabel, type ChannelTimes, type Day, type Pillar, type StrategyLink, type StrategyView } from "../../../shared/strategy.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote } from "./bits.tsx";

const LINK_KINDS = [...CHANNELS.map((c) => ({ id: c.id as string, name: c.name })), { id: "website", name: "Website" }, { id: "other", name: "Other" }];

// Brand → Strategy: when to post on each network, and what to post about.
export function StrategyPanel({ me }: { me: Me }) {
  const canEdit = me.permissions.includes("manage_brand");
  const [s, setS] = useState<StrategyView | null>(null);
  const [links, setLinks] = useState<StrategyLink[]>([]);
  const [times, setTimes] = useState<Record<string, ChannelTimes>>({});
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(v: StrategyView) {
    setS(v);
    setLinks(v.links);
    setTimes(v.times);
    setPillars(v.pillars);
    setDirty(false);
  }
  async function load() {
    try {
      show((await api.strategy()).strategy);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);
  // While Claude researches, check back every few seconds.
  useEffect(() => {
    if (!s?.suggesting) return;
    timer.current = setTimeout(() => void load(), 4000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [s]);

  async function run(label: string, fn: () => Promise<{ strategy: StrategyView }>) {
    setBusy(label);
    setError("");
    try {
      show((await fn()).strategy);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const edit = <T,>(set: (f: (x: T) => T) => void) => (f: (x: T) => T) => { set(f); setDirty(true); };
  const editTimes = edit(setTimes);
  const editPillars = edit(setPillars);
  const editLinks = edit(setLinks);

  function setSlot(ch: string, i: number, change: Partial<{ days: Day[]; time: string }>) {
    editTimes((t) => {
      const cur = t[ch] ?? { slots: [], why: "" };
      return { ...t, [ch]: { ...cur, slots: cur.slots.map((x, j) => (j === i ? { ...x, ...change } : x)) } };
    });
  }

  const status = s?.status ?? "none";
  const networks = [...new Set([...(s?.connected ?? []).map((c) => c.channel), ...links.map((l) => l.channel), ...Object.keys(times)])].filter((ch) => channel(ch));
  const total = pillars.reduce((n, p) => n + (Number(p.share) || 0), 0);
  const mixTotal = Object.values(s?.mix ?? {}).reduce((n, x) => n + x, 0);

  return (
    <div className="card strategy">
      <div className="screen-head">
        <h2>Strategy</h2>
        {status !== "none" && (
          <span className={`status-chip ${status === "approved" ? "status-approved" : "status-suggested"}`}>
            {status === "approved" ? `Approved${s?.approvedBy ? ` by ${s.approvedBy}` : ""}` : "Draft, not approved"}
          </span>
        )}
      </div>
      <p className="muted small">
        When to post on each network, and what to post about. Once approved, the times are the defaults for scheduling and Plan my calendar, and Claude tags each new post with a content pillar and keeps the mix on target.
      </p>

      <h3>Social accounts</h3>
      {(s?.connected.length ?? 0) > 0 && (
        <p className="small">
          Connected in Boutiqly's social planner: {s!.connected.map((c) => `${channel(c.channel)?.name ?? c.channel}${c.name ? ` (${c.name})` : ""}`).join(", ")}.
        </p>
      )}
      {links.map((l, i) => (
        <div key={i} className="field-row link-row">
          <select value={l.channel} disabled={!canEdit} onChange={(e) => editLinks((x) => x.map((y, j) => (j === i ? { ...y, channel: e.target.value } : y)))} aria-label="Network">
            {LINK_KINDS.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <input type="url" value={l.url} placeholder="https://" disabled={!canEdit} onChange={(e) => editLinks((x) => x.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} aria-label="Link" />
          {canEdit && <button className="btn-link small" onClick={() => editLinks((x) => x.filter((_, j) => j !== i))}>Remove</button>}
        </div>
      ))}
      {canEdit && (
        <button className="btn-link small" onClick={() => editLinks((x) => [...x, { channel: "instagram", url: "" }])}>+ Add a link (any network, or the website)</button>
      )}

      {canEdit && (
        <div className="suggest-box">
          <button className="btn-secondary" disabled={!!busy || !!s?.suggesting || dirty} onClick={() => run("Asking Claude…", () => api.suggestStrategy())}>
            {s?.suggestedAt ? "Ask Claude to suggest again" : "Ask Claude to suggest a strategy"}
          </button>
          <span className="muted small">
            {dirty ? "Save your changes first." : "Claude researches this shop and each network (about a minute, roughly 20–60¢). It replaces the times and pillars below with a draft for you to check."}
          </span>
        </div>
      )}
      {s?.suggesting && <p className="notice small">Claude is researching this shop and its networks… This takes a minute or two.</p>}
      {s?.suggestError && !s.suggesting && <p className="notice attention small">{s.suggestError}</p>}
      {s?.summary && <p className="strategy-summary">{s.summary}</p>}

      <h3>When to post</h3>
      {networks.length === 0 && <p className="muted small">Connect accounts in Boutiqly's social planner or add links above, then ask Claude, or add times yourself.</p>}
      <div className="times-list">
        {networks.map((ch) => {
          const t = times[ch];
          return (
            <div key={ch} className="times-row">
              <strong>{channel(ch)?.name}</strong>
              <div className="slots">
                {(t?.slots ?? []).map((slot, i) =>
                  canEdit ? (
                    <div key={i} className="slot-edit">
                      <span className="day-toggles">
                        {DAYS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={slot.days.includes(d) ? "day on" : "day"}
                            aria-pressed={slot.days.includes(d)}
                            onClick={() => setSlot(ch, i, { days: slot.days.includes(d) ? slot.days.filter((x) => x !== d) : DAYS.filter((x) => x === d || slot.days.includes(x)) })}
                          >
                            {DAY_LABELS[d].slice(0, 2)}
                          </button>
                        ))}
                      </span>
                      <input type="time" value={slot.time} onChange={(e) => setSlot(ch, i, { time: e.target.value })} aria-label={`${channel(ch)?.name} time`} />
                      <button className="btn-link small" onClick={() => editTimes((x) => ({ ...x, [ch]: { ...x[ch]!, slots: x[ch]!.slots.filter((_, j) => j !== i) } }))}>Remove</button>
                    </div>
                  ) : (
                    <span key={i} className="tag">{slotLabel(slot)}</span>
                  ),
                )}
                {canEdit && (t?.slots.length ?? 0) < MAX_SLOTS && (
                  <button
                    className="btn-link small"
                    onClick={() => editTimes((x) => ({ ...x, [ch]: { why: x[ch]?.why ?? "", slots: [...(x[ch]?.slots ?? []), { days: ["mon", "wed", "fri"], time: "11:00" }] } }))}
                  >
                    + Add a time
                  </button>
                )}
                {t?.why && <p className="muted small">{t.why}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <h3>Content pillars</h3>
      <p className="muted small">The themes this shop posts about, and roughly how often. {mixTotal > 0 ? "Last 30 days shown beside each target." : ""}</p>
      <div className="pillars">
        {pillars.map((p, i) => (
          <div key={p.id + i} className="pillar card-inset">
            <div className="field-row">
              <input className="grow" value={p.name} disabled={!canEdit} onChange={(e) => editPillars((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} aria-label="Pillar name" maxLength={60} />
              <label className="field share">
                <input type="number" min={0} max={100} value={p.share} disabled={!canEdit} onChange={(e) => editPillars((x) => x.map((y, j) => (j === i ? { ...y, share: Number(e.target.value) } : y)))} aria-label="Target share" />
                <span>%</span>
              </label>
              {mixTotal > 0 && <span className="muted small">now {Math.round(((s?.mix[p.id] ?? 0) / mixTotal) * 100)}%</span>}
              {canEdit && <button className="btn-link small" onClick={() => editPillars((x) => x.filter((_, j) => j !== i))}>Remove</button>}
            </div>
            <textarea rows={2} value={p.description} disabled={!canEdit} placeholder="What posts in this pillar are about" onChange={(e) => editPillars((x) => x.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} />
            {p.why && <p className="muted small"><strong>Why:</strong> {p.why}</p>}
            {p.examples.length > 0 && <ul className="small examples">{p.examples.map((x) => <li key={x}>{x}</li>)}</ul>}
          </div>
        ))}
      </div>
      {canEdit && pillars.length < MAX_PILLARS && (
        <button className="btn-link small" onClick={() => editPillars((x) => [...x, { id: "", name: "", description: "", why: "", share: 0, examples: [] }])}>+ Add a pillar</button>
      )}
      {pillars.length > 0 && total !== 100 && <p className="muted small">Targets add up to {total}%. They'll be scaled to 100% when you save.</p>}

      {busy && <p className="notice small">{busy}</p>}
      <ErrorNote message={error} />
      {canEdit && (
        <div className="sheet-actions">
          <button className="btn-secondary" disabled={!!busy || !dirty} onClick={() => run("Saving…", () => api.saveStrategy({ links: links.filter((l) => l.url.trim()), times, pillars: pillars.filter((p) => p.name.trim()) }))}>
            Save
          </button>
          {status !== "approved" && status !== "none" && !dirty && (
            <button className="btn-primary" disabled={!!busy} onClick={() => run("Approving…", () => api.approveStrategy())}>Approve strategy</button>
          )}
        </div>
      )}
    </div>
  );
}
