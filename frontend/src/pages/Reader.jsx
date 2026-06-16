import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Share2, Trash2, BookOpen, Sparkles, Pencil, Check, X, RefreshCw } from "lucide-react";
import api, { API } from "../lib/api";
import { streamSSE } from "../lib/stream";

export default function Reader() {
  const { id } = useParams();
  const nav = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [continuing, setContinuing] = useState(false);
  const [streamingTail, setStreamingTail] = useState("");
  const [showCoAuthor, setShowCoAuthor] = useState(false);
  const [directive, setDirective] = useState("");
  const [error, setError] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const coverPollRef = useRef(null);

  const load = () => {
    api.get(`/story/${id}`)
      .then((r) => setStory(r.data))
      .catch(() => setError("Story not found"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  // Poll cover until it's ready (or failed)
  useEffect(() => {
    if (!story) return;
    if (story.cover_status !== "pending") return;
    coverPollRef.current = setInterval(async () => {
      try {
        const r = await api.get(`/story/${id}/cover`);
        if (r.data.cover_status && r.data.cover_status !== "pending") {
          setStory((prev) => prev ? { ...prev, ...r.data } : prev);
          clearInterval(coverPollRef.current);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(coverPollRef.current);
  }, [story?.cover_status, id]);

  const onContinue = async (withDirective = false) => {
    setContinuing(true);
    setError("");
    setStreamingTail("");
    const dir = withDirective ? directive : null;
    try {
      await streamSSE(
        `${API}/story/continue/stream`,
        { story_id: id, coauthor_directive: dir },
        (ev) => {
          if (ev.type === "delta") {
            setStreamingTail((prev) => prev + ev.text);
          } else if (ev.type === "done") {
            // refresh full story
            api.get(`/story/${id}`).then((r) => {
              setStory(r.data);
              setStreamingTail("");
              setContinuing(false);
              setDirective("");
              setShowCoAuthor(false);
              setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 200);
            });
          } else if (ev.type === "error") {
            setError(ev.message || "Continue failed.");
            setContinuing(false);
          }
        }
      );
    } catch (e) {
      setError(e.message || "Continue failed.");
      setContinuing(false);
    }
  };

  const onExport = async (fmt) => {
    const r = await api.get(`/story/${id}/export`, { params: { fmt } });
    const blob = new Blob([r.data.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = r.data.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onShare = async () => {
    const r = await api.post("/story/share", { story_id: id, share: !story.is_public });
    setStory({ ...story, is_public: r.data.is_public });
  };

  const onDelete = async () => {
    if (!confirm("Delete this story? This cannot be undone.")) return;
    await api.delete(`/story/${id}`);
    nav("/library");
  };

  const onRegenCover = async () => {
    await api.post(`/story/${id}/cover/regenerate`);
    setStory({ ...story, cover_status: "pending", cover_b64: null });
  };

  const startEdit = (idx, text) => {
    setEditingIdx(idx);
    setEditText(text);
  };
  const cancelEdit = () => {
    setEditingIdx(null);
    setEditText("");
  };
  const saveEdit = async () => {
    if (editingIdx === null) return;
    setSavingEdit(true);
    try {
      const r = await api.patch(`/story/${id}/chunks/${editingIdx}`, { text: editText });
      setStory(r.data);
      cancelEdit();
    } catch (e) {
      setError("Could not save edit.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="dot-pulse"><span/><span/><span/></span></div>;
  if (!story) return <div className="min-h-screen flex items-center justify-center"><p className="display text-3xl">{error || "Not found"}</p></div>;

  const isOwner = true; // backend already filters; if story loaded from /story/:id user owns it OR it's public

  return (
    <div className="min-h-screen grain">
      {/* Cover hero */}
      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-12">
        <div className="grid md:grid-cols-[280px_1fr] gap-8 items-end pb-8 border-b border-white/5">
          {/* Cover image / placeholder */}
          <div className="relative aspect-square border border-[var(--ink-border)] overflow-hidden bg-[var(--ink-bg-alt)]" data-testid="reader-cover">
            {story.cover_b64 ? (
              <img
                src={`data:${story.cover_mime || "image/png"};base64,${story.cover_b64}`}
                alt="Story cover"
                className="w-full h-full object-cover"
                data-testid="reader-cover-img"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                {story.cover_status === "failed" ? (
                  <p className="text-[var(--ink-text-2)] text-sm italic">cover unavailable</p>
                ) : (
                  <>
                    <span className="dot-pulse mb-4"><span/><span/><span/></span>
                    <p className="eyebrow">painting the cover</p>
                    <p className="text-[var(--ink-text-2)] text-xs mt-2 italic">Nano Banana is working…</p>
                  </>
                )}
              </div>
            )}
            <button
              onClick={onRegenCover}
              className="absolute bottom-2 right-2 p-2 bg-[#0F0F11]/80 backdrop-blur-sm border border-[var(--ink-border)] hover:border-[var(--ink-accent)] transition"
              title="Regenerate cover"
              data-testid="reader-cover-regen"
            >
              <RefreshCw size={12} className="text-[var(--ink-accent)]" />
            </button>
          </div>

          {/* Meta + title */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">{story.vibe.replace(/_/g, " ")}</p>
              <div className="flex gap-2 items-center mono text-[0.65rem] text-[var(--ink-text-2)] uppercase tracking-[0.2em]">
                <span>{story.chunks.length} chunk{story.chunks.length !== 1 ? "s" : ""}</span>
                <span className="text-[var(--ink-border)]">·</span>
                <span>{story.chunks.reduce((a,c) => a + c.text.split(/\s+/).length, 0)} words</span>
              </div>
            </div>
            <h1 className="display text-4xl md:text-6xl" data-testid="reader-title">{story.title}</h1>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => onExport("md")} className="btn-ghost py-2 px-4 text-[0.65rem] flex items-center gap-2" data-testid="reader-export-md">
                <Download size={12}/> Markdown
              </button>
              <button onClick={() => onExport("txt")} className="btn-ghost py-2 px-4 text-[0.65rem] flex items-center gap-2" data-testid="reader-export-txt">
                <Download size={12}/> Plain Text
              </button>
              <button onClick={onShare} className="btn-ghost py-2 px-4 text-[0.65rem] flex items-center gap-2" data-testid="reader-share">
                <Share2 size={12}/> {story.is_public ? "Unshare from Salon" : "Share to Salon"}
              </button>
              <button onClick={onDelete} className="btn-ghost py-2 px-4 text-[0.65rem] flex items-center gap-2 hover:!border-[#c4525e] hover:!text-[#c4525e]" data-testid="reader-delete">
                <Trash2 size={12}/> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* prose */}
      <article className="py-16 px-6 md:px-10">
        <div className="prose-novel" data-testid="reader-prose">
          {story.chunks.map((chunk, i) => (
            <div key={i} className="reveal group relative" style={{animationDelay: `${i*80}ms`}}>
              {chunk.directive && (
                <p className="mono text-xs text-[var(--ink-accent)] not-italic mb-6 pl-4 border-l-2 border-[var(--ink-accent)]" style={{textIndent:0}}>
                  ✎ {chunk.directive}
                </p>
              )}

              {editingIdx === i ? (
                <div style={{textIndent:0}}>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-[var(--ink-bg-alt)] border border-[var(--ink-accent)] p-4 text-[var(--ink-text)] font-serif text-lg leading-relaxed min-h-[260px] focus:outline-none"
                    data-testid={`chunk-edit-textarea-${i}`}
                  />
                  <div className="flex gap-3 mt-3 justify-end">
                    <button onClick={cancelEdit} className="btn-ghost py-2 px-4 text-[0.65rem] flex items-center gap-2" data-testid={`chunk-edit-cancel-${i}`}>
                      <X size={12}/> Cancel
                    </button>
                    <button onClick={saveEdit} disabled={savingEdit} className="btn-primary py-2 px-4 text-[0.65rem] flex items-center gap-2" data-testid={`chunk-edit-save-${i}`}>
                      <Check size={12}/> {savingEdit ? "Saving…" : "Save Edit"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => startEdit(i, chunk.text)}
                    className="absolute -left-12 top-0 opacity-0 group-hover:opacity-100 transition p-2 hover:text-[var(--ink-accent)] text-[var(--ink-text-2)] hidden md:block"
                    title="Edit chunk"
                    data-testid={`chunk-edit-${i}`}
                    style={{textIndent:0}}
                  >
                    <Pencil size={14}/>
                  </button>
                  {chunk.text.split(/\n\n+/).map((para, j) => (
                    <p key={j}>{para}</p>
                  ))}
                  {chunk.edited_at && (
                    <p className="mono text-[0.6rem] text-[var(--ink-text-2)] uppercase tracking-[0.2em] -mt-2 mb-4" style={{textIndent:0}}>edited</p>
                  )}
                </>
              )}

              {i < story.chunks.length - 1 && (
                <div className="text-center my-12" style={{textIndent:0}}>
                  <span className="text-[var(--ink-accent)] tracking-[1em] text-2xl">⁂</span>
                </div>
              )}
            </div>
          ))}

          {/* Live streaming tail */}
          {continuing && streamingTail && (
            <div className="reveal" data-testid="reader-streaming-tail">
              <div className="text-center my-12" style={{textIndent:0}}>
                <span className="text-[var(--ink-accent)] tracking-[1em] text-2xl">⁂</span>
              </div>
              {streamingTail.split(/\n\n+/).map((p, i) => (
                <p key={i}>{p}<span className="animate-pulse text-[var(--ink-accent)]">▊</span></p>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* footer actions */}
      <div className="sticky bottom-0 bg-[#0F0F11]/95 backdrop-blur-xl border-t border-white/5 py-6 px-6">
        <div className="max-w-3xl mx-auto">
          {error && <p className="text-[#c4525e] mono text-xs mb-3" data-testid="reader-error">{error}</p>}
          {showCoAuthor ? (
            <div className="space-y-3">
              <p className="eyebrow">co-author directive</p>
              <textarea
                value={directive}
                onChange={(e) => setDirective(e.target.value)}
                placeholder="e.g. Introduce a stranger who knows her name. Shift to night."
                className="field mono text-sm py-3"
                rows={2}
                data-testid="reader-coauthor-input"
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCoAuthor(false)} className="btn-ghost py-2 px-4" data-testid="reader-coauthor-cancel">Cancel</button>
                <button onClick={() => onContinue(true)} disabled={continuing || !directive.trim()} className="btn-primary py-2 px-6" data-testid="reader-coauthor-submit">
                  {continuing ? "Pressing…" : "Continue with directive →"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <button onClick={() => setShowCoAuthor(true)} className="btn-ghost flex items-center gap-2" data-testid="reader-coauthor-open">
                <Sparkles size={14}/> Co-Author Mode
              </button>
              <button onClick={() => onContinue(false)} disabled={continuing} className="btn-primary flex items-center gap-3 px-8 py-4" data-testid="reader-continue">
                <BookOpen size={14}/>
                {continuing ? <>Pressing <span className="dot-pulse"><span/><span/><span/></span></> : "Continue the Story →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
