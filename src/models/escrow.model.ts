import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
export interface IEscrow extends Document {
  orderId:  mongoose.Types.ObjectId;   // ref: Order — unique, one escrow per order
  buyerId:  mongoose.Types.ObjectId;   // ref: User
  vendorId: mongoose.Types.ObjectId;   // ref: Vendor
  // ── Financials ──────────────────────────────────────────────────────────────
  amount:       number;   // total held — what the buyer paid
  platformFee:  number;   // platform's cut (stays with platform)
  vendorAmount: number;   // amount released to vendor on completion (amount - platformFee)
  // ── Stripe references ────────────────────────────────────────────────────────
  stripePaymentIntentId: string;   // the original Stripe charge
  stripeTransferId?:     string;   // set when funds are transferred to vendor
  stripeRefundId?:       string;   // set when buyer is refunded
  // ── Status & lifecycle ───────────────────────────────────────────────────────
  status: "holding" | "released" | "refunded" | "disputed" | "partially_refunded";
  heldAt:      Date;    // when escrow was created (on payment success)
  releasedAt?: Date;    // when funds were sent to vendor
  refundedAt?: Date;    // when buyer was refunded
  // ── Dispute fields (only populated when status === "disputed") ───────────────
  disputeReason?: string;
  resolvedBy?:    mongoose.Types.ObjectId;  // ref: User (support or admin who resolved it)
  resolvedAt?:    Date;
  createdAt:      Date;
  updatedAt:      Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const EscrowSchema = new Schema<IEscrow>(
  {
    // unique: true enforces the one-to-one relationship with Order at the DB level
    orderId:  { type: Schema.Types.ObjectId, ref: "Order",  required: true, unique: true },
    buyerId:  { type: Schema.Types.ObjectId, ref: "User",   required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },

    amount:       { type: Number, required: true },
    platformFee:  { type: Number, required: true },
    vendorAmount: { type: Number, required: true },

    stripePaymentIntentId: { type: String, required: true },
    stripeTransferId:      { type: String },
    stripeRefundId:        { type: String },

    status: {
      type:    String,
      enum:    ["holding", "released", "refunded", "disputed", "partially_refunded"],
      default: "holding",
    },

    heldAt:      { type: Date, required: true, default: Date.now },
    releasedAt:  { type: Date },
    refundedAt:  { type: Date },

    disputeReason: { type: String },
    resolvedBy:    { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt:    { type: Date },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
EscrowSchema.index({ orderId: 1 });
EscrowSchema.index({ vendorId: 1 });
EscrowSchema.index({ buyerId: 1 });
EscrowSchema.index({ status: 1 });   // finance_manager queries all "holding" escrows

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Escrow = mongoose.model<IEscrow>("Escrow", EscrowSchema);
