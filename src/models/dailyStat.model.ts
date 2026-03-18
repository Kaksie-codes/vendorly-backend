import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
// DailyStat is written by a nightly cron job — never computed live on request.
// vendorId = null means it's a platform-wide stat (all vendors combined).
// vendorId = set means it's that specific vendor's daily stat.
export interface IDailyStat extends Document {
  date:       Date;
  vendorId?:  mongoose.Types.ObjectId;  // ref: Vendor — null = platform-wide
  revenue:    number;
  orders:     number;
  newUsers:   number;   // only meaningful on platform-wide stats
  newVendors: number;   // only meaningful on platform-wide stats
  topProducts: {
    productId: mongoose.Types.ObjectId;  // ref: Product
    sales:     number;
  }[];
  createdAt: Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const DailyStatSchema = new Schema<IDailyStat>(
  {
    date:      { type: Date, required: true },
    vendorId:  { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    revenue:   { type: Number, default: 0 },
    orders:    { type: Number, default: 0 },
    newUsers:  { type: Number, default: 0 },
    newVendors:{ type: Number, default: 0 },
    topProducts: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product" },
        sales:     { type: Number },
        _id:       false,
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
// The main query pattern: "give me stats for vendor X between date A and date B"
DailyStatSchema.index({ vendorId: 1, date: -1 });

// Prevent duplicate stat entries for the same vendor on the same day
DailyStatSchema.index({ vendorId: 1, date: 1 }, { unique: true });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const DailyStat = mongoose.model<IDailyStat>("DailyStat", DailyStatSchema);
