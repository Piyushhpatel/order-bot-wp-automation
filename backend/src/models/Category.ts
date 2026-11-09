import mongoose, { Schema } from "mongoose";

export interface CategoryDoc extends mongoose.Document {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

const schema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

schema.index({ sortOrder: 1, name: 1 });

export const Category = mongoose.model<CategoryDoc>("Category", schema);
