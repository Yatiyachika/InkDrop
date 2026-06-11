import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { AuthProvider, useAuth } from "./lib/auth";
import Nav from "./components/Nav";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Compose from "./pages/Compose";
import Reader from "./pages/Reader";
import Library from "./pages/Library";
import Community from "./pages/Community";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--ink-text-2)] italic">Opening the press…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <Nav />
      {children}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/compose" element={<Protected><Compose /></Protected>} />
          <Route path="/read/:id" element={<Protected><Reader /></Protected>} />
          <Route path="/library" element={<Protected><Library /></Protected>} />
          <Route path="/community" element={<Protected><Community /></Protected>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
