import { useEffect, useState, type ReactNode } from "react";
import type { AssetView } from "../../../shared/content.ts";

interface Props {
  files: AssetView[];
  children?: ReactNode; // the right-hand side: captions, approve, love it / not this
}

// The post as people will see it: the slides large on the left at their own
// shape, and beside them (stacked on a phone) whatever the editor puts there.
export function PostPreview({ files, children }: Props) {
  const [i, setI] = useState(0);
  useEffect(() => setI((n) => Math.min(n, Math.max(0, files.length - 1))), [files.length]);
  const go = (by: number) => setI((n) => (n + by + files.length) % files.length);
  const f = files[i];

  return (
    <section className={f ? "preview-layout" : "preview-layout no-media"} aria-label="Post preview">
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
      <div className="preview-side">{children}</div>
    </section>
  );
}
