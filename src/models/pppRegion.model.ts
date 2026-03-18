import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
// PPPRegion maps a country to a discount percentage for marketplace products.
// Managed by super_admin or content_manager via the admin dashboard.
// Every change to a PPPRegion is written to AuditLog.
export interface IPPPRegion extends Document {
  country:         string;  // e.g. "Nigeria"
  countryCode:     string;  // ISO 3166-1 alpha-2 e.g. "NG", "IN", "BR"
  discountPercent: number;  // 0–100. e.g. 60 means buyer pays 40% of the original price
  isActive:        boolean;
  createdAt:       Date;
  updatedAt:       Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const PPPRegionSchema = new Schema<IPPPRegion>(
  {
    country:     { type: String, required: true },
    countryCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

    discountPercent: {
      type:     Number,
      required: true,
      min:      0,
      max:      100,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
// The main query at checkout: "find the PPP region for country code NG"
PPPRegionSchema.index({ countryCode: 1 });
PPPRegionSchema.index({ isActive: 1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const PPPRegion = mongoose.model<IPPPRegion>("PPPRegion", PPPRegionSchema);
