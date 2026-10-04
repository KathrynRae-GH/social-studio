import { useEffect, useState } from "react";
import type { AssetView } from "../../../shared/content.ts";

// A large preview of a post as people will see it: every slide, swipeable,
// with the caption for the channel being looked at underneath.
export function PostPreview({ files, caption, channelName, shopName }: { files: AssetView[]; caption: string; channelName: string; shopName: string }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  useEffect(() => setI((n) => Math.min(n, Math.max(0, files.length - 1))), [files.length]);
  if (files.length === 0) return null;
  const f = files[i]!;
  const go = (by: number) => setI((n) => (n + by + files.length) % files.length);
  const long = caption.length > 180;

  return (
    <section className="post-preview" aria-label="Post preview">
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
      <div className="preview-caption">
        <span className="muted small">{channelName} caption</span>
        {caption ? (
          <p>
            <strong>{shopName || "Your shop"}</strong> {long && !full ? `${caption.slice(0, 180)}…` : caption}
            {long && (
              <button className="btn-link small" onClick={() => setFull((v) => !v)}>{full ? " less" : " more"}</button>
            )}
          </p>
        ) : (
          <p className="muted small">No caption yet for {channelName}.</p>
        )}
      </div>
    </section>
  );
}
