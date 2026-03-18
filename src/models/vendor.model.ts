import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACES ───────────────────────────────────────────────────────────────

interface IBankAccount {
  accountName:   string;
  accountNumber: string;
  bankName:      string;
  bankCode:      string;
  country:       string;
  currency:      string;   // e.g. "USD", "GBP", "NGN"
}

export interface IVendor extends Document {
  userId:                  mongoose.Types.ObjectId;  // ref: User
  storeName:               string;
  slug:                    string;                   // unique, URL-friendly store name
  logo?:                   string;                   // S3 URL
  banner?:                 string;                   // S3 URL
  bannerPosition:          { x: number; y: number }; // for drag-to-reposition feature
  description?:            string;
  plan:                    "starter" | "growth" | "pro";
  planFeePercent:          number;   // 10 | 7 | 5 — stored so old orders keep accurate fee history
  status:                  "pending" | "active" | "suspended" | "rejected";
  rejectionReason?:        string;   // filled by vendor_manager when rejecting
  stripeConnectAccountId?: string;   // Stripe Custom Connect account created by platform on their behalf
  isStripeOnboarded:       boolean;  // true once bank account is verified and attached via Stripe
  bankAccount?:            IBankAccount;
  contactEmail?:           string;
  contactPhone?:           string;
  socialLinks?:            {
    instagram?: string;
    twitter?:   string;
    website?:   string;
  };
  totalRevenue:   number;   // lifetime earnings (updated when escrow releases)
  totalOrders:    number;
  totalProducts:  number;
  rating:         number;
  totalReviews:   number;
  createdAt:      Date;
  updatedAt:      Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

// A helper to derive the platform fee from a plan.
// Stored on the vendor so we always know what rate to apply at checkout.
const PLAN_FEES: Record<string, number> = {
  starter: 10,
  growth:  7,
  pro:     5,
};

const BankAccountSchema = new Schema<IBankAccount>(
  {
    accountName:   { type: String, required: true },
    accountNumber: { type: String, required: true },
    bankName:      { type: String, required: true },
    bankCode:      { type: String, required: true },
    country:       { type: String, required: true },
    currency:      { type: String, required: true },
  },
  { _id: false }  // embedded — no need for its own _id
);

const VendorSchema = new Schema<IVendor>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    storeName: { type: String, required: true, trim: true },
    slug:      { type: String, required: true, unique: true, lowercase: true, trim: true },

    logo:          { type: String },
    banner:        { type: String },
    bannerPosition: {
      x: { type: Number, default: 50 },
      y: { type: Number, default: 50 },
    },

    description: { type: String },

    plan: {
      type:    String,
      enum:    ["starter", "growth", "pro"],
      default: "starter",
    },

    // Automatically set from the plan so we never have to recalculate it later.
    // When a vendor upgrades their plan, this field is also updated.
    // Historical orders keep the fee that was active when the order was placed.
    planFeePercent: {
      type:    Number,
      default: PLAN_FEES.starter,   // 10
    },

    status: {
      type:    String,
      enum:    ["pending", "active", "suspended", "rejected"],
      default: "pending",   // all new vendors start as pending until admin approves
    },

    rejectionReason: { type: String },

    stripeConnectAccountId: { type: String },
    isStripeOnboarded:      { type: Boolean, default: false },
    bankAccount:            { type: BankAccountSchema },

    contactEmail: { type: String },
    contactPhone: { type: String },

    socialLinks: {
      instagram: { type: String },
      twitter:   { type: String },
      website:   { type: String },
    },

    // Running totals — updated automatically as orders and reviews come in.
    // Storing these here avoids expensive aggregation queries on the dashboard.
    totalRevenue:  { type: Number, default: 0 },
    totalOrders:   { type: Number, default: 0 },
    totalProducts: { type: Number, default: 0 },
    rating:        { type: Number, default: 0 },
    totalReviews:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
VendorSchema.index({ userId: 1 });
VendorSchema.index({ slug: 1 });
VendorSchema.index({ status: 1 });
VendorSchema.index({ plan: 1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Vendor = mongoose.model<IVendor>("Vendor", VendorSchema);
export { PLAN_FEES };
