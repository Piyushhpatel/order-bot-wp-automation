import mongoose, { Schema } from "mongoose";

export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled"
  | "payment_failed";

export type Fulfillment = "dine_in" | "parcel";

export interface OrderItem {
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
}

export interface OrderDoc extends mongoose.Document {
  tokenNumber?: number;
  businessDate?: string;
  waPhone: string;
  customerName: string;
  fulfillment: Fulfillment;
  tableNumber?: string;
  items: OrderItem[];
  totalPaise: number;
  status: OrderStatus;
  razorpayPaymentLinkId?: string;
  razorpayPaymentLinkUrl?: string;
  razorpayPaymentId?: string;
  paidAt?: Date;
  readyAt?: Date;
  completedAt?: Date;
  readyNotifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<OrderItem>(
  {
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    pricePaise: { type: Number, required: true },
    qty: { type: Number, required: true },
  },
  { _id: false }
);

const schema = new Schema<OrderDoc>(
  {
    tokenNumber: { type: Number },
    businessDate: { type: String },
    waPhone: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    fulfillment: { type: String, enum: ["dine_in", "parcel"], required: true },
    tableNumber: String,
    items: { type: [itemSchema], required: true },
    totalPaise: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "awaiting_payment",
        "paid",
        "preparing",
        "ready",
        "completed",
        "cancelled",
        "payment_failed",
      ],
      default: "awaiting_payment",
      index: true,
    },
    razorpayPaymentLinkId: String,
    razorpayPaymentLinkUrl: String,
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    paidAt: Date,
    readyAt: Date,
    completedAt: Date,
    readyNotifiedAt: Date,
  },
  { timestamps: true }
);

schema.index(
  { businessDate: 1, tokenNumber: 1 },
  { unique: true, sparse: true }
);

export const Order = mongoose.model<OrderDoc>("Order", schema);
