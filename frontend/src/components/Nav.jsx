import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0F0F11]/75 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <NavLink to="/dashboard" className="flex items-baseline gap-2" data-testid="nav-logo">
          <span className="display text-2xl">InkDrop</span>
          <span className="eyebrow text-[0.55rem]">— a quiet press</span>
        </NavLink>

        <nav className="hidden md:flex items-center gap-8 mono text-[0.72rem] uppercase tracking-[0.22em]">
          <NavLink to="/dashboard" data-testid="nav-dashboard"
            className={({isActive}) => isActive ? "text-[var(--ink-accent)]" : "text-[var(--ink-text-2)] hover:text-[var(--ink-text)]"}>
            Desk
          </NavLink>
          <NavLink to="/compose" data-testid="nav-compose"
            className={({isActive}) => isActive ? "text-[var(--ink-accent)]" : "text-[var(--ink-text-2)] hover:text-[var(--ink-text)]"}>
            Compose
          </NavLink>
          <NavLink to="/library" data-testid="nav-library"
            className={({isActive}) => isActive ? "text-[var(--ink-accent)]" : "text-[var(--ink-text-2)] hover:text-[var(--ink-text)]"}>
            Bookshelf
          </NavLink>
          <NavLink to="/community" data-testid="nav-community"
            className={({isActive}) => isActive ? "text-[var(--ink-accent)]" : "text-[var(--ink-text-2)] hover:text-[var(--ink-text)]"}>
            Salon
          </NavLink>
        </nav>

        <div className="flex items-center gap-4">
          <span className="hidden sm:inline mono text-[0.7rem] text-[var(--ink-text-2)]" data-testid="nav-user-name">
            {user.display_name}
          </span>
          <button onClick={() => { logout(); nav("/"); }} className="btn-ghost py-2 px-4 text-[0.65rem]" data-testid="nav-logout">
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
