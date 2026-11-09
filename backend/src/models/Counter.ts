import mongoose, { Schema } from "mongoose";

export interface CounterDoc {
  _id: string;
  seq: number;
}

const schema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<CounterDoc>("Counter", schema);

export async function nextToken(businessDate: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: `queue:${businessDate}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  if (!doc) throw new Error("Could not allocate token");
  return doc.seq;
}
