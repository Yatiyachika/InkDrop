import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Share2, Trash2, BookOpen, Sparkles } from "lucide-react";
import api from "../lib/api";

export default function Reader() {
  const { id } = useParams();
  const nav = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [continuing, setContinuing] = useState(false);
  const [showCoAuthor, setShowCoAuthor] = useState(false);
  const [directive, setDirective] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    api.get(`/story/${id}`)
      .then((r) => setStory(r.data))
      .catch(() => setError("Story not found"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const onContinue = async (withDirective = false) => {
    setContinuing(true);
    setError("");
    try {
      const r = await api.post("/story/continue", {
        story_id: id,
        coauthor_directive: withDirective ? directive : null,
      });
      setStory(r.data);
      setDirective("");
      setShowCoAuthor(false);
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 200);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to continue.");
    } finally {
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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="dot-pulse"><span/><span/><span/></span></div>;
  if (!story) return <div className="min-h-screen flex items-center justify-center"><p className="display text-3xl">{error || "Not found"}</p></div>;

  return (
    <div className="min-h-screen grain">
      {/* meta header */}
      <div className="max-w-3xl mx-auto px-6 md:px-10 pt-12 pb-6 border-b border-white/5">
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

      {/* prose */}
      <article className="py-16 px-6 md:px-10">
        <div className="prose-novel" data-testid="reader-prose">
          {story.chunks.map((chunk, i) => (
            <div key={i} className="reveal" style={{animationDelay: `${i*80}ms`}}>
              {chunk.directive && (
                <p className="mono text-xs text-[var(--ink-accent)] not-italic mb-6 pl-4 border-l-2 border-[var(--ink-accent)]" style={{textIndent:0}}>
                  ✎ {chunk.directive}
                </p>
              )}
              {chunk.text.split(/\n\n+/).map((para, j) => (
                <p key={j}>{para}</p>
              ))}
              {i < story.chunks.length - 1 && (
                <div className="text-center my-12" style={{textIndent:0}}>
                  <span className="text-[var(--ink-accent)] tracking-[1em] text-2xl">⁂</span>
                </div>
              )}
            </div>
          ))}
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
