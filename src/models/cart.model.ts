import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACES ───────────────────────────────────────────────────────────────
interface ICartItem {
  productId:   mongoose.Types.ObjectId;  // ref: Product
  variantSku?: string;                   // which variant (if product has variants)
  quantity:    number;
  price:       number;                   // price at the time item was added to cart
                                         // used to detect price changes before checkout
}

export interface ICart extends Document {
  userId:      mongoose.Types.ObjectId;  // ref: User — unique, one cart per user
  items:       ICartItem[];
  couponCode?: string;                   // coupon being applied to this cart
  updatedAt:   Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const CartItemSchema = new Schema<ICartItem>(
  {
    productId:  { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantSku: { type: String },
    quantity:   { type: Number, required: true, min: 1 },
    price:      { type: Number, required: true },
  },
  { _id: false }
);

const CartSchema = new Schema<ICart>(
  {
    // unique: true — one cart document per user, always
    userId:     { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items:      [CartItemSchema],
    couponCode: { type: String },
  },
  {
    // We only need updatedAt on a cart — createdAt is not useful here
    timestamps: true,
  }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
CartSchema.index({ userId: 1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Cart = mongoose.model<ICart>("Cart", CartSchema);
