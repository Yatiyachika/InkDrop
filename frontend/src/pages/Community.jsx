import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import CoverThumb from "../components/CoverThumb";

export default function Community() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/community/feed").then((r) => setItems(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen grain">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-14">
        <p className="eyebrow mb-3">the salon</p>
        <h1 className="display text-5xl md:text-6xl mb-2">Read what they've written.</h1>
        <p className="text-[var(--ink-text-2)] max-w-2xl">Stories shared by other writers in the press. Pour yourself a drink. Lurk.</p>

        {loading ? (
          <p className="mt-12 italic text-[var(--ink-text-2)]">Pulling the latest off the press…</p>
        ) : items.length === 0 ? (
          <div className="mt-16 border border-white/10 p-16 text-center">
            <p className="display text-3xl italic">The salon is quiet tonight.</p>
            <p className="text-[var(--ink-text-2)] mt-3">Share a story from your bookshelf and start the room.</p>
          </div>
        ) : (
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {items.map((s) => (
              <button
                key={s.id}
                onClick={() => nav(`/read/${s.id}`)}
                className="ink-card text-left flex gap-5 items-start"
                data-testid={`community-story-${s.id}`}
              >
                <div className="w-28 aspect-[3/4] flex-shrink-0 border border-[var(--ink-border)] overflow-hidden">
                  <CoverThumb storyId={s.id} hasCover={s.has_cover} vibe={s.vibe} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="eyebrow text-[var(--ink-accent)] truncate">{s.vibe.replace(/_/g, " ")}</p>
                    <p className="mono text-[0.65rem] text-[var(--ink-text-2)] uppercase tracking-[0.2em] flex-shrink-0 ml-2">{s.chunk_count} ch</p>
                  </div>
                  <p className="display text-2xl leading-tight mb-2 line-clamp-2">{s.title}</p>
                  <p className="mono text-[0.65rem] uppercase tracking-[0.22em] text-[var(--ink-text-2)] mb-3">
                    by <em className="not-italic text-[var(--ink-text)]">{s.author}</em>
                  </p>
                  <p className="text-[var(--ink-text-2)] italic leading-relaxed line-clamp-3 text-sm">{s.preview}…</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
