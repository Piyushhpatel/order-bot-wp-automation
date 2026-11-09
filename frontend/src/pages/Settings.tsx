import { useEffect, useState, type FormEvent } from "react";
import { api, type Settings } from "../api";

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api.settings().then(setS).catch((err) => setError(err.message));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!s) return;
    setError("");
    setSaved("");
    try {
      await api.patchSettings({
        name: s.name,
        intro: s.intro,
        whatsappDisplayNumber: s.whatsappDisplayNumber,
        timezone: s.timezone,
        dayStartHour: Number(s.dayStartHour),
      });
      setS(await api.settings());
      setSaved("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!s) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-tight">QR & settings</h1>
        <p className="mt-1 text-muted">Print this QR on tables. Scanning opens WhatsApp with Hi.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="rounded-xl border border-line bg-paper p-5" onSubmit={save}>
          <label className="block text-sm text-muted">Restaurant name</label>
          <input className="mt-1 w-full rounded-lg border border-line px-3 py-2" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          <label className="mt-4 block text-sm text-muted">Welcome text</label>
          <textarea className="mt-1 w-full rounded-lg border border-line px-3 py-2" rows={4} value={s.intro} onChange={(e) => setS({ ...s, intro: e.target.value })} />
          <label className="mt-4 block text-sm text-muted">WhatsApp number (country code, no +)</label>
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            placeholder="9198xxxxxxxx"
            value={s.whatsappDisplayNumber}
            onChange={(e) => setS({ ...s, whatsappDisplayNumber: e.target.value })}
          />
          <label className="mt-4 block text-sm text-muted">Timezone</label>
          <input className="mt-1 w-full rounded-lg border border-line px-3 py-2" value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} />
          <label className="mt-4 block text-sm text-muted">Token reset hour (0–23)</label>
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            type="number"
            min={0}
            max={23}
            value={s.dayStartHour}
            onChange={(e) => setS({ ...s, dayStartHour: Number(e.target.value) })}
          />
          {error ? <p className="mt-3 text-danger">{error}</p> : null}
          {saved ? <p className="mt-3 text-muted">{saved}</p> : null}
          <button className="mt-5 rounded-lg bg-ink px-4 py-2 text-white">Save</button>
          <p className="mt-4 text-sm text-muted">
            WhatsApp API: {s.whatsappConfigured ? "connected" : "set WHATSAPP_ACCESS_TOKEN in backend/.env"}
            <br />
            Razorpay: {s.razorpayConfigured ? "connected" : "set RAZORPAY_KEY_ID in backend/.env"}
          </p>
        </form>
        <div className="rounded-xl border border-line bg-paper p-5">
          {s.qrDataUrl ? (
            <>
              <img className="h-56 w-56 rounded-xl border border-line bg-white" src={s.qrDataUrl} alt="WhatsApp QR" />
              <p className="mt-3 text-sm text-muted">{s.waLink}</p>
              <a className="mt-3 inline-block rounded-lg border border-line px-4 py-2" href={s.qrDataUrl} download="whatsapp-order-qr.png">
                Download QR
              </a>
            </>
          ) : (
            <p className="text-muted">Add the WhatsApp display number to generate a QR.</p>
          )}
        </div>
      </div>
    </div>
  );
}
