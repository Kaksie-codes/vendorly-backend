import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
export interface ICategory extends Document {
  name:      string;
  slug:      string;
  image?:    string;                          // S3 URL
  parentId?: mongoose.Types.ObjectId;         // ref: Category — null means top-level category
  isActive:  boolean;
  sortOrder: number;                          // controls display order in the UI
  createdAt: Date;
  updatedAt: Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const CategorySchema = new Schema<ICategory>(
  {
    name:  { type: String, required: true, trim: true },
    slug:  { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: { type: String },

    // Self-referencing — a category can have a parent category.
    // This is how nesting works:
    //   Electronics (parentId: null)        ← top-level
    //     └── Phones (parentId: Electronics._id)
    //           └── Android (parentId: Phones._id)
    //
    // null = top-level category (no parent)
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },

    isActive:  { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
CategorySchema.index({ slug: 1 });
CategorySchema.index({ parentId: 1 });  // quickly fetch all children of a parent
CategorySchema.index({ isActive: 1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Category = mongoose.model<ICategory>("Category", CategorySchema);
