import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { setToken } from "../api";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 ${isActive ? "bg-[#2b261f] text-white" : "text-[#d9d0c4] hover:bg-[#2b261f]"}`;

export default function Layout() {
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-wrap items-center gap-2 bg-ink p-6 text-paper lg:flex-col lg:items-stretch">
        <div className="mb-2 font-display text-[26px] tracking-tight lg:mb-4">
          Kitchen
          <small className="mt-1 block font-sans text-[11px] uppercase tracking-[0.12em] text-white/50">
            WhatsApp orders
          </small>
        </div>
        <NavLink to="/" end className={linkClass}>
          Orders
        </NavLink>
        <NavLink to="/menu" className={linkClass}>
          Menu
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          QR & settings
        </NavLink>
        <div className="hidden flex-1 lg:block" />
        <button
          className="rounded-lg border border-white/15 px-3 py-2 text-[#d9d0c4]"
          onClick={() => {
            setToken(null);
            navigate("/login");
          }}
        >
          Log out
        </button>
      </aside>
      <main className="p-5 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
