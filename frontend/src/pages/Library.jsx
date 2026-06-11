import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function Library() {
  const nav = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/story/library").then((r) => setStories(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen grain">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
        <p className="eyebrow mb-3">your bookshelf</p>
        <h1 className="display text-5xl md:text-6xl mb-2">The Stack.</h1>
        <p className="text-[var(--ink-text-2)] max-w-2xl">Everything you've pressed. Pick a spine.</p>

        {loading ? (
          <p className="mt-12 italic text-[var(--ink-text-2)]">Dusting the shelves…</p>
        ) : stories.length === 0 ? (
          <div className="mt-16 border border-white/10 p-16 text-center">
            <p className="display text-3xl italic mb-4">The shelf is empty.</p>
            <button onClick={() => nav("/compose")} className="btn-primary mt-4" data-testid="library-empty-cta">Press your first story →</button>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {stories.map((s) => (
              <button
                key={s.id}
                onClick={() => nav(`/read/${s.id}`)}
                className="book-spine text-left"
                data-testid={`library-story-${s.id}`}
              >
                <div>
                  <p className="eyebrow text-[var(--ink-accent)]">{s.vibe.replace(/_/g, " ")}</p>
                  <p className="display text-2xl mt-2 leading-tight">{s.title}</p>
                  {s.is_public && <span className="mono text-[0.55rem] mt-2 inline-block text-[var(--ink-accent)] uppercase tracking-[0.25em]">shared</span>}
                </div>
                <div>
                  <p className="text-xs text-[var(--ink-text-2)] line-clamp-3 italic mb-3">{s.preview}…</p>
                  <p className="mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--ink-text-2)]">
                    {s.word_count} w · {s.chunk_count} ch
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
