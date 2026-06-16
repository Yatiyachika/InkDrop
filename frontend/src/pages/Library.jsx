import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import CoverThumb from "../components/CoverThumb";

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
          <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {stories.map((s) => (
              <button
                key={s.id}
                onClick={() => nav(`/read/${s.id}`)}
                className="group text-left flex flex-col"
                data-testid={`library-story-${s.id}`}
              >
                <div className="aspect-[3/4] border border-[var(--ink-border)] overflow-hidden group-hover:border-[var(--ink-accent)] transition relative">
                  <CoverThumb storyId={s.id} hasCover={s.has_cover} vibe={s.vibe} />
                  {s.is_public && (
                    <span className="absolute top-2 right-2 mono text-[0.55rem] bg-[#0F0F11]/80 backdrop-blur px-2 py-1 text-[var(--ink-accent)] uppercase tracking-[0.25em]">shared</span>
                  )}
                </div>
                <div className="mt-3">
                  <p className="eyebrow text-[var(--ink-accent)]">{s.vibe.replace(/_/g, " ")}</p>
                  <p className="display text-xl mt-1 leading-tight">{s.title}</p>
                  <p className="mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--ink-text-2)] mt-2">
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
