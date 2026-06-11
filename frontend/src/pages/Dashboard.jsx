import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Dashboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(null);
  const [recent, setRecent] = useState([]);
  const [chars, setChars] = useState([]);

  useEffect(() => {
    api.get("/prompts/daily").then((r) => setPrompt(r.data));
    api.get("/story/library").then((r) => setRecent(r.data.slice(0, 4)));
    api.get("/characters").then((r) => setChars(r.data));
  }, []);

  return (
    <div className="min-h-screen grain">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
        <div className="reveal">
          <p className="eyebrow mb-3">the desk · {new Date().toLocaleDateString(undefined, {weekday:"long", month:"long", day:"numeric"})}</p>
          <h1 className="display text-5xl md:text-6xl">Good evening, <em className="italic text-[var(--ink-accent)]">{user?.display_name?.split(" ")[0]}</em>.</h1>
          <p className="mt-4 text-lg text-[var(--ink-text-2)] max-w-2xl">
            The page is quiet. What would you like to write today?
          </p>
        </div>

        {/* Daily prompt */}
        <section className="mt-14 reveal" style={{animationDelay:"120ms"}}>
          <div className="relative overflow-hidden border border-[var(--ink-border)] p-10 md:p-14"
               style={{
                 backgroundImage: "url(https://images.pexels.com/photos/235985/pexels-photo-235985.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=1200)",
                 backgroundSize: "cover",
                 backgroundPosition: "center",
               }}>
            <div className="absolute inset-0 bg-[#0F0F11]/85" />
            <div className="relative">
              <p className="eyebrow mb-4">today's imagination prompt</p>
              <p className="display text-2xl md:text-4xl italic max-w-3xl leading-snug" data-testid="daily-prompt-text">
                {prompt?.prompt || "Loading the day's invitation…"}
              </p>
              <button
                onClick={() => nav("/compose", { state: { seed: prompt?.prompt } })}
                className="btn-primary mt-8"
                data-testid="daily-prompt-write"
              >
                Write from this →
              </button>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-16 grid md:grid-cols-3 gap-6">
          <ActionCard
            n="01" title="Fresh Brain Dump" desc="Pour raw thought onto the page. Pick a vibe. We render the opening scene."
            cta="Open the Composer" onClick={() => nav("/compose")} testId="action-compose"
          />
          <ActionCard
            n="02" title="My Bookshelf" desc={`${recent.length ? recent.length : "No"} stories on your shelf. Pick up where you left off.`}
            cta="Visit the Shelf" onClick={() => nav("/library")} testId="action-library"
          />
          <ActionCard
            n="03" title="The Salon" desc="Read stories shared by other writers. Lurk. Get inspired."
            cta="Step Inside" onClick={() => nav("/community")} testId="action-community"
          />
        </section>

        {/* Recent + Characters */}
        <section className="mt-20 grid md:grid-cols-3 gap-10">
          <div className="md:col-span-2">
            <p className="eyebrow mb-4">recently pressed</p>
            {recent.length === 0 ? (
              <p className="text-[var(--ink-text-2)] italic">Your shelf is empty. Press your first story →</p>
            ) : (
              <div className="space-y-4">
                {recent.map((s) => (
                  <button key={s.id} onClick={() => nav(`/read/${s.id}`)}
                    className="w-full text-left ink-card flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    data-testid={`recent-story-${s.id}`}>
                    <div>
                      <p className="display text-2xl">{s.title}</p>
                      <p className="mono text-xs text-[var(--ink-text-2)] mt-1 uppercase tracking-[0.2em]">
                        {s.vibe.replace(/_/g," ")} · {s.word_count} words · {s.chunk_count} chunk{s.chunk_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="mono text-[var(--ink-accent)] text-xs">Continue →</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="eyebrow mb-4">lore locker</p>
            {chars.length === 0 ? (
              <p className="text-[var(--ink-text-2)] italic text-sm">No characters yet. Add them inside the composer.</p>
            ) : (
              <ul className="space-y-3">
                {chars.slice(0, 6).map((c) => (
                  <li key={c.id} className="border-l-2 border-[var(--ink-accent)] pl-4 py-1" data-testid={`char-${c.id}`}>
                    <p className="display text-xl">{c.name}</p>
                    <p className="mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--ink-text-2)]">{c.role || "—"}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ActionCard({ n, title, desc, cta, onClick, testId }) {
  return (
    <button onClick={onClick} className="ink-card text-left h-full flex flex-col" data-testid={testId}>
      <p className="mono text-[var(--ink-accent)] text-xs tracking-[0.3em]">{n}</p>
      <h3 className="display text-3xl mt-2 mb-3">{title}</h3>
      <p className="text-[var(--ink-text-2)] leading-relaxed flex-1">{desc}</p>
      <p className="mt-6 mono text-xs text-[var(--ink-accent)] uppercase tracking-[0.2em]">{cta} →</p>
    </button>
  );
}
