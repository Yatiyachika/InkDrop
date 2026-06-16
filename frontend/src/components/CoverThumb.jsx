import { useEffect, useState } from "react";
import api from "../lib/api";

/**
 * Thumbnail that lazily fetches the cover image via /api/story/:id/cover
 * when has_cover is true. Falls back to a vibe-tinted placeholder otherwise.
 */
export default function CoverThumb({ storyId, hasCover, vibe, className = "" }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasCover) return;
    api.get(`/story/${storyId}/cover`)
      .then((r) => {
        if (cancelled) return;
        if (r.data.cover_b64) {
          setSrc(`data:${r.data.cover_mime || "image/png"};base64,${r.data.cover_b64}`);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storyId, hasCover]);

  const vibeGradient = {
    dark_gritty: "linear-gradient(135deg,#1a0a0c 0%,#3a0e16 100%)",
    poetic_slow_burn: "linear-gradient(135deg,#0d1a14 0%,#1a3a2a 100%)",
    thriller: "linear-gradient(135deg,#0a0e1a 0%,#1a2238 100%)",
    cozy_nostalgic: "linear-gradient(135deg,#1a1208 0%,#3a2a14 100%)",
  }[vibe] || "linear-gradient(135deg,#161618 0%,#2a2a2c 100%)";

  if (src) {
    return <img src={src} alt="" className={`w-full h-full object-cover ${className}`} loading="lazy" />;
  }
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{ background: vibeGradient }}
    >
      <span className="text-[var(--ink-accent)] text-3xl opacity-30">⁂</span>
    </div>
  );
}
