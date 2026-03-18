import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACES ───────────────────────────────────────────────────────────────

// An order item is a snapshot of the product at the time of purchase.
// We never reference live product data in an order — prices and names change.
// If a vendor updates their product price tomorrow, old orders must still show
// the price the buyer actually paid.
export interface IOrderItem {
  productId:   mongoose.Types.ObjectId;  // ref: Product (for linking, not for price)
  variantSku?: string;                   // which variant was purchased (if any)
  name:        string;                   // snapshot of product name
  image:       string;                   // snapshot of product image URL
  price:       number;                   // snapshot of unit price at purchase time
  quantity:    number;
  sku:         string;
  subtotal:    number;                   // price × quantity
}

// Snapshot of the shipping address at purchase time — same reason as order items.
// If a buyer updates their address later, old orders still show where it was shipped.
interface IShippingAddress {
  firstName:  string;
  lastName:   string;
  street:     string;
  city:       string;
  state:      string;
  country:    string;
  postalCode?: string;
  phone?:     string;
}

export interface IOrder extends Document {
  orderNumber:           string;   // human-readable e.g. "VND-2026-00001"
  checkoutId:            string;   // groups all orders from the same cart checkout
                                   // if buyer bought from 3 vendors, 3 orders share this ID
  buyerId:               mongoose.Types.ObjectId;  // ref: User
  vendorId:              mongoose.Types.ObjectId;  // ref: Vendor
  items:                 IOrderItem[];
  // ── Financials ──────────────────────────────────────────────
  subtotal:              number;   // sum of all item subtotals
  shippingFee:           number;
  tax:                   number;
  pppDiscount:           number;   // PPP discount applied (marketplace products only)
  couponDiscount:        number;
  total:                 number;   // what the buyer actually paid
  platformFeePercent:    number;   // vendor's plan fee at time of order (5 | 7 | 10)
  platformFee:           number;   // total amount platform keeps (total × platformFeePercent)
  vendorPayout:          number;   // total - platformFee (what vendor will receive)
  // ── Payment & Escrow ────────────────────────────────────────
  stripePaymentIntentId: string;   // Stripe's ID — used to track and verify the payment
  paymentStatus:         "pending" | "paid" | "failed" | "refunded";
  escrowStatus:          "holding" | "released" | "refunded" | "disputed";
  // ── Order Status ────────────────────────────────────────────
  orderStatus:           "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
  // ── Shipping ────────────────────────────────────────────────
  shippingAddress:       IShippingAddress;
  trackingNumber?:       string;
  shippingCarrier?:      string;
  // ── Timestamps for escrow logic ─────────────────────────────
  deliveryConfirmedAt?:  Date;  // set when buyer clicks "confirm delivery"
  autoReleaseAt?:        Date;  // set to deliveryConfirmedAt + 7 days — cron job uses this
  // ── Extras ──────────────────────────────────────────────────
  couponCode?:           string;
  buyerNote?:            string;
  createdAt:             Date;
  updatedAt:             Date;
}

// ─── SUB-SCHEMAS ──────────────────────────────────────────────────────────────

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId:   { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantSku:  { type: String },
    name:        { type: String, required: true },
    image:       { type: String, required: true },
    price:       { type: Number, required: true },
    quantity:    { type: Number, required: true, min: 1 },
    sku:         { type: String, required: true },
    subtotal:    { type: Number, required: true },
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    firstName:  { type: String, required: true },
    lastName:   { type: String, required: true },
    street:     { type: String, required: true },
    city:       { type: String, required: true },
    state:      { type: String, required: true },
    country:    { type: String, required: true },
    postalCode: { type: String },
    phone:      { type: String },
  },
  { _id: false }
);

// ─── MAIN SCHEMA ──────────────────────────────────────────────────────────────

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    checkoutId:  { type: String, required: true },

    buyerId:  { type: Schema.Types.ObjectId, ref: "User",   required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },

    items: [OrderItemSchema],

    // ── Financials ──────────────────────────────────────────────────────────
    subtotal:       { type: Number, required: true },
    shippingFee:    { type: Number, default: 0 },
    tax:            { type: Number, default: 0 },
    pppDiscount:    { type: Number, default: 0 },
    couponDiscount: { type: Number, default: 0 },
    total:          { type: Number, required: true },

    // Copied from Vendor.planFeePercent at checkout time — never recalculated.
    // This preserves accuracy even if the vendor changes their plan later.
    platformFeePercent: { type: Number, required: true },
    platformFee:        { type: Number, required: true },
    vendorPayout:       { type: Number, required: true },

    // ── Payment & Escrow ────────────────────────────────────────────────────
    stripePaymentIntentId: { type: String, required: true },

    paymentStatus: {
      type:    String,
      enum:    ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    escrowStatus: {
      type:    String,
      enum:    ["holding", "released", "refunded", "disputed"],
      default: "holding",
    },

    // ── Order Status ────────────────────────────────────────────────────────
    orderStatus: {
      type:    String,
      enum:    ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"],
      default: "pending",
    },

    // ── Shipping ────────────────────────────────────────────────────────────
    shippingAddress: { type: ShippingAddressSchema, required: true },
    trackingNumber:  { type: String },
    shippingCarrier: { type: String },

    // ── Escrow timing ───────────────────────────────────────────────────────
    deliveryConfirmedAt: { type: Date },
    autoReleaseAt:       { type: Date },  // set when orderStatus becomes "delivered"

    // ── Extras ──────────────────────────────────────────────────────────────
    couponCode: { type: String },
    buyerNote:  { type: String },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
OrderSchema.index({ buyerId: 1 });
OrderSchema.index({ vendorId: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ checkoutId: 1 });          // fetch all orders from same checkout
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ escrowStatus: 1 });        // escrow job queries by this
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ autoReleaseAt: 1 });       // cron job finds orders ready for auto-release
OrderSchema.index({ createdAt: -1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Order = mongoose.model<IOrder>("Order", OrderSchema);
