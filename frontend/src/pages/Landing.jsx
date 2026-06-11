import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../lib/auth";

export default function Landing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [hover, setHover] = useState(false);

  return (
    <div className="min-h-screen grain relative overflow-hidden">
      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 px-6 md:px-12 py-6 flex items-center justify-between z-20">
        <div className="flex items-baseline gap-3">
          <span className="display text-3xl" data-testid="landing-logo">InkDrop</span>
          <span className="eyebrow hidden sm:inline">est. 2026</span>
        </div>
        <div className="flex gap-3">
          {user ? (
            <button onClick={() => nav("/dashboard")} className="btn-ghost" data-testid="landing-enter">Enter the Press</button>
          ) : (
            <>
              <button onClick={() => nav("/login")} className="btn-ghost" data-testid="landing-signin">Sign In</button>
              <button onClick={() => nav("/signup")} className="btn-primary" data-testid="landing-start">Begin Writing</button>
            </>
          )}
        </div>
      </div>

      {/* hero */}
      <section className="relative min-h-screen flex items-center px-6 md:px-12">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.pexels.com/photos/8717959/pexels-photo-8717959.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1400"
            alt=""
            className="w-full h-full object-cover opacity-[0.12]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F0F11] via-transparent to-[#0F0F11]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto w-full pt-24">
          <div className="grid md:grid-cols-12 gap-12 items-end">
            <div className="md:col-span-8 reveal">
              <p className="eyebrow mb-6">Volume I  ·  the brain dump press</p>
              <h1 className="display text-[3.5rem] sm:text-[5rem] md:text-[7rem] leading-[0.92]">
                Your half-<em className="italic text-[var(--ink-accent)]">formed</em> thought,<br/>
                pressed into <span className="italic">prose</span>.
              </h1>
              <p className="mt-10 text-lg md:text-xl text-[var(--ink-text-2)] max-w-2xl leading-relaxed">
                Pour your raw, unedited noise into the page. InkDrop will rebuild it into a literary scene —
                sensory, restrained, alive — chunk by chunk, the way novels are actually written.
              </p>
              <div className="mt-12 flex flex-wrap gap-4">
                <button
                  onClick={() => nav(user ? "/compose" : "/signup")}
                  onMouseEnter={() => setHover(true)}
                  onMouseLeave={() => setHover(false)}
                  className="btn-primary text-sm px-8 py-4"
                  data-testid="landing-cta-primary"
                >
                  {hover ? "Open the Composer →" : "Drop a Thought"}
                </button>
                <button onClick={() => nav(user ? "/community" : "/login")} className="btn-ghost text-sm px-8 py-4" data-testid="landing-cta-secondary">
                  Browse the Salon
                </button>
              </div>
            </div>

            <div className="md:col-span-4 reveal" style={{animationDelay:"180ms"}}>
              <div className="border-l border-[var(--ink-accent)] pl-6 py-4">
                <p className="display text-2xl italic leading-snug text-[var(--ink-text)]">
                  "He kept adjusting the strap of his backpack. The corridor smelled of wet shoes and ozone.
                  His tongue tasted of yesterday's coffee."
                </p>
                <p className="mt-4 eyebrow">— from a 12-word dump</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* features strip */}
      <section className="relative z-10 px-6 md:px-12 py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
          {[
            ["01", "Anti-AI filter", "Banned clichés. No 'tapestry of profound testaments'. The De-AI slider lets you tighten the noose."],
            ["02", "Show, don't tell", "Emotion rendered through bodies and rooms — never stated. The way novels do it."],
            ["03", "Chunk by chunk", "250–350 words at a time. You stay in the loop. You can redirect mid-scene with Co-Author mode."],
          ].map(([n, t, d]) => (
            <div key={n} className="reveal" style={{animationDelay:`${parseInt(n)*120}ms`}}>
              <p className="mono text-[var(--ink-accent)] text-xs tracking-[0.3em]">{n}</p>
              <h3 className="display text-3xl mt-3 mb-3">{t}</h3>
              <p className="text-[var(--ink-text-2)] leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-8 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-[var(--ink-text-2)] mono text-xs">
          <span>© 2026 InkDrop Press</span>
          <span>set in Cormorant Garamond &amp; Lora</span>
        </div>
      </footer>
    </div>
  );
}
