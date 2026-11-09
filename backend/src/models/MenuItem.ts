import mongoose, { Schema } from "mongoose";

export interface MenuItemDoc extends mongoose.Document {
  categoryId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  pricePaise: number;
  imageUrl: string;
  isAvailable: boolean;
  sortOrder: number;
}

const schema = new Schema<MenuItemDoc>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    pricePaise: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: "" },
    isAvailable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.index({ categoryId: 1, sortOrder: 1, name: 1 });

export const MenuItem = mongoose.model<MenuItemDoc>("MenuItem", schema);
