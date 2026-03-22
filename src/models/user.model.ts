import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
// Describes the shape of a User document in TypeScript.
// "extends Document" adds built-in Mongoose fields like _id, save(), etc.

interface IAddress {
  label: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  phone?: string;
  isDefault: boolean;
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;  // empty string for OAuth users with no family name
  email: string;
  password?: string;         // undefined for OAuth users — they never set a password
  authProvider: "local" | "google" | "github" | "facebook" | "twitter";
  providerId?: string;       // the user's ID from the OAuth provider
  phone?: string;
  avatar?: string;                          // S3 URL
  role: "buyer" | "vendor" | "admin";
  // Only populated when role === "admin". Ignored for buyers and vendors.
  adminRole?: "super_admin" | "vendor_manager" | "order_manager" | "finance_manager" | "content_manager" | "support";
  status: "active" | "suspended" | "banned";
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  activeSessionId?: string;                 // used for single device login (see Section 6 of guide)
  addresses: IAddress[];
  wishlist: mongoose.Types.ObjectId[];      // array of Product IDs
  country?: string;                         // ISO country code e.g. "NG" — used for PPP pricing
  totalSpent: number;                       // lifetime spend in USD — updated on every completed order
  loyaltyPoints: number;                    // current redeemable point balance
  pointsExpiresAt?: Date;                   // resets whenever points are earned or redeemed
  createdAt: Date;
  updatedAt: Date;
}

// ─── SUB-SCHEMA ───────────────────────────────────────────────────────────────
// Addresses are embedded directly inside the User document.
// We do this because a user rarely has more than ~5 addresses and they are
// always loaded together with the user — no need for a separate collection.

const AddressSchema = new Schema<IAddress>(
  {
    label:      { type: String, default: "Home" },   // "Home", "Work", "Other"
    firstName:  { type: String, required: true },
    lastName:   { type: String, required: true },
    street:     { type: String, required: true },
    city:       { type: String, required: true },
    state:      { type: String, required: true },
    country:    { type: String, default: "Nigeria" },
    postalCode: { type: String },
    phone:      { type: String },
    isDefault:  { type: Boolean, default: false },
  },
  { _id: true }  // each address gets its own _id so we can target one to update or delete
);

// ─── MAIN SCHEMA ──────────────────────────────────────────────────────────────
const UserSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: false, trim: true, default: "" },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },

    // select: false means this field is NEVER returned in queries by default.
    // To get the password you must explicitly write .select("+password").
    // This prevents accidentally exposing hashed passwords in API responses.
    // Not required — OAuth users (Google, GitHub, etc.) don't have a password.
    password: { type: String, select: false },

    // How the user created their account. Defaults to "local" (email + password).
    // OAuth users get the provider name set here on creation.
    authProvider: {
      type:    String,
      enum:    ["local", "google", "github", "facebook", "twitter"],
      default: "local",
    },

    // The user's ID from the OAuth provider (e.g. Google's "sub" field).
    // select: false — not sensitive, but no need to expose it in API responses.
    providerId: { type: String, select: false },

    phone:  { type: String },
    avatar: { type: String },

    role: { type: String, enum: ["buyer", "vendor", "admin"], default: "buyer" },

    // Only set when role === "admin". The auth middleware checks both role and adminRole
    // to grant access to specific admin routes.
    adminRole: {
      type: String,
      enum: ["super_admin", "vendor_manager", "order_manager", "finance_manager", "content_manager", "support"],
    },

    status: { type: String, enum: ["active", "suspended", "banned"], default: "active" },

    isEmailVerified:          { type: Boolean, default: false },
    emailVerificationToken:   { type: String, select: false },
    emailVerificationExpires: { type: Date,   select: false },
    passwordResetToken:       { type: String, select: false },
    passwordResetExpires:     { type: Date,   select: false },

    // Also select: false — only the auth middleware reads this field.
    // Storing it on the user enables single device login (see Session model).
    activeSessionId: { type: String, select: false },

    addresses: [AddressSchema],

    // An array of Product ObjectIds — just references, not the full product data.
    // ref: "Product" tells Mongoose which collection to populate from when needed.
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],

    // ISO 3166-1 alpha-2 country code e.g. "NG", "GB", "US"
    // Set from billing address on first purchase. Used to apply PPP discounts.
    country: { type: String },

    // Loyalty fields — updated by loyalty.service on every completed order
    totalSpent:      { type: Number, default: 0 },
    loyaltyPoints:   { type: Number, default: 0 },
    pointsExpiresAt: { type: Date },
  },
  {
    // timestamps: true automatically adds createdAt and updatedAt fields.
    // Mongoose manages them — you never set them manually.
    timestamps: true,
  }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
// Indexes make queries faster by telling MongoDB which fields to pre-sort.
// Without indexes, MongoDB scans every document in the collection on each query.
// email already has unique:true on the field definition above — that creates an index automatically
// no need to duplicate it here
UserSchema.index({ role: 1 });                       // fast filtering by role (used in admin queries)
UserSchema.index({ adminRole: 1 });                  // fast lookup of specific admin roles
UserSchema.index({ status: 1 });                     // fast filtering by status (used in admin queries)
UserSchema.index({ authProvider: 1, providerId: 1 }); // fast OAuth login lookup

// ─── MODEL ────────────────────────────────────────────────────────────────────
// mongoose.model() creates the model and maps it to the "users" collection in MongoDB.
// Mongoose automatically pluralises and lowercases "User" → "users".
export const User = mongoose.model<IUser>("User", UserSchema);
