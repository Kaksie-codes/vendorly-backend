import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
// The current balance lives on User.loyaltyPoints — fast to read.
// LoyaltyTransaction gives the full history — every earn, redeem, and expiry event.
// This is the "statement" a user sees when they check their points history.
export interface ILoyaltyTransaction extends Document {
  userId:        mongoose.Types.ObjectId;  // ref: User
  type:          "earned" | "redeemed" | "expired";
  points:        number;                   // always a positive number — type describes direction
  source:        "purchase" | "checkout_discount" | "raffle_entry" | "event" | "expiry";
  orderId?:      mongoose.Types.ObjectId;  // ref: Order — set when earned or redeemed at checkout
  description:   string;                  // human-readable e.g. "Earned from order VND-2026-00042"
  balanceBefore: number;                  // User.loyaltyPoints before this transaction
  balanceAfter:  number;                  // User.loyaltyPoints after this transaction
  createdAt:     Date;
  // No updatedAt — transaction history must never be modified
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type:     String,
      enum:     ["earned", "redeemed", "expired"],
      required: true,
    },

    points: { type: Number, required: true, min: 1 },

    source: {
      type:     String,
      enum:     ["purchase", "checkout_discount", "raffle_entry", "event", "expiry"],
      required: true,
    },

    orderId:     { type: Schema.Types.ObjectId, ref: "Order" },
    description: { type: String, required: true },

    // Storing before/after balances means you can reconstruct the full ledger
    // without summing all transactions — useful for auditing discrepancies.
    balanceBefore: { type: Number, required: true },
    balanceAfter:  { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
LoyaltyTransactionSchema.index({ userId: 1, createdAt: -1 });  // user's points history
LoyaltyTransactionSchema.index({ type: 1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const LoyaltyTransaction = mongoose.model<ILoyaltyTransaction>("LoyaltyTransaction", LoyaltyTransactionSchema);
