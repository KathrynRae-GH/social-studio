import { useEffect, useState, type ReactNode } from "react";
import type { AssetView } from "../../../shared/content.ts";

interface Props {
  files: AssetView[];
  channels: { id: string; name: string }[];
  captions: Record<string, string>;
  active: string;
  onActive: (id: string) => void;
  shopName: string;
  children?: ReactNode; // shown under the caption (love it / not this)
}

// The post as people will see it: the slides large on the left at their own
// shape, the caption for each channel on the right (stacked on a phone).
export function PostPreview({ files, channels, captions, active, onActive, shopName, children }: Props) {
  const [i, setI] = useState(0);
  useEffect(() => setI((n) => Math.min(n, Math.max(0, files.length - 1))), [files.length]);
  const go = (by: number) => setI((n) => (n + by + files.length) % files.length);
  const f = files[i];
  const caption = captions[active] ?? "";
  const channelName = channels.find((c) => c.id === active)?.name ?? "";

  return (
    <section className="preview-layout" aria-label="Post preview">
      {f && (
        <div className="preview-media-col">
          <div
            className="preview-frame"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") go(1);
              if (e.key === "ArrowLeft") go(-1);
            }}
          >
            {f.mime.startsWith("video/") ? (
              <video src={f.url} controls playsInline className="preview-media" />
            ) : (
              <img src={f.url} alt={`Slide ${i + 1} of ${files.length}`} className="preview-media" />
            )}
            {files.length > 1 && (
              <>
                <button className="preview-nav prev" onClick={() => go(-1)} aria-label="Previous slide">‹</button>
                <button className="preview-nav next" onClick={() => go(1)} aria-label="Next slide">›</button>
                <span className="preview-count">{i + 1} / {files.length}</span>
              </>
            )}
          </div>
          {files.length > 1 && (
            <div className="preview-dots" role="tablist" aria-label="Slides">
              {files.map((x, n) => (
                <button key={x.id + n} role="tab" aria-selected={n === i} aria-label={`Slide ${n + 1}`} className={n === i ? "dot active" : "dot"} onClick={() => setI(n)} />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="preview-side">
        <div className="channel-tabs" role="tablist" aria-label="Caption for">
          {channels.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === active} className={c.id === active ? "chip-tab active" : "chip-tab"} onClick={() => onActive(c.id)}>
              {c.name}
              {captions[c.id] ? "" : " ·"}
            </button>
          ))}
        </div>
        <div className="preview-caption">
          {caption ? (
            <p>
              <strong>{shopName || "Your shop"}</strong> {caption}
            </p>
          ) : (
            <p className="muted small">No caption yet for {channelName}.</p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
