import { useEffect, useMemo, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import { api, formatInr, getToken, type Order } from "../api";

function beep() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [showDone, setShowDone] = useState(false);

  async function load() {
    try {
      setOrders(await api.orders("paid,preparing,ready,completed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    const socket = io({ auth: { token: getToken() } });
    socket.on("order:new", (order: Order) => {
      setOrders((prev) => [order, ...prev.filter((o) => o._id !== order._id)]);
      beep();
    });
    socket.on("order:updated", (order: Order) => {
      setOrders((prev) => prev.map((o) => (o._id === order._id ? order : o)));
    });
    return () => {
      socket.close();
    };
  }, []);

  const cols = useMemo(
    () => ({
      paid: orders.filter((o) => o.status === "paid"),
      preparing: orders.filter((o) => o.status === "preparing"),
      ready: orders.filter((o) => o.status === "ready"),
      completed: orders.filter((o) => o.status === "completed"),
    }),
    [orders]
  );

  async function move(order: Order, status: Order["status"]) {
    const updated = await api.setOrderStatus(order._id, status);
    setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Live orders</h1>
          <p className="mt-1 text-muted">Paid tickets only. Ready pings the customer on WhatsApp.</p>
        </div>
        <button
          className="rounded-lg border border-line px-3 py-2"
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? "Hide completed" : "Show completed"}
        </button>
      </div>
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Column title="New" count={cols.paid.length}>
          {cols.paid.map((o) => (
            <Ticket key={o._id} order={o} onStart={() => move(o, "preparing")} onReady={() => move(o, "ready")} />
          ))}
        </Column>
        <Column title="Preparing" count={cols.preparing.length}>
          {cols.preparing.map((o) => (
            <Ticket key={o._id} order={o} onReady={() => move(o, "ready")} />
          ))}
        </Column>
        <Column title="Ready" count={cols.ready.length}>
          {cols.ready.map((o) => (
            <Ticket key={o._id} order={o} onDone={() => move(o, "completed")} />
          ))}
        </Column>
      </div>
      {showDone ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm uppercase tracking-widest text-muted">Completed</h2>
          {cols.completed.map((o) => (
            <Ticket key={o._id} order={o} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Column({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex justify-between text-sm uppercase tracking-widest text-muted">
        {title} <span>{count}</span>
      </h2>
      {children}
    </section>
  );
}

function Ticket({
  order,
  onStart,
  onReady,
  onDone,
}: {
  order: Order;
  onStart?: () => void;
  onReady?: () => void;
  onDone?: () => void;
}) {
  return (
    <article className="mb-3 rounded-xl border border-line bg-paper p-4 shadow-sm">
      <header className="flex items-baseline justify-between gap-2">
        <div className="font-mono text-3xl">#{order.tokenNumber ?? "—"}</div>
        <span className="rounded-full bg-[#efe4d3] px-2 py-1 text-[11px] uppercase tracking-wider">
          {order.fulfillment === "dine_in" ? `Table ${order.tableNumber}` : "Parcel"}
        </span>
      </header>
      <p className="mt-1 text-sm text-muted">
        {order.customerName} · {order.waPhone}
      </p>
      <ul className="mt-2">
        {order.items.map((i) => (
          <li key={i.itemId} className="flex justify-between border-t border-dashed border-line py-1 text-sm">
            <span>
              {i.name} × {i.qty}
            </span>
            <span>{formatInr(i.pricePaise * i.qty)}</span>
          </li>
        ))}
      </ul>
      <footer className="mt-3 flex items-center justify-between gap-2">
        <strong>{formatInr(order.totalPaise)}</strong>
        <div className="flex flex-wrap gap-2">
          {onStart ? (
            <button className="rounded-lg border border-line px-2 py-1 text-sm" onClick={onStart}>
              Preparing
            </button>
          ) : null}
          {onReady ? (
            <button className="rounded-lg bg-ready px-2 py-1 text-sm text-white" onClick={onReady}>
              Ready
            </button>
          ) : null}
          {onDone ? (
            <button className="rounded-lg bg-ink px-2 py-1 text-sm text-white" onClick={onDone}>
              Collected
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
