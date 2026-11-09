import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("owner@demo.local");
  const [password, setPassword] = useState("changeme");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.login(email, password);
      setToken(res.token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-line bg-paper p-8 shadow-lg">
        <h1 className="font-display text-4xl tracking-tight">Kitchen</h1>
        <p className="mt-2 text-muted">Owner dashboard for WhatsApp orders.</p>
        <label className="mt-5 block text-sm text-muted">Email</label>
        <input
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />
        <label className="mt-4 block text-sm text-muted">Password</label>
        <input
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />
        {error ? <p className="mt-3 text-danger">{error}</p> : null}
        <button className="mt-6 rounded-lg bg-ink px-4 py-2 text-white" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
