import { useEffect, useState, type FormEvent } from "react";
import { api, formatInr, type Category, type MenuItem } from "../api";

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [active, setActive] = useState("");
  const [newCat, setNewCat] = useState("");
  const [editing, setEditing] = useState<MenuItem | null | "new">(null);
  const [error, setError] = useState("");

  async function load() {
    const cats = await api.categories();
    setCategories(cats);
    const id = active || cats[0]?._id || "";
    if (!active && id) setActive(id);
    setItems(await api.menuItems());
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const visible = items.filter((i) => i.categoryId === active);

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCat.trim()) return;
    const row = await api.createCategory({
      name: newCat.trim(),
      sortOrder: categories.length,
      isActive: true,
    });
    setCategories((c) => [...c, row]);
    setActive(row._id);
    setNewCat("");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Menu</h1>
          <p className="mt-1 text-muted">Hidden items disappear from WhatsApp on the next Menu tap.</p>
        </div>
        <button
          className="rounded-lg bg-ink px-4 py-2 text-white disabled:opacity-50"
          onClick={() => setEditing("new")}
          disabled={!active}
        >
          Add item
        </button>
      </div>
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border border-line bg-paper p-4">
          {categories.map((c) => (
            <button
              key={c._id}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left ${
                c._id === active ? "bg-[#e9e1d2]" : ""
              }`}
              onClick={() => setActive(c._id)}
            >
              <span>
                {c.name} {c.isActive ? "" : "(hidden)"}
              </span>
              <span className="flex gap-1 text-xs text-muted">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    api.patchCategory(c._id, { isActive: !c.isActive }).then(load);
                  }}
                >
                  {c.isActive ? "Hide" : "Show"}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${c.name} and its items?`)) api.deleteCategory(c._id).then(load);
                  }}
                >
                  Del
                </span>
              </span>
            </button>
          ))}
          <form onSubmit={addCategory} className="mt-3">
            <input
              className="w-full rounded-lg border border-line px-3 py-2"
              placeholder="New category"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
          </form>
        </aside>
        <section className="rounded-xl border border-line bg-paper p-4">
          {visible.map((item) => (
            <div key={item._id} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 border-b border-line py-3">
              {item.imageUrl ? (
                <img className="h-[72px] w-[72px] rounded-lg object-cover" src={item.imageUrl} alt="" />
              ) : (
                <div className="h-[72px] w-[72px] rounded-lg bg-[#e9e1d2]" />
              )}
              <div>
                <strong>{item.name}</strong>
                <div className="text-sm text-muted">{item.description}</div>
                <div className="font-mono">{formatInr(item.pricePaise)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-line px-2 py-1 text-sm"
                  onClick={() => api.patchItem(item._id, { isAvailable: !item.isAvailable }).then(load)}
                >
                  {item.isAvailable ? "Available" : "Hidden"}
                </button>
                <button className="rounded-lg border border-line px-2 py-1 text-sm" onClick={() => setEditing(item)}>
                  Edit
                </button>
                <button
                  className="rounded-lg bg-danger px-2 py-1 text-sm text-white"
                  onClick={() => {
                    if (confirm(`Remove ${item.name}?`)) api.deleteItem(item._id).then(load);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {!visible.length ? <p className="text-muted">No items in this category.</p> : null}
        </section>
      </div>
      {editing ? (
        <ItemModal
          item={editing === "new" ? null : editing}
          categoryId={active}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function ItemModal({
  item,
  categoryId,
  categories,
  onClose,
  onSaved,
}: {
  item: MenuItem | null;
  categoryId: string;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [price, setPrice] = useState(item ? String(item.pricePaise / 100) : "");
  const [cat, setCat] = useState(item?.categoryId || categoryId);
  const [available, setAvailable] = useState(item?.isAvailable ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("description", description);
      form.set("priceRupees", price);
      form.set("categoryId", cat);
      form.set("isAvailable", String(available));
      if (file) form.set("image", file);
      await api.saveItem(item?._id || null, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 grid place-items-center bg-black/35 p-5" onClick={onClose}>
      <form
        className="w-full max-w-lg rounded-2xl border border-line bg-paper p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <h1 className="font-display text-2xl">{item ? "Edit item" : "New item"}</h1>
        <label className="mt-3 block text-sm text-muted">Name</label>
        <input className="mt-1 w-full rounded-lg border border-line px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
        <label className="mt-3 block text-sm text-muted">Category</label>
        <select className="mt-1 w-full rounded-lg border border-line px-3 py-2" value={cat} onChange={(e) => setCat(e.target.value)}>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="mt-3 block text-sm text-muted">Price (₹)</label>
        <input className="mt-1 w-full rounded-lg border border-line px-3 py-2" type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <label className="mt-3 block text-sm text-muted">Description</label>
        <textarea className="mt-1 w-full rounded-lg border border-line px-3 py-2" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="mt-3 block text-sm text-muted">Photo</label>
        <input className="mt-1 w-full" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
          Available on WhatsApp
        </label>
        {error ? <p className="mt-2 text-danger">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <button className="rounded-lg bg-ink px-4 py-2 text-white" disabled={busy}>
            Save
          </button>
          <button type="button" className="rounded-lg border border-line px-4 py-2" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
