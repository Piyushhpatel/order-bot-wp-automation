import mongoose, { Schema } from "mongoose";

export interface UserDoc extends mongoose.Document {
  email: string;
  passwordHash: string;
  name: string;
  role: "owner";
}

const schema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["owner"], default: "owner" },
  },
  { timestamps: true }
);

export const User = mongoose.model<UserDoc>("User", schema);
