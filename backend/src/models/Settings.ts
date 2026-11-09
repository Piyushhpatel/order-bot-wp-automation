import mongoose, { Schema } from "mongoose";

export interface SettingsDoc extends mongoose.Document {
  name: string;
  intro: string;
  whatsappDisplayNumber: string;
  timezone: string;
  dayStartHour: number;
}

const schema = new Schema<SettingsDoc>(
  {
    name: { type: String, required: true, default: "Restaurant" },
    intro: {
      type: String,
      default:
        "Welcome. Scan, order, pay, collect. Tap Menu to get started.",
    },
    whatsappDisplayNumber: { type: String, default: "" },
    timezone: { type: String, default: "Asia/Kolkata" },
    dayStartHour: { type: Number, default: 6 },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<SettingsDoc>("Settings", schema);

export async function getSettings(): Promise<SettingsDoc> {
  let doc = await Settings.findOne();
  if (!doc) {
    doc = await Settings.create({});
  }
  return doc;
}
