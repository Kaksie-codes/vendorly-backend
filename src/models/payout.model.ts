import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
// A payout is a Stripe transfer from the platform's account to a vendor's
// Stripe Custom Connect account. It can cover multiple orders at once.
// Only finance_manager or super_admin can trigger a payout.
export interface IPayout extends Document {
  vendorId:               mongoose.Types.ObjectId;    // ref: Vendor
  orders:                 mongoose.Types.ObjectId[];  // ref: Order[] — orders included in this payout
  amount:                 number;   // total sent to vendor (sum of vendorPayout across orders)
  platformFeeCollected:   number;   // total platform fees from these orders (for records)
  status:                 "pending" | "processing" | "completed" | "failed";
  stripeTransferId?:      string;   // Stripe transfer ID — set on success
  stripeConnectAccountId: string;   // vendor's Stripe Custom Connect account ID
  failureReason?:         string;   // Stripe error message if transfer fails
  processedBy:            mongoose.Types.ObjectId;  // ref: User (finance_manager or super_admin)
  processedAt?:           Date;     // when the transfer was completed or failed
  createdAt:              Date;
  updatedAt:              Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const PayoutSchema = new Schema<IPayout>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    orders:   [{ type: Schema.Types.ObjectId, ref: "Order" }],

    amount:               { type: Number, required: true },
    platformFeeCollected: { type: Number, required: true },

    status: {
      type:    String,
      enum:    ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    stripeTransferId:      { type: String },
    stripeConnectAccountId:{ type: String, required: true },
    failureReason:         { type: String },

    processedBy:  { type: Schema.Types.ObjectId, ref: "User", required: true },
    processedAt:  { type: Date },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
PayoutSchema.index({ vendorId: 1 });
PayoutSchema.index({ status: 1 });
PayoutSchema.index({ processedBy: 1 });
PayoutSchema.index({ createdAt: -1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Payout = mongoose.model<IPayout>("Payout", PayoutSchema);
