import { useEffect, useState } from "react";
import type { AssetDetail } from "../../../shared/content.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote, Thumb } from "../components/bits.tsx";

type Filter = "all" | "usable" | "attention" | "untagged" | "designs";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "usable", label: "Claude can use" },
  { id: "attention", label: "Needs a look" },
  { id: "untagged", label: "Not tagged yet" },
  { id: "designs", label: "Finished designs" },
];

const PEOPLE_RULES: { id: AssetDetail["peopleRule"]; label: string }[] = [
  { id: "ok", label: "Use freely" },
  { id: "no_faces", label: "No faces" },
  { id: "dont_use", label: "Don't use" },
];

const FLAG_LABELS: Record<string, string> = {
  receipt: "Receipt",
  email: "Email address",
  phone: "Phone number",
  address: "Street address",
  customer_name: "Customer name",
  payment: "Payment details",
  customer_screen: "Screen with customer data",
  swear_word: "Swear word",
  license_plate: "License plate",
  other: "Private detail",
};

function needsLook(a: AssetDetail): boolean {
  return a.tagged && !a.flagsCleared && (a.sensitive.length > 0 || a.possibleMinor);
}

export function AssetsScreen() {
  const [list, setList] = useState<AssetDetail[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<AssetDetail | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setList((await api.assets()).assets);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function replace(a: AssetDetail) {
    setList((l) => (l ?? []).map((x) => (x.id === a.id ? a : x)));
    setOpen((o) => (o?.id === a.id ? a : o));
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setBusy(`Uploading ${files.length} file${files.length > 1 ? "s" : ""} to Boutiqly media storage…`);
    try {
      for (const f of Array.from(files)) await api.upload(f);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function run(label: string, fn: () => Promise<void>) {
    setError("");
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function blur(a: AssetDetail) {
    await run("Blurring the flagged details…", async () => {
      const { jobId } = await api.blurAsset(a.id);
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const res = await api.blurResult(a.id, jobId);
        if (res.status === "failed") throw new Error(res.error ?? "The blur didn't work.");
        if (res.status === "done" && res.asset) {
          setList((l) => [res.asset!, ...(l ?? [])]);
          setOpen(res.asset);
          return;
        }
      }
      throw new Error("The blur is taking a while. Check back in a minute.");
    });
  }

  const shown = (list ?? []).filter((a) => {
    if (filter === "designs") return a.madeBy === "render";
    if (a.madeBy === "render") return false;
    if (filter === "usable") return a.usable.ok;
    if (filter === "attention") return needsLook(a);
    if (filter === "untagged") return !a.tagged;
    return true;
  });

  return (
    <section>
      <div className="screen-head">
        <h1>Assets</h1>
        <label className="btn-secondary">
          Upload photos or videos
          <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      <p className="muted small">
        Claude looks at each photo when it's uploaded (while Claude is on) and flags people and private details. Claude only designs with files marked "Claude can use".
      </p>

      <div className="filters" role="tablist" aria-label="Filter files">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? "chip-tab active" : "chip-tab"} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {busy && <p className="notice">{busy}</p>}
      <ErrorNote message={error} />
      {list === null && !error && <p className="muted">Loading…</p>}
      {list?.length === 0 && <div className="card empty"><p>No files yet. Upload the shop's photos, product shots and graphics here.</p></div>}

      <div className="asset-grid">
        {shown.map((a) => (
          <button key={a.id} className="asset-card" onClick={() => setOpen(a)}>
            <Thumb asset={a} className="asset-thumb" />
            <span className="asset-meta">
              <span className="small asset-name">{a.name}</span>
              {a.madeBy === "render" ? (
                <span className="status-chip status-scheduled">Design</span>
              ) : !a.tagged ? (
                <span className="status-chip status-suggested">Not tagged</span>
              ) : needsLook(a) ? (
                <span className="status-chip status-needs_attention">Needs a look</span>
              ) : a.usable.ok ? (
                <span className="status-chip status-approved">Claude can use</span>
              ) : (
                <span className="status-chip status-needs_attention">Not for Claude</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div className="overlay" role="dialog" aria-label="File details">
          <div className="sheet">
            <div className="sheet-head">
              <h2>{open.name || "File"}</h2>
              <button className="btn-link" onClick={() => setOpen(null)}>Close</button>
            </div>
            <div className="asset-detail">
              <div className="asset-preview">
                <Thumb asset={open} className="asset-big" />
                {open.sensitive.map((s, i) =>
                  s.box ? (
                    <span
                      key={i}
                      className="flag-box"
                      title={FLAG_LABELS[s.kind] ?? s.kind}
                      style={{ left: `${s.box.x * 100}%`, top: `${s.box.y * 100}%`, width: `${s.box.w * 100}%`, height: `${s.box.h * 100}%` }}
                    />
                  ) : null,
                )}
              </div>
              <div className="asset-info">
                {open.tagged ? (
                  <>
                    <p>{open.description || <span className="muted">No description.</span>}</p>
                    {open.tags.length > 0 && <p className="tag-row">{open.tags.map((t) => <span key={t} className="tag">{t}</span>)}</p>}
                    <p className="small">{open.hasPeople ? "People are in this file." : "No people seen."}{open.possibleMinor ? " Someone may be under 18." : ""}</p>
                  </>
                ) : (
                  <p className="muted">Claude hasn't looked at this file yet.</p>
                )}
                {open.madeBy === "blur" && <p className="small muted">A blurred copy of another file.</p>}

                {open.sensitive.length > 0 && (
                  <>
                    <h3>Flagged details</h3>
                    <ul className="flag-list">
                      {open.sensitive.map((s, i) => <li key={i}><strong>{FLAG_LABELS[s.kind] ?? s.kind}</strong>{s.note ? `: ${s.note}` : ""}</li>)}
                    </ul>
                  </>
                )}

                {open.madeBy !== "render" && (
                  <>
                    <h3>People rule</h3>
                    <div className="field-row">
                      {PEOPLE_RULES.map((r) => (
                        <label key={r.id} className="check">
                          <input
                            type="radio"
                            name="people-rule"
                            checked={open.peopleRule === r.id}
                            onChange={() => void run("Saving…", async () => replace((await api.setAssetRules(open.id, { peopleRule: r.id })).asset))}
                          />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}

                <p className={open.usable.ok ? "notice small" : "notice attention small"}>
                  {open.usable.ok ? "Claude can use this file in designs." : open.usable.reason}
                </p>

                <div className="sheet-actions">
                  {!open.tagged && open.mime.startsWith("image/") && open.madeBy !== "render" && (
                    <button className="btn-secondary small" disabled={!!busy} onClick={() => void run("Claude is looking at it…", async () => replace((await api.tagAsset(open.id)).asset))}>
                      Have Claude look at it
                    </button>
                  )}
                  {open.sensitive.some((s) => s.box) && open.madeBy === "upload" && (
                    <button className="btn-secondary small" disabled={!!busy} onClick={() => void blur(open)}>
                      Make a blurred copy
                    </button>
                  )}
                  {needsLook(open) && (
                    <button className="btn-secondary small" disabled={!!busy} onClick={() => void run("Saving…", async () => replace((await api.setAssetRules(open.id, { flagsCleared: true })).asset))}>
                      {open.possibleMinor ? "Everyone shown is 18+, and it's fine to use" : "It's fine to use as is"}
                    </button>
                  )}
                  {open.flagsCleared && (open.sensitive.length > 0 || open.possibleMinor) && (
                    <button className="btn-link small" disabled={!!busy} onClick={() => void run("Saving…", async () => replace((await api.setAssetRules(open.id, { flagsCleared: false })).asset))}>
                      Undo clearing the flags
                    </button>
                  )}
                </div>
                <ErrorNote message={error} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
