const TOKEN_KEY = "wp_bot_token";
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (res.status === 401) {
    setToken(null);
    if (!path.startsWith("/api/auth/login")) window.location.href = "/login";
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/api/auth/me"),
  categories: () => request<Category[]>("/api/categories"),
  createCategory: (body: Partial<Category>) =>
    request<Category>("/api/categories", { method: "POST", body: JSON.stringify(body) }),
  patchCategory: (id: string, body: Partial<Category>) =>
    request<Category>(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/api/categories/${id}`, { method: "DELETE" }),
  menuItems: (categoryId?: string) =>
    request<MenuItem[]>(
      "/api/menu-items" + (categoryId ? `?categoryId=${categoryId}` : "")
    ),
  saveItem: (id: string | null, form: FormData) =>
    request<MenuItem>(id ? `/api/menu-items/${id}` : "/api/menu-items", {
      method: id ? "PATCH" : "POST",
      body: form,
    }),
  patchItem: (id: string, body: Record<string, unknown>) =>
    request<MenuItem>(`/api/menu-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteItem: (id: string) =>
    request<{ ok: boolean }>(`/api/menu-items/${id}`, { method: "DELETE" }),
  orders: (status?: string) =>
    request<Order[]>(`/api/orders${status ? `?status=${status}` : ""}`),
  setOrderStatus: (id: string, status: Order["status"]) =>
    request<Order>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  settings: () => request<Settings>("/api/settings"),
  patchSettings: (body: Partial<Settings>) =>
    request<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(body) }),
};

export type User = { id: string; email: string; name: string; role: string };
export type Category = { _id: string; name: string; sortOrder: number; isActive: boolean };
export type MenuItem = {
  _id: string;
  categoryId: string;
  name: string;
  description: string;
  pricePaise: number;
  imageUrl: string;
  isAvailable: boolean;
  sortOrder: number;
};
export type OrderItem = { itemId: string; name: string; pricePaise: number; qty: number };
export type Order = {
  _id: string;
  tokenNumber?: number;
  waPhone: string;
  customerName: string;
  fulfillment: "dine_in" | "parcel";
  tableNumber?: string;
  items: OrderItem[];
  totalPaise: number;
  status:
    | "awaiting_payment"
    | "paid"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled"
    | "payment_failed";
  paidAt?: string;
  createdAt: string;
};
export type Settings = {
  name: string;
  intro: string;
  whatsappDisplayNumber: string;
  timezone: string;
  dayStartHour: number;
  waLink: string;
  qrDataUrl: string;
  whatsappConfigured: boolean;
  razorpayConfigured: boolean;
};

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    paise / 100
  );
}
