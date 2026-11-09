import mongoose, { Schema } from "mongoose";

export interface ProcessedEventDoc extends mongoose.Document {
  eventId: string;
  source: "razorpay" | "whatsapp";
  processedAt: Date;
}

const schema = new Schema<ProcessedEventDoc>({
  eventId: { type: String, required: true, unique: true },
  source: { type: String, enum: ["razorpay", "whatsapp"], required: true },
  processedAt: { type: Date, default: Date.now },
});

export const ProcessedEvent = mongoose.model<ProcessedEventDoc>(
  "ProcessedEvent",
  schema
);

/** Returns true if this id is new and recorded. False if duplicate. */
export async function claimEvent(
  eventId: string,
  source: "razorpay" | "whatsapp"
): Promise<boolean> {
  try {
    await ProcessedEvent.create({ eventId, source, processedAt: new Date() });
    return true;
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e.code === 11000) return false;
    throw err;
  }
}
