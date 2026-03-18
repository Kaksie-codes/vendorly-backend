import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACES ───────────────────────────────────────────────────────────────

interface IProductImage {
  url:       string;   // S3 URL
  alt?:      string;   // accessibility text
  isPrimary: boolean;  // the main image shown in listings
  sortOrder: number;   // controls display order
}

// A variant option defines the axes of variation for a product.
// e.g. { name: "Color", values: ["Red", "Blue", "Green"] }
//      { name: "Size",  values: ["S", "M", "L", "XL"] }
interface IVariantOption {
  name:   string;
  values: string[];
}

// A variant is one specific combination of options with its own price and stock.
// e.g. { sku: "SHOE-RED-M", price: 49.99, stock: 12, attributes: { Color: "Red", Size: "M" } }
interface IVariant {
  sku:        string;
  price:      number;
  stock:      number;
  attributes: Map<string, string>;  // e.g. { Color: "Red", Size: "M" }
}

export interface IProduct extends Document {
  vendorId:             mongoose.Types.ObjectId;  // ref: Vendor
  categoryId:           mongoose.Types.ObjectId;  // ref: Category
  name:                 string;
  slug:                 string;
  shortDescription?:    string;  // one-liner shown in product cards
  description:          string;  // full rich description shown on product page
  price:                number;  // base price in USD
  compareAtPrice?:      number;  // crossed-out "was" price — for showing discounts
  sku:                  string;  // unique identifier for the base product
  stock:                number;  // stock for the base product (when no variants)
  weight?:              number;  // in kg — used for shipping calculation
  images:               IProductImage[];
  variantOptions:       IVariantOption[];  // defines what axes of variation exist
  variants:             IVariant[];        // all specific combinations
  attributes?:          Map<string, string>;  // flexible extra fields e.g. { material: "leather" }
  tags:                 string[];
  status:               "active" | "draft" | "archived" | "out_of_stock";
  condition:            "new" | "like_new" | "good" | "fair";
  isMarketplaceProduct: boolean;  // true = sold by platform, PPP pricing applies at checkout
  featured:             boolean;
  isBestseller:         boolean;
  isNewArrival:         boolean;  // renamed from isNew — "isNew" is reserved by Mongoose
  // Running stats — updated automatically as orders and reviews come in
  rating:               number;
  totalReviews:         number;
  totalSales:           number;
  totalRevenue:         number;
  viewCount:            number;
  shippingInfo?:        string;
  returnPolicy?:        string;
  aiGenerated:          boolean;  // true if description was written by AI
  createdAt:            Date;
  updatedAt:            Date;
}

// ─── SUB-SCHEMAS ──────────────────────────────────────────────────────────────

const ProductImageSchema = new Schema<IProductImage>(
  {
    url:       { type: String, required: true },
    alt:       { type: String },
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }  // images don't need their own _id — sortOrder is enough to target them
);

const VariantOptionSchema = new Schema<IVariantOption>(
  {
    name:   { type: String, required: true },  // e.g. "Color"
    values: [{ type: String }],               // e.g. ["Red", "Blue"]
  },
  { _id: false }
);

const VariantSchema = new Schema<IVariant>(
  {
    sku:        { type: String, required: true },
    price:      { type: Number, required: true, min: 0 },
    stock:      { type: Number, required: true, min: 0, default: 0 },
    attributes: { type: Map, of: String },    // e.g. { Color: "Red", Size: "M" }
  },
  { _id: false }
);

// ─── MAIN SCHEMA ──────────────────────────────────────────────────────────────

const ProductSchema = new Schema<IProduct>(
  {
    vendorId:   { type: Schema.Types.ObjectId, ref: "Vendor",   required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },

    name:             { type: String, required: true, trim: true },
    slug:             { type: String, required: true, unique: true, lowercase: true },
    shortDescription: { type: String },
    description:      { type: String, required: true },

    price:          { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },

    sku:    { type: String, required: true, unique: true },
    stock:  { type: Number, required: true, min: 0, default: 0 },
    weight: { type: Number },

    images:         [ProductImageSchema],
    variantOptions: [VariantOptionSchema],
    variants:       [VariantSchema],

    // Map type — flexible key/value pairs for product-specific attributes.
    // e.g. { material: "leather", dimensions: "A5", weight: "0.3kg" }
    // Different product types need different attributes — a Map handles this cleanly.
    attributes: { type: Map, of: String },

    tags: [{ type: String }],

    status:    { type: String, enum: ["active", "draft", "archived", "out_of_stock"], default: "draft" },
    condition: { type: String, enum: ["new", "like_new", "good", "fair"], default: "new" },

    // true = this product is sold by the platform itself (not a vendor).
    // PPP discounts are applied at checkout only when this is true.
    // Vendor products always sell at the vendor's set price.
    isMarketplaceProduct: { type: Boolean, default: false },

    featured:      { type: Boolean, default: false },
    isBestseller:  { type: Boolean, default: false },
    isNewArrival:  { type: Boolean, default: true },

    // These are never set manually — they are updated by services as events happen
    rating:       { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalSales:   { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    viewCount:    { type: Number, default: 0 },

    shippingInfo:  { type: String },
    returnPolicy:  { type: String },
    aiGenerated:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
ProductSchema.index({ vendorId: 1 });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ slug: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ rating: -1 });         // -1 = descending (highest rating first)
ProductSchema.index({ totalSales: -1 });     // for bestseller sorting
ProductSchema.index({ createdAt: -1 });      // for newest first sorting
ProductSchema.index({ featured: 1, status: 1 });
ProductSchema.index({ isMarketplaceProduct: 1 });

// Full-text search index — lets you do Product.find({ $text: { $search: "leather bag" } })
// MongoDB will search across name, description, and tags simultaneously.
ProductSchema.index({ name: "text", description: "text", tags: "text" });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Product = mongoose.model<IProduct>("Product", ProductSchema);
