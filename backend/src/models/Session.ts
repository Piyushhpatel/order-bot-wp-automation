import mongoose, { Schema } from "mongoose";

export type SessionState =
  | "welcome"
  | "browsing_categories"
  | "browsing_items"
  | "item_detail"
  | "choosing_qty"
  | "cart"
  | "editing_cart"
  | "editing_line"
  | "checkout_fulfillment"
  | "checkout_table"
  | "checkout_name"
  | "checkout_confirm"
  | "awaiting_payment";

export interface CartLine {
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
}

export interface CheckoutState {
  fulfillment?: "dine_in" | "parcel";
  tableNumber?: string;
  customerName?: string;
  pendingOrderId?: string;
}

export interface SessionDoc extends mongoose.Document {
  waPhone: string;
  state: SessionState;
  categoryId?: string;
  page: number;
  selectedItemId?: string;
  editingItemId?: string;
  cart: CartLine[];
  checkout: CheckoutState;
  updatedAt: Date;
}

const cartLine = new Schema<CartLine>(
  {
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    pricePaise: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const schema = new Schema<SessionDoc>(
  {
    waPhone: { type: String, required: true, unique: true },
    state: { type: String, default: "welcome" },
    categoryId: String,
    page: { type: Number, default: 0 },
    selectedItemId: String,
    editingItemId: String,
    cart: { type: [cartLine], default: [] },
    checkout: {
      fulfillment: { type: String, enum: ["dine_in", "parcel"] },
      tableNumber: String,
      customerName: String,
      pendingOrderId: String,
    },
  },
  { timestamps: true }
);

export const Session = mongoose.model<SessionDoc>("Session", schema);

export async function loadSession(waPhone: string): Promise<SessionDoc> {
  let session = await Session.findOne({ waPhone });
  if (!session) {
    session = await Session.create({ waPhone, state: "welcome", cart: [] });
  }
  return session;
}
