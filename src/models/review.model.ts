import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
export interface IReview extends Document {
  productId:          mongoose.Types.ObjectId;  // ref: Product
  vendorId:           mongoose.Types.ObjectId;  // ref: Vendor
  buyerId:            mongoose.Types.ObjectId;  // ref: User
  orderId:            mongoose.Types.ObjectId;  // ref: Order — one review per order item
  rating:             number;                   // 1–5
  title?:             string;
  body:               string;
  images:             string[];                 // S3 URLs — buyer can attach photos
  isVerifiedPurchase: boolean;                  // always true — only allowed after a delivered order
  status:             "pending" | "approved" | "rejected";  // content_manager moderates
  helpfulVotes:       number;                   // buyers can upvote helpful reviews
  createdAt:          Date;
  updatedAt:          Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const ReviewSchema = new Schema<IReview>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    vendorId:  { type: Schema.Types.ObjectId, ref: "Vendor",  required: true },
    buyerId:   { type: Schema.Types.ObjectId, ref: "User",    required: true },
    orderId:   { type: Schema.Types.ObjectId, ref: "Order",   required: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    title:  { type: String, trim: true },
    body:   { type: String, required: true, trim: true },
    images: [{ type: String }],

    isVerifiedPurchase: { type: Boolean, default: true },

    // New reviews start as "pending" — a content_manager approves or rejects them.
    // Only "approved" reviews are shown publicly.
    status: {
      type:    String,
      enum:    ["pending", "approved", "rejected"],
      default: "pending",
    },

    helpfulVotes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
ReviewSchema.index({ productId: 1 });
ReviewSchema.index({ vendorId: 1 });
ReviewSchema.index({ buyerId: 1 });
ReviewSchema.index({ status: 1 });
ReviewSchema.index({ rating: -1 });

// Prevents a buyer from reviewing the same order item twice
ReviewSchema.index({ orderId: 1, buyerId: 1 }, { unique: true });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Review = mongoose.model<IReview>("Review", ReviewSchema);
