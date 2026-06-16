import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, Square, Plus, X, BookOpen } from "lucide-react";
import api, { API } from "../lib/api";
import { streamSSE } from "../lib/stream";

const VIBES = [
  { id: "dark_gritty",       title: "Dark & Gritty",      desc: "noir, raw, unflinching",  img: "https://images.unsplash.com/photo-1728506972831-193841eb2961?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHw0fHxkYXJrJTIwYWNhZGVtaWElMjBhZXN0aGV0aWN8ZW58MHx8fHwxNzgxMDgyNjMyfDA&ixlib=rb-4.1.0&q=85" },
  { id: "poetic_slow_burn",  title: "Poetic Slow-Burn",   desc: "lyrical, meditative",     img: "https://images.unsplash.com/photo-1665245360851-fc7545c3aff0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWNhZGVtaWElMjBhZXN0aGV0aWN8ZW58MHx8fHwxNzgxMDgyNjMyfDA&ixlib=rb-4.1.0&q=85" },
  { id: "thriller",          title: "Fast-Paced Thriller", desc: "propulsive, cinematic",  img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80" },
  { id: "cozy_nostalgic",    title: "Cozy Nostalgic",     desc: "warm, memory-soaked",     img: "https://images.pexels.com/photos/17042498/pexels-photo-17042498.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
];

export default function Compose() {
  const nav = useNavigate();
  const loc = useLocation();
  const [brainDump, setBrainDump] = useState(loc.state?.seed || "");
  const [vibe, setVibe] = useState("poetic_slow_burn");
  const [deai, setDeai] = useState(75);
  const [characters, setCharacters] = useState([]);
  const [newChar, setNewChar] = useState({ name: "", role: "", description: "" });
  const [showCharForm, setShowCharForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [streamedStoryId, setStreamedStoryId] = useState(null);
  const [error, setError] = useState("");

  // voice recording
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    api.get("/characters").then((r) => setCharacters(r.data)).catch(() => {});
  }, []);

  const startRec = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, "voice.webm");
          const r = await api.post("/voice/transcribe", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setBrainDump((prev) => (prev ? prev + " " : "") + (r.data.text || ""));
        } catch (e) {
          setError("Transcription failed.");
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch (e) {
      setError("Could not access microphone.");
    }
  };
  const stopRec = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const addCharacter = async () => {
    if (!newChar.name || !newChar.description) return;
    await api.post("/characters", newChar);
    const fresh = await api.get("/characters");
    setCharacters(fresh.data);
    setNewChar({ name: "", role: "", description: "" });
    setShowCharForm(false);
  };

  const removeCharacter = async (id) => {
    await api.delete(`/characters/${id}`);
    setCharacters(characters.filter((c) => c.id !== id));
  };

  const generate = async () => {
    setError("");
    if (brainDump.trim().length < 4) {
      setError("Drop a thought, even a fragment.");
      return;
    }
    setGenerating(true);
    setStreamedText("");
    setStreamedStoryId(null);
    try {
      await streamSSE(
        `${API}/story/generate/stream`,
        {
          brain_dump: brainDump,
          vibe,
          deai_level: deai,
          characters,
          lore: "",
        },
        (ev) => {
          if (ev.type === "meta") {
            setStreamedStoryId(ev.story_id);
          } else if (ev.type === "delta") {
            setStreamedText((prev) => prev + ev.text);
          } else if (ev.type === "done") {
            // small grace pause so the reader sees the final tail land
            setTimeout(() => nav(`/read/${ev.story_id}`), 900);
          } else if (ev.type === "error") {
            setError(ev.message || "Generation failed.");
            setGenerating(false);
          }
        }
      );
    } catch (e) {
      setError(e.message || "Generation failed.");
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen grain">
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-12">
        <p className="eyebrow mb-3">the composer</p>
        <h1 className="display text-5xl md:text-6xl mb-2">Pour it out.</h1>
        <p className="text-[var(--ink-text-2)] max-w-2xl leading-relaxed">
          Fragments are welcome. Half-sentences, smells you remember, a name you can't shake. Press write — we'll rebuild it.
        </p>

        {/* Brain dump */}
        <div className="mt-10 border border-white/10 bg-[#161618]/60 backdrop-blur-sm p-6 md:p-10">
          <textarea
            className="textarea-novel"
            value={brainDump}
            onChange={(e) => setBrainDump(e.target.value)}
            placeholder="That thing about the coffee shop on a wednesday. Her hands. He never said anything. The smell of rain on hot pavement…"
            data-testid="composer-textarea"
          />

          <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6 border-t border-white/5">
            <div className="flex items-center gap-4">
              {!recording ? (
                <button onClick={startRec} disabled={transcribing}
                  className="btn-ghost flex items-center gap-2 py-2 px-4"
                  data-testid="composer-mic-start">
                  <Mic size={14}/> {transcribing ? "Transcribing…" : "Voice Dump"}
                </button>
              ) : (
                <button onClick={stopRec} className="btn-primary flex items-center gap-2 py-2 px-4" data-testid="composer-mic-stop">
                  <Square size={12}/> Stop <span className="rec-pulse ml-1"/>
                </button>
              )}
              <span className="mono text-[0.7rem] text-[var(--ink-text-2)] uppercase tracking-[0.2em]">
                {brainDump.trim().split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            {/* De-AI slider */}
            <div className="flex items-center gap-4 flex-1 max-w-md">
              <span className="mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--ink-text-2)] whitespace-nowrap">De-AI-fy</span>
              <input type="range" min="0" max="100" value={deai}
                onChange={(e) => setDeai(parseInt(e.target.value))}
                className="flex-1 accent-[var(--ink-accent)]"
                data-testid="composer-deai-slider"
              />
              <span className="mono text-xs text-[var(--ink-accent)] w-10 text-right" data-testid="composer-deai-value">{deai}%</span>
            </div>
          </div>
        </div>

        {/* Vibe picker */}
        <div className="mt-12">
          <p className="eyebrow mb-4">choose a vibe</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {VIBES.map((v) => (
              <button key={v.id} onClick={() => setVibe(v.id)}
                className={`vibe-card ${vibe === v.id ? "selected" : ""}`}
                data-testid={`vibe-${v.id}`}>
                <img src={v.img} alt={v.title} />
                <div className="vibe-content">
                  <span className="eyebrow">{v.id === vibe ? "selected" : "tap to select"}</span>
                  <div>
                    <p className="display text-2xl">{v.title}</p>
                    <p className="mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--ink-text-2)] mt-1">{v.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Characters */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow">characters &amp; lore</p>
            <button onClick={() => setShowCharForm(!showCharForm)} className="btn-ghost py-1.5 px-3 text-[0.65rem]" data-testid="char-toggle">
              {showCharForm ? <><X size={12} className="inline"/> Close</> : <><Plus size={12} className="inline"/> Add</>}
            </button>
          </div>

          {showCharForm && (
            <div className="ink-card mb-4 grid md:grid-cols-3 gap-4" data-testid="char-form">
              <input className="field" placeholder="Name" value={newChar.name}
                onChange={(e) => setNewChar({...newChar, name: e.target.value})}
                data-testid="char-name"/>
              <input className="field" placeholder="Role (optional)" value={newChar.role}
                onChange={(e) => setNewChar({...newChar, role: e.target.value})}
                data-testid="char-role"/>
              <input className="field" placeholder="Brief description" value={newChar.description}
                onChange={(e) => setNewChar({...newChar, description: e.target.value})}
                data-testid="char-desc"/>
              <button onClick={addCharacter} className="btn-primary md:col-span-3 py-2" data-testid="char-save">Save Character</button>
            </div>
          )}

          {characters.length === 0 ? (
            <p className="text-[var(--ink-text-2)] italic text-sm">No characters yet. They'll be passed into the model on generation.</p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {characters.map((c) => (
                <div key={c.id} className="ink-card group relative" data-testid={`char-card-${c.id}`}>
                  <button onClick={() => removeCharacter(c.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[var(--ink-text-2)] hover:text-[#c4525e]"
                    data-testid={`char-remove-${c.id}`}>
                    <X size={14}/>
                  </button>
                  <p className="display text-2xl">{c.name}</p>
                  <p className="mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--ink-accent)]">{c.role || "—"}</p>
                  <p className="mt-2 text-sm text-[var(--ink-text-2)] leading-relaxed">{c.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="mt-6 text-[#c4525e] mono text-sm" data-testid="composer-error">{error}</p>}

        <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6 sticky bottom-0 bg-[#0F0F11]/90 backdrop-blur-sm py-6 border-t border-white/5">
          <p className="text-[var(--ink-text-2)] italic">
            Vibe: <em className="not-italic text-[var(--ink-accent)]">{VIBES.find((v) => v.id === vibe)?.title}</em>
          </p>
          <button onClick={generate} disabled={generating} className="btn-primary text-base px-10 py-4 flex items-center gap-3" data-testid="composer-generate">
            <BookOpen size={16}/>
            {generating ? <>Pressing <span className="dot-pulse"><span/><span/><span/></span></> : "Press the Opening Scene →"}
          </button>
        </div>

        {/* Live streaming overlay */}
        {generating && (
          <div className="fixed inset-0 z-50 bg-[#0F0F11]/95 backdrop-blur-2xl overflow-y-auto" data-testid="stream-overlay">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="flex items-center justify-between mb-10">
                <p className="eyebrow">the press is running</p>
                <span className="dot-pulse"><span/><span/><span/></span>
              </div>
              <p className="display text-4xl md:text-5xl mb-12 italic" data-testid="stream-title">
                Watching the sentences arrive…
              </p>
              <div className="prose-novel" data-testid="stream-prose">
                {streamedText.split(/\n\n+/).map((p, i) => (
                  <p key={i}>{p}<span className="animate-pulse text-[var(--ink-accent)]">▊</span></p>
                ))}
                {streamedText.length === 0 && (
                  <p className="italic text-[var(--ink-text-2)]">Claude is reaching for the first word…</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
