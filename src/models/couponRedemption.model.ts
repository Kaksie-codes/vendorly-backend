import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
// CouponRedemption exists for one reason: enforcing the perUserLimit on a coupon.
// When a buyer tries to apply a coupon, the service counts how many CouponRedemption
// documents exist for that (couponId + userId) pair and compares it to perUserLimit.
export interface ICouponRedemption extends Document {
  couponId:       mongoose.Types.ObjectId;  // ref: Coupon
  userId:         mongoose.Types.ObjectId;  // ref: User
  orderId:        mongoose.Types.ObjectId;  // ref: Order
  discountAmount: number;                   // actual discount applied on this order
  createdAt:      Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const CouponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId:       { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    userId:         { type: Schema.Types.ObjectId, ref: "User",   required: true },
    orderId:        { type: Schema.Types.ObjectId, ref: "Order",  required: true },
    discountAmount: { type: Number, required: true },
  },
  {
    timestamps: true,
    // No updatedAt needed — a redemption record is never modified after creation
  }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
CouponRedemptionSchema.index({ couponId: 1 });
CouponRedemptionSchema.index({ userId: 1 });

// The key query at checkout: "how many times has this user used this coupon?"
CouponRedemptionSchema.index({ couponId: 1, userId: 1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const CouponRedemption = mongoose.model<ICouponRedemption>("CouponRedemption", CouponRedemptionSchema);
