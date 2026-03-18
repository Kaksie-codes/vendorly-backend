import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
export interface ICoupon extends Document {
  code:            string;                        // unique code buyers enter at checkout
  vendorId?:       mongoose.Types.ObjectId;       // ref: Vendor — null = platform-wide coupon
  type:            "percentage" | "fixed";        // % off or flat amount off
  value:           number;                        // the discount value (e.g. 20 = 20% or $20)
  minOrderAmount:  number;                        // minimum cart total required to apply
  maxDiscount?:    number;                        // cap for percentage coupons
                                                  // e.g. 20% off but max $50 discount
  usageLimit:      number;                        // total number of times it can be used
  usageCount:      number;                        // how many times it has been used so far
  perUserLimit:    number;                        // how many times one user can use it
  isActive:        boolean;
  expiresAt:       Date;
  createdAt:       Date;
  updatedAt:       Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const CouponSchema = new Schema<ICoupon>(
  {
    // uppercase: true ensures "SAVE20" and "save20" are treated as the same code
    code:     { type: String, required: true, unique: true, uppercase: true, trim: true },

    // null = created by the platform (applies to any product)
    // set = created by a vendor (applies only to that vendor's products)
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },

    type:  { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },

    minOrderAmount: { type: Number, default: 0 },
    maxDiscount:    { type: Number },

    usageLimit:   { type: Number, required: true },
    usageCount:   { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },

    isActive:  { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
CouponSchema.index({ code: 1 });
CouponSchema.index({ vendorId: 1 });
CouponSchema.index({ isActive: 1, expiresAt: 1 });  // quickly check valid coupons at checkout

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Coupon = mongoose.model<ICoupon>("Coupon", CouponSchema);
