import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Auth({ mode = "login" }) {
  const isSignup = mode === "signup";
  const nav = useNavigate();
  const { login, signup } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", display_name: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      if (isSignup) await signup(form.email, form.password, form.display_name);
      else await login(form.email, form.password);
      nav("/dashboard");
    } catch (e2) {
      setErr(e2.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex grain">
      <div className="hidden md:flex md:w-1/2 relative">
        <img src="https://images.unsplash.com/photo-1665245360851-fc7545c3aff0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWNhZGVtaWElMjBhZXN0aGV0aWN8ZW58MHx8fHwxNzgxMDgyNjMyfDA&ixlib=rb-4.1.0&q=85"
          alt="" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F0F11] via-transparent to-[#0F0F11]/40" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="eyebrow mb-3">a quiet place to make sentences</p>
          <p className="display text-4xl italic leading-snug max-w-md">
            "Every novel begins as something nobody else can read yet."
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="display text-3xl block mb-12" data-testid="auth-logo">InkDrop</Link>
          <p className="eyebrow mb-4">{isSignup ? "open an account" : "return to your desk"}</p>
          <h2 className="display text-5xl mb-10">{isSignup ? "Begin." : "Welcome back."}</h2>

          <form onSubmit={submit} className="space-y-6">
            {isSignup && (
              <div>
                <label className="eyebrow block mb-2">Your name</label>
                <input
                  className="field" required maxLength={80}
                  value={form.display_name}
                  onChange={(e) => setForm({...form, display_name: e.target.value})}
                  data-testid="auth-name"
                  placeholder="e.g. Joan Didion"
                />
              </div>
            )}
            <div>
              <label className="eyebrow block mb-2">Email</label>
              <input type="email" className="field" required
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                data-testid="auth-email"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="eyebrow block mb-2">Password</label>
              <input type="password" className="field" required minLength={6}
                value={form.password}
                onChange={(e) => setForm({...form, password: e.target.value})}
                data-testid="auth-password"
                placeholder="••••••••"
              />
            </div>

            {err && <p className="text-[#c4525e] mono text-xs" data-testid="auth-error">{err}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-4" data-testid="auth-submit">
              {loading ? "..." : isSignup ? "Open Account" : "Sign In"}
            </button>
          </form>

          <p className="mt-10 mono text-xs text-[var(--ink-text-2)]">
            {isSignup ? "Already have a desk? " : "No account yet? "}
            <Link to={isSignup ? "/login" : "/signup"} className="text-[var(--ink-accent)] underline underline-offset-4" data-testid="auth-switch">
              {isSignup ? "Sign in" : "Open one"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
