# Vendorly — Backend Technical Guide

> In-depth backend specification for the Vendorly multi-vendor marketplace.
> Stack: Node.js · Express · TypeScript · Mongoose · MongoDB · Amazon S3 · JWT · Stripe · Socket.io

> **Last revised:** March 2026 — expanded from 13 to 19 models, added Stripe Connect escrow,
> PPP pricing, granular admin roles, audit logs, loyalty points, and in-app chat.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Project Folder Structure](#2-project-folder-structure)
3. [Database Design & Schema Overview](#3-database-design--schema-overview)
4. [Models / Schemas (All Collections)](#4-models--schemas-all-collections)
5. [How the Schemas Connect](#5-how-the-schemas-connect)
6. [Authentication & Single Device Login](#6-authentication--single-device-login)
7. [Role-Based Access Control](#7-role-based-access-control)
8. [API Endpoints](#8-api-endpoints)
9. [File Upload Flow (Amazon S3)](#9-file-upload-flow-amazon-s3)
10. [Stripe Connect & Escrow](#10-stripe-connect--escrow)
11. [Order & Payout State Machine](#11-order--payout-state-machine)
12. [Purchasing Power Parity (PPP)](#12-purchasing-power-parity-ppp)
13. [In-App Chat & Socket.io](#13-in-app-chat--socketio)
14. [Loyalty Points System](#14-loyalty-points-system)
15. [Audit Logs](#15-audit-logs)
16. [AI Integration Architecture](#16-ai-integration-architecture)
17. [Analytics System](#17-analytics-system)
18. [Error Handling Strategy](#18-error-handling-strategy)
19. [Environment Variables](#19-environment-variables)

---

## 1. System Architecture

### Overview

Vendorly follows a **monolithic REST API** architecture with a **Socket.io** layer for real-time chat.
A monolith is the right choice at this stage — simpler to build, deploy, debug, and scale until
the product has proven demand. Each module (auth, orders, AI, chat) can be extracted into a
microservice later without rewriting business logic.

```
┌──────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                │
│   Storefront (buyer)  │  Vendor Portal  │  Admin Console         │
│              Next.js App (already built)                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS / REST + WebSocket
┌────────────────────────────▼─────────────────────────────────────┐
│                      EXPRESS API SERVER                           │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  Auth       │  │  Rate        │  │  Request Validator       │ │
│  │  Middleware │  │  Limiter     │  │  (input sanitisation)    │ │
│  └──────┬──────┘  └──────────────┘  └─────────────────────────┘ │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │                       ROUTES                             │    │
│  │  /auth /products /orders /vendors /admin /ai /chat       │    │
│  └──────┬──────────────────────────────────────────────────┘    │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │                    CONTROLLERS                            │    │
│  │  Handle HTTP, call services, return responses             │    │
│  └──────┬──────────────────────────────────────────────────┘    │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │                     SERVICES                              │    │
│  │  Business logic — auth, orders, payouts, AI, S3, stripe  │    │
│  └──────┬──────────────────────────────────────────────────┘    │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │                      MODELS                               │    │
│  │  Mongoose schemas — MongoDB (19 collections)              │    │
│  └──────┬──────────────────────────────────────────────────┘    │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │                   SOCKET.IO LAYER                         │    │
│  │  Real-time chat — buyer↔vendor, user↔support             │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
          │
┌─────────▼────────┐  ┌───────────┐  ┌──────────────┐  ┌─────────┐
│    MongoDB        │  │  AWS S3   │  │    Stripe    │  │Anthropic│
│  (primary data)   │  │  (files)  │  │  (payments)  │  │  (AI)   │
└──────────────────┘  └───────────┘  └──────────────┘  └─────────┘
```

### Request Lifecycle

```
Request
  → Rate Limiter        (blocks abuse)
  → Auth Middleware     (validates JWT + checks active session)
  → Role Middleware     (checks buyer / vendor / admin / adminRole)
  → Route Handler
  → Controller          (validates input, calls service)
  → Service             (business logic, DB operations, Stripe calls)
  → AuditLog write      (if action is sensitive)
  → Response
```

### Design Principles

- **Controllers are thin** — parse request, call service, return response. No business logic.
- **Services are fat** — all business logic, DB queries, Stripe calls, external APIs live here.
- **Models are dumb** — schemas define shape and validation only. No logic in models.
- **One error format** — every error response has the same shape so the frontend handles errors uniformly.
- **Every sensitive action is audited** — admin and financial actions write to AuditLog automatically.

---

## 2. Project Folder Structure

```
vendorly-backend/
├── src/
│   ├── config/
│   │   ├── db.ts                  # MongoDB connection
│   │   ├── s3.ts                  # AWS S3 client setup
│   │   ├── stripe.ts              # Stripe client setup
│   │   └── ai.ts                  # Anthropic client setup
│   │
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── session.model.ts
│   │   ├── vendor.model.ts
│   │   ├── category.model.ts
│   │   ├── product.model.ts
│   │   ├── order.model.ts
│   │   ├── escrow.model.ts
│   │   ├── review.model.ts
│   │   ├── coupon.model.ts
│   │   ├── couponRedemption.model.ts
│   │   ├── payout.model.ts
│   │   ├── cart.model.ts
│   │   ├── notification.model.ts
│   │   ├── dailyStat.model.ts
│   │   ├── auditLog.model.ts
│   │   ├── conversation.model.ts
│   │   ├── message.model.ts
│   │   ├── pppRegion.model.ts
│   │   └── loyaltyTransaction.model.ts
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── vendor.controller.ts
│   │   ├── product.controller.ts
│   │   ├── order.controller.ts
│   │   ├── review.controller.ts
│   │   ├── coupon.controller.ts
│   │   ├── payout.controller.ts
│   │   ├── cart.controller.ts
│   │   ├── category.controller.ts
│   │   ├── analytics.controller.ts
│   │   ├── ai.controller.ts
│   │   ├── upload.controller.ts
│   │   ├── chat.controller.ts
│   │   ├── loyalty.controller.ts
│   │   └── admin/
│   │       ├── users.controller.ts
│   │       ├── vendors.controller.ts
│   │       ├── orders.controller.ts
│   │       ├── payouts.controller.ts
│   │       ├── auditLogs.controller.ts
│   │       ├── ppp.controller.ts
│   │       └── analytics.controller.ts
│   │
│   ├── routes/
│   │   ├── auth.route.ts
│   │   ├── user.route.ts
│   │   ├── vendor.route.ts
│   │   ├── product.route.ts
│   │   ├── order.route.ts
│   │   ├── review.route.ts
│   │   ├── coupon.route.ts
│   │   ├── payout.route.ts
│   │   ├── cart.route.ts
│   │   ├── category.route.ts
│   │   ├── analytics.route.ts
│   │   ├── ai.route.ts
│   │   ├── upload.route.ts
│   │   ├── chat.route.ts
│   │   ├── loyalty.route.ts
│   │   └── admin.route.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts          # JWT verification + session check
│   │   ├── role.middleware.ts          # buyer / vendor / admin guard
│   │   ├── adminRole.middleware.ts     # granular admin role guard
│   │   ├── upload.middleware.ts        # multer for S3
│   │   ├── rateLimiter.middleware.ts
│   │   └── errorHandler.middleware.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── email.service.ts
│   │   ├── s3.service.ts
│   │   ├── stripe.service.ts          # Stripe Connect + payments
│   │   ├── escrow.service.ts          # escrow hold / release / refund logic
│   │   ├── ai.service.ts
│   │   ├── analytics.service.ts
│   │   ├── payout.service.ts
│   │   ├── ppp.service.ts             # PPP discount calculation
│   │   ├── loyalty.service.ts         # points earn / redeem / expire
│   │   └── audit.service.ts           # writes AuditLog entries
│   │
│   ├── socket/
│   │   ├── index.ts                   # Socket.io server setup
│   │   ├── chat.socket.ts             # chat event handlers
│   │   └── notification.socket.ts    # real-time notification push
│   │
│   ├── jobs/
│   │   ├── escrowAutoRelease.job.ts   # auto-release escrow after 7 days
│   │   ├── loyaltyExpiry.job.ts       # expire loyalty points after 12 months
│   │   └── dailyStats.job.ts          # aggregate analytics nightly
│   │
│   ├── utils/
│   │   ├── jwt.ts
│   │   ├── hash.ts
│   │   ├── orderNumber.ts
│   │   ├── apiError.ts
│   │   └── apiResponse.ts
│   │
│   ├── types/
│   │   └── index.ts                   # Shared TypeScript types
│   │
│   ├── app.ts                         # Express app setup, middleware, routes
│   └── server.ts                      # Server entry point + Socket.io init
│
├── .env
├── .env.example
├── package.json
├── tsconfig.json
└── BACKEND_TECHNICAL_GUIDE.md
```

---

## 3. Database Design & Schema Overview

Vendorly has **19 MongoDB collections**.

```
User ──────────────────────── Session         (one active session per user)
 │
 ├── (role: vendor) ────────── Vendor ──────── Product ─── Review
 │                               │               │
 │                               │               ├── Category
 │                               │               └── OrderItem (embedded in Order)
 │                               │
 │                               └── Payout ─── Order (many)
 │
 ├── (role: buyer) ────────── Order ─────────── Coupon
 │                              │                │
 │                              ├── Escrow        └── CouponRedemption
 │                              └── LoyaltyTransaction (on purchase)
 │
 ├── (role: admin) ────────── AuditLog         (tracks every action)
 │
 ├── Cart                      (one per user)
 ├── Wishlist                  (field on User)
 ├── Addresses                 (embedded in User)
 ├── Notification
 ├── Conversation ──────────── Message
 └── LoyaltyTransaction

Platform-level:
 ├── PPPRegion                 (country → discount mapping)
 └── DailyStat                 (pre-aggregated analytics)
```

### Collection Summary

| # | Collection | Purpose | Key Relationships |
|---|---|---|---|
| 1 | User | All accounts (buyer, vendor, admin) | Has one Session, one Vendor (if vendor) |
| 2 | Session | Tracks active login per user | Belongs to User |
| 3 | Vendor | Vendor store profile + Stripe info | Belongs to User, has many Products and Payouts |
| 4 | Category | Product categories (supports nesting) | Self-referencing for subcategories |
| 5 | Product | Product listings | Belongs to Vendor and Category |
| 6 | Order | Purchase records | Belongs to User and Vendor, has embedded items |
| 7 | Escrow | Holds funds between payment and release | One-to-one with Order |
| 8 | Review | Product and vendor reviews | Belongs to Product, Vendor, User, Order |
| 9 | Coupon | Discount codes | Belongs to Vendor or platform-wide |
| 10 | CouponRedemption | Tracks who used which coupon | Belongs to Coupon, User, Order |
| 11 | Payout | Vendor earnings payouts via Stripe | Belongs to Vendor, references many Orders |
| 12 | Cart | Active shopping cart | Belongs to User |
| 13 | Notification | In-app notifications | Belongs to User |
| 14 | DailyStat | Pre-aggregated analytics | Belongs to Vendor or platform |
| 15 | AuditLog | Tracks every admin/sensitive action | Belongs to actor (User) |
| 16 | Conversation | Chat thread between two parties | Belongs to participants (Users) |
| 17 | Message | Individual chat message | Belongs to Conversation and sender |
| 18 | PPPRegion | Country → PPP discount mapping | Platform-level, no user reference |
| 19 | LoyaltyTransaction | History of points earned/redeemed | Belongs to User and optionally Order |

---

## 4. Models / Schemas (All Collections)

---

### 4.1 User

The central model. Every person — buyer, vendor, or admin — is a User.
Role determines what they can access. AdminRole gives granular control within admin accounts.

```typescript
// models/user.model.ts

interface IAddress {
  label: string;               // "Home", "Work", "Other"
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
  firstName:                string
  lastName:                 string
  email:                    string
  password:                 string           // select: false
  phone?:                   string
  avatar?:                  string           // S3 URL
  role:                     'buyer' | 'vendor' | 'admin'
  adminRole?:               'super_admin' | 'vendor_manager' | 'order_manager'
                          | 'finance_manager' | 'content_manager' | 'support'
                            // only set when role === 'admin'
  status:                   'active' | 'suspended' | 'banned'
  isEmailVerified:          boolean
  emailVerificationToken?:  string           // select: false
  emailVerificationExpires?: Date            // select: false
  passwordResetToken?:      string           // select: false
  passwordResetExpires?:    Date             // select: false
  activeSessionId?:         string           // select: false — single device login
  addresses:                IAddress[]       // embedded subdocuments
  wishlist:                 mongoose.Types.ObjectId[]  // ref: Product
  country?:                 string           // ISO country code — used for PPP
  totalSpent:               number           // lifetime spend in USD
  loyaltyPoints:            number           // current redeemable balance
  pointsExpiresAt?:         Date             // resets on any earn/redeem activity
  createdAt:                Date
  updatedAt:                Date
}

// Key design decisions:
// - password, activeSessionId, tokens: select: false — never returned by default
// - adminRole is only populated when role === 'admin'. Ignored for buyer/vendor.
// - totalSpent increments on every completed order
// - loyaltyPoints: 100 points = configurable discount amount at checkout
// - country drives PPP pricing for marketplace products
```

---

### 4.2 Session

Enables single device login. Every login creates a session. The session ID inside the JWT
is compared against User.activeSessionId on every request.

```typescript
// models/session.model.ts

export interface ISession extends Document {
  userId:     mongoose.Types.ObjectId   // ref: User
  sessionId:  string                    // UUID — stored in JWT and User.activeSessionId
  userAgent?: string                    // browser/device info at login
  ipAddress?: string                    // IP at login
  isActive:   boolean
  expiresAt:  Date                      // TTL index — MongoDB auto-deletes after this date
  createdAt:  Date
}

// TTL index on expiresAt (expireAfterSeconds: 0) — MongoDB auto-cleans expired sessions
// No manual cleanup needed
```

---

### 4.3 Vendor

A Vendor is always linked to a User with role: 'vendor'.
Holds store profile, Stripe Connect info, bank details, and financial summary.

```typescript
// models/vendor.model.ts

export interface IBankAccount {
  accountName:   string
  accountNumber: string
  bankName:      string
  bankCode:      string
  country:       string
  currency:      string    // e.g. "USD", "GBP", "NGN"
}

export interface IVendor extends Document {
  userId:                 mongoose.Types.ObjectId   // ref: User
  storeName:              string
  slug:                   string                    // unique, URL-friendly
  logo?:                  string                    // S3 URL
  banner?:                string                    // S3 URL
  bannerPosition:         { x: number; y: number }  // drag-to-reposition
  description?:           string
  plan:                   'starter' | 'growth' | 'pro'
  planFeePercent:         number    // 10 | 7 | 5 — stored at time of sale for accuracy
  status:                 'pending' | 'active' | 'suspended' | 'rejected'
  rejectionReason?:       string
  stripeConnectAccountId?: string   // Stripe Custom Connect account created by platform
  isStripeOnboarded:      boolean   // true once bank account is verified by Stripe
  bankAccount?:           IBankAccount
  contactEmail?:          string
  contactPhone?:          string
  socialLinks?:           { instagram?: string; twitter?: string; website?: string }
  totalRevenue:           number    // lifetime earnings
  totalOrders:            number
  totalProducts:          number
  rating:                 number
  totalReviews:           number
  createdAt:              Date
  updatedAt:              Date
}

// Plan fee structure:
// starter (free) → 10% platform fee per sale
// growth  (paid) → 7%  platform fee per sale
// pro     (paid) → 5%  platform fee per sale
//
// planFeePercent is stored on the vendor (and copied to Order) so historical
// orders always reflect the fee that was active at the time of sale.
```

---

### 4.4 Category

Supports nested categories (e.g. Electronics → Phones → Android).

```typescript
// models/category.model.ts

export interface ICategory extends Document {
  name:      string
  slug:      string
  image?:    string                              // S3 URL
  parentId?: mongoose.Types.ObjectId            // ref: Category — null = top level
  isActive:  boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}
```

---

### 4.5 Product

Vendor product listings. Marketplace products (sold by the platform) have PPP enabled.

```typescript
// models/product.model.ts

export interface IProduct extends Document {
  vendorId:             mongoose.Types.ObjectId   // ref: Vendor
  categoryId:           mongoose.Types.ObjectId   // ref: Category
  name:                 string
  slug:                 string                    // unique
  shortDescription?:    string
  description:          string
  price:                number                    // base price in USD
  compareAtPrice?:      number                    // crossed-out "was" price
  sku:                  string                    // unique
  stock:                number
  weight?:              number
  images:               { url: string; alt?: string; isPrimary: boolean; sortOrder: number }[]
  variantOptions?:      { name: string; values: string[] }[]
  variants?:            { sku: string; price: number; stock: number; attributes: Map<string,string> }[]
  attributes?:          Map<string, string>
  tags:                 string[]
  status:               'active' | 'draft' | 'archived' | 'out_of_stock'
  condition:            'new' | 'like_new' | 'good' | 'fair'
  isMarketplaceProduct: boolean   // true = sold by platform, PPP pricing applies
  featured:             boolean
  isBestseller:         boolean
  isNew:                boolean
  rating:               number
  totalReviews:         number
  totalSales:           number
  totalRevenue:         number
  viewCount:            number
  shippingInfo?:        string
  returnPolicy?:        string
  aiGenerated:          boolean   // true if description was AI-generated
  createdAt:            Date
  updatedAt:            Date
}

// isMarketplaceProduct:
//   true  → product is sold by the platform directly, PPP discount applies at checkout
//   false → vendor product, always sold at the vendor's set price regardless of buyer region
```

---

### 4.6 Order

One order per vendor per checkout. If a buyer purchases from 3 vendors, 3 Order documents
are created, all sharing the same checkoutId.

```typescript
// models/order.model.ts

export interface IOrderItem {
  productId:   mongoose.Types.ObjectId
  variantSku?: string
  name:        string     // snapshot of product name at purchase time
  image:       string     // snapshot of product image at purchase time
  price:       number     // snapshot of price at purchase time
  quantity:    number
  sku:         string
  subtotal:    number
}

export interface IOrder extends Document {
  orderNumber:            string        // e.g. VND-2026-00001
  checkoutId:             string        // groups orders from same cart checkout
  buyerId:                mongoose.Types.ObjectId   // ref: User
  vendorId:               mongoose.Types.ObjectId   // ref: Vendor
  items:                  IOrderItem[]  // embedded — snapshot at purchase time
  subtotal:               number
  shippingFee:            number
  tax:                    number
  pppDiscount:            number        // discount applied via PPP (marketplace products only)
  couponDiscount:         number
  total:                  number        // what buyer actually paid
  platformFeePercent:     number        // vendor's plan fee at time of order (5 | 7 | 10)
  platformFee:            number        // total amount platform keeps
  vendorPayout:           number        // total - platformFee (what vendor receives)
  stripePaymentIntentId:  string        // Stripe PaymentIntent ID
  paymentStatus:          'pending' | 'paid' | 'failed' | 'refunded'
  escrowStatus:           'holding' | 'released' | 'refunded' | 'disputed'
  orderStatus:            'pending' | 'confirmed' | 'processing' | 'shipped'
                        | 'delivered' | 'cancelled' | 'returned'
  shippingAddress:        IAddress      // embedded snapshot at purchase time
  trackingNumber?:        string
  shippingCarrier?:       string
  deliveryConfirmedAt?:   Date          // set when buyer confirms delivery
  autoReleaseAt?:         Date          // escrow auto-releases 7 days after delivery
  buyerNote?:             string
  couponCode?:            string
  createdAt:              Date
  updatedAt:              Date
}

// Financial flow per order:
// buyer pays total → escrow holds total
// on release: vendor receives vendorPayout, platform keeps platformFee
```

---

### 4.7 Escrow

Tracks the state of funds held between buyer payment and vendor payout.
One Escrow document per Order.

```typescript
// models/escrow.model.ts

export interface IEscrow extends Document {
  orderId:                mongoose.Types.ObjectId   // ref: Order (unique — 1:1)
  buyerId:                mongoose.Types.ObjectId   // ref: User
  vendorId:               mongoose.Types.ObjectId   // ref: Vendor
  amount:                 number     // total held (what buyer paid)
  platformFee:            number     // platform's cut
  vendorAmount:           number     // amount to release to vendor
  status:                 'holding' | 'released' | 'refunded' | 'disputed' | 'partially_refunded'
  stripePaymentIntentId:  string
  stripeTransferId?:      string     // set when funds released to vendor
  stripeRefundId?:        string     // set when buyer refunded
  heldAt:                 Date       // when escrow was created (on payment)
  releasedAt?:            Date       // when funds released to vendor
  refundedAt?:            Date       // when buyer was refunded
  disputeReason?:         string     // reason if buyer raised a dispute
  resolvedBy?:            mongoose.Types.ObjectId   // ref: User (support/admin)
  resolvedAt?:            Date
  createdAt:              Date
  updatedAt:              Date
}

// Escrow lifecycle:
//   holding       → buyer paid, money sitting in platform Stripe account
//   released      → buyer confirmed delivery OR auto-release triggered after 7 days
//   refunded      → buyer was refunded (dispute resolved in buyer's favour)
//   disputed      → buyer raised a dispute, under admin/support review
//   partially_refunded → split decision (e.g. partial refund, partial release)
```

---

### 4.8 Review

Buyers review products and vendors after a confirmed delivered order.

```typescript
// models/review.model.ts

export interface IReview extends Document {
  productId:          mongoose.Types.ObjectId   // ref: Product
  vendorId:           mongoose.Types.ObjectId   // ref: Vendor
  buyerId:            mongoose.Types.ObjectId   // ref: User
  orderId:            mongoose.Types.ObjectId   // ref: Order — ensures one review per order item
  rating:             number           // 1–5
  title?:             string
  body:               string
  images:             string[]         // S3 URLs
  isVerifiedPurchase: boolean          // always true — review only allowed after delivered order
  status:             'pending' | 'approved' | 'rejected'
  helpfulVotes:       number
  createdAt:          Date
  updatedAt:          Date
}
```

---

### 4.9 Coupon

Discount codes. Can be vendor-specific or platform-wide (vendorId = null).

```typescript
// models/coupon.model.ts

export interface ICoupon extends Document {
  code:           string                          // unique
  vendorId?:      mongoose.Types.ObjectId         // ref: Vendor — null = platform-wide
  type:           'percentage' | 'fixed'
  value:          number                          // % or flat amount
  minOrderAmount: number                          // minimum cart total to apply
  maxDiscount?:   number                          // cap for percentage coupons
  usageLimit:     number                          // total uses allowed
  usageCount:     number                          // current use count
  perUserLimit:   number                          // how many times one user can use it
  isActive:       boolean
  expiresAt:      Date
  createdAt:      Date
  updatedAt:      Date
}
```

---

### 4.10 CouponRedemption

Tracks each individual use of a coupon — enforces per-user limits.

```typescript
// models/couponRedemption.model.ts

export interface ICouponRedemption extends Document {
  couponId:       mongoose.Types.ObjectId   // ref: Coupon
  userId:         mongoose.Types.ObjectId   // ref: User
  orderId:        mongoose.Types.ObjectId   // ref: Order
  discountAmount: number
  createdAt:      Date
}
```

---

### 4.11 Payout

A payout is a Stripe transfer from the platform account to a vendor's Stripe Connect account.
Triggered by a finance_manager or super_admin.

```typescript
// models/payout.model.ts

export interface IPayout extends Document {
  vendorId:               mongoose.Types.ObjectId     // ref: Vendor
  orders:                 mongoose.Types.ObjectId[]   // ref: Order[] — orders included in this payout
  amount:                 number     // total paid to vendor
  platformFeeCollected:   number     // total platform fees from these orders
  status:                 'pending' | 'processing' | 'completed' | 'failed'
  stripeTransferId?:      string     // Stripe transfer ID on success
  stripeConnectAccountId: string     // vendor's Stripe Custom Connect account
  failureReason?:         string
  processedBy:            mongoose.Types.ObjectId   // ref: User (finance_manager or super_admin)
  processedAt?:           Date
  createdAt:              Date
  updatedAt:              Date
}
```

---

### 4.12 Cart

One cart per user. Items are replaced on update, not accumulated.

```typescript
// models/cart.model.ts

export interface ICartItem {
  productId:  mongoose.Types.ObjectId   // ref: Product
  variantSku?: string
  quantity:   number
  price:      number                    // price at time of adding to cart
}

export interface ICart extends Document {
  userId:     mongoose.Types.ObjectId   // ref: User (unique — 1:1)
  items:      ICartItem[]
  couponCode?: string
  updatedAt:  Date
}
```

---

### 4.13 Notification

In-app notifications pushed via Socket.io on creation.

```typescript
// models/notification.model.ts

export interface INotification extends Document {
  userId:    mongoose.Types.ObjectId   // ref: User
  type:      'order_update' | 'payout' | 'review' | 'chat' | 'escrow' | 'loyalty' | 'system'
  title:     string
  body:      string
  isRead:    boolean
  link?:     string   // deep link to relevant page in frontend
  createdAt: Date
}
```

---

### 4.14 DailyStat

Pre-aggregated analytics. Written by a nightly cron job — never computed live.

```typescript
// models/dailyStat.model.ts

export interface IDailyStat extends Document {
  date:        Date
  vendorId?:   mongoose.Types.ObjectId   // ref: Vendor — null = platform-wide stat
  revenue:     number
  orders:      number
  newUsers:    number
  newVendors:  number
  topProducts: { productId: mongoose.Types.ObjectId; sales: number }[]
  createdAt:   Date
}
```

---

### 4.15 AuditLog

Immutable log of every sensitive action taken on the platform.
Written automatically by the audit service after any significant action.

```typescript
// models/auditLog.model.ts

export interface IAuditLog extends Document {
  actorId:    mongoose.Types.ObjectId   // ref: User — who performed the action
  actorRole:  string                    // their role at the time (stored in case role changes)
  action:     string                    // e.g. 'approved_vendor', 'triggered_payout', 'banned_user'
  entity:     string                    // e.g. 'Vendor', 'Order', 'User', 'Escrow'
  entityId:   mongoose.Types.ObjectId   // the document that was affected
  metadata?:  Record<string, unknown>   // before/after values, extra context
  ipAddress?: string
  userAgent?: string
  createdAt:  Date
}

// AuditLog is append-only — never updated or deleted.
// No updatedAt field intentionally.
// Examples of tracked actions:
//   Admin actions:  approved_vendor, rejected_vendor, suspended_user, banned_user,
//                   triggered_payout, resolved_dispute, created_admin, updated_ppp_region
//   Financial:      escrow_released, escrow_refunded, payout_completed, payout_failed
//   User actions:   password_reset, email_verified, account_deleted
```

---

### 4.16 Conversation

A chat thread between two parties. Works like a WhatsApp thread.
Can optionally reference a related order or product.

```typescript
// models/conversation.model.ts

export interface IConversation extends Document {
  participants:         mongoose.Types.ObjectId[]   // ref: User[] — exactly 2 for now
  type:                 'buyer_vendor' | 'support_user'
  relatedOrderId?:      mongoose.Types.ObjectId     // ref: Order — optional context
  relatedProductId?:    mongoose.Types.ObjectId     // ref: Product — optional context
  lastMessage?:         string                      // preview of last message
  lastMessageAt?:       Date                        // for sorting conversation list
  assignedSupportId?:   mongoose.Types.ObjectId     // ref: User — which support agent handles it
  isClosedBySupport:    boolean                     // support can close resolved threads
  createdAt:            Date
  updatedAt:            Date
}
```

---

### 4.17 Message

An individual message inside a Conversation.

```typescript
// models/message.model.ts

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId   // ref: Conversation
  senderId:       mongoose.Types.ObjectId   // ref: User
  body:           string
  replyTo?:       mongoose.Types.ObjectId   // ref: Message — WhatsApp-style reply quoting
  attachments:    string[]                  // S3 URLs (images, files)
  isRead:         boolean
  readAt?:        Date
  createdAt:      Date
}
```

---

### 4.18 PPPRegion

Maps countries to PPP discount percentages. Managed by super_admin.
Only applies to marketplace products (Product.isMarketplaceProduct === true).

```typescript
// models/pppRegion.model.ts

export interface IPPPRegion extends Document {
  country:         string   // e.g. "Nigeria"
  countryCode:     string   // ISO 3166-1 alpha-2, e.g. "NG"
  discountPercent: number   // 0–100. e.g. 60 = buyer pays 40% of original price
  isActive:        boolean
  createdAt:       Date
  updatedAt:       Date
}

// Examples:
// Nigeria  (NG) → 60% discount — buyer pays $40 on a $100 product
// India    (IN) → 55% discount — buyer pays $45 on a $100 product
// Brazil   (BR) → 50% discount — buyer pays $50 on a $100 product
// UK/US/EU      →  0% discount — buyer pays full price
//
// Region is detected from User.country (set from billing address, IP as fallback)
// PPP only applies to marketplace products — vendor products always sell at full price
```

---

### 4.19 LoyaltyTransaction

Tracks every point earn and redemption event for a user.
The current balance lives on User.loyaltyPoints. This model gives the full history.

```typescript
// models/loyaltyTransaction.model.ts

export interface ILoyaltyTransaction extends Document {
  userId:        mongoose.Types.ObjectId    // ref: User
  type:          'earned' | 'redeemed' | 'expired'
  points:        number                     // always positive — type describes direction
  source:        'purchase' | 'checkout_discount' | 'raffle_entry' | 'event' | 'expiry'
  orderId?:      mongoose.Types.ObjectId    // ref: Order — if earned/redeemed at checkout
  description:   string                     // human-readable e.g. "Earned from order VND-2026-00042"
  balanceBefore: number                     // User.loyaltyPoints before this transaction
  balanceAfter:  number                     // User.loyaltyPoints after this transaction
  createdAt:     Date
}

// Loyalty rules:
// - Points earned: 1 point per $1 spent (configurable)
// - Points expire: 12 months after last earn/redeem activity
// - Redemption: 100 points = $1 discount at checkout
// - Points expiry warning email: sent 30 days before expiry
// - Points cannot go negative
```

---

## 5. How the Schemas Connect

```
User
 ├── role: 'admin' → adminRole: 'super_admin' | 'vendor_manager' | ...
 ├── → Session           (activeSessionId on User matches Session.sessionId)
 ├── → Vendor            (when role === 'vendor')
 │     ├── → Product[]
 │     ├── → Payout[]
 │     └── → Review[]    (vendor is reviewed)
 ├── → Order[]           (as buyer)
 │     ├── → Escrow      (1:1 per order)
 │     └── → Review      (buyer leaves review after delivery)
 ├── → Cart              (1:1)
 ├── → LoyaltyTransaction[]
 ├── → Notification[]
 ├── → Conversation[]    (as participant)
 └── → AuditLog[]        (as actor — admin actions)

Product
 ├── → Vendor
 ├── → Category
 └── isMarketplaceProduct: true → PPPRegion applies at checkout

Order
 ├── → Escrow            (holds funds until release)
 ├── → CouponRedemption
 └── → LoyaltyTransaction (points earned on completion)

Conversation
 └── → Message[]
       └── replyTo → Message  (reply quoting)
```

---

## 6. Authentication & Single Device Login

Every login generates a UUID `sessionId`. This ID is stored in:
1. The JWT payload
2. `User.activeSessionId` (overwriting any previous value)
3. A new `Session` document

On every protected request:
```
Extract JWT → verify signature → extract sessionId
  → fetch User.activeSessionId from DB
  → compare: if mismatch → 401 "Session expired. You have logged in on another device."
  → if match → proceed
```

A new login on any device overwrites `User.activeSessionId`, instantly invalidating all
other devices. No token blacklist needed.

---

## 7. Role-Based Access Control

### Broad Roles (on every User)

| Role | Who | Access |
|---|---|---|
| `buyer` | Any registered user | Browse, cart, checkout, review, chat with vendors |
| `vendor` | Approved seller | Everything buyer can do + manage store, products, orders |
| `admin` | Platform staff | Determined by adminRole below |

### Admin Roles (only when role === 'admin')

| adminRole | Created by | What they can do |
|---|---|---|
| `super_admin` | System / self | Everything. Only role that can create other admin accounts |
| `vendor_manager` | super_admin | Approve/reject/suspend vendor applications and accounts |
| `order_manager` | super_admin | Handle order disputes, cancel orders, process refunds |
| `finance_manager` | super_admin | Trigger payouts, view financial reports, manage escrow releases |
| `content_manager` | super_admin | Manage categories, feature products, moderate reviews, manage PPP regions |
| `support` | super_admin | View users/orders/chats, cancel orders, issue refunds, resolve disputes, send messages |

### Middleware Stack

```
auth.middleware.ts     → verifies JWT + session (all protected routes)
role.middleware.ts     → checks req.user.role ('buyer', 'vendor', 'admin')
adminRole.middleware.ts → checks req.user.adminRole for fine-grained admin access
```

---

## 8. API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh-token
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/verify-email/:token
```

### User
```
GET    /api/users/me
PUT    /api/users/me
PUT    /api/users/me/password
POST   /api/users/me/addresses
PUT    /api/users/me/addresses/:id
DELETE /api/users/me/addresses/:id
GET    /api/users/me/wishlist
POST   /api/users/me/wishlist/:productId
DELETE /api/users/me/wishlist/:productId
GET    /api/users/me/loyalty
GET    /api/users/me/loyalty/transactions
```

### Vendor
```
POST   /api/vendors/apply              (buyer applies to become vendor)
GET    /api/vendors/:slug              (public store page)
PUT    /api/vendors/me                 (vendor updates their store)
POST   /api/vendors/me/bank-account    (attach bank account)
GET    /api/vendors/me/dashboard
GET    /api/vendors/me/orders
GET    /api/vendors/me/payouts
```

### Products
```
GET    /api/products                   (public listing with filters + pagination)
GET    /api/products/:slug             (public product detail)
POST   /api/products                   (vendor creates product)
PUT    /api/products/:id               (vendor updates product)
DELETE /api/products/:id               (vendor archives product)
POST   /api/products/:id/ai-description (AI generates description)
```

### Orders
```
POST   /api/orders/checkout            (buyer creates order + Stripe PaymentIntent)
GET    /api/orders/:id
GET    /api/orders/me                  (buyer's order history)
POST   /api/orders/:id/confirm-delivery (buyer confirms delivery → triggers escrow release)
POST   /api/orders/:id/dispute         (buyer raises a dispute)
```

### Cart
```
GET    /api/cart
POST   /api/cart/items
PUT    /api/cart/items/:productId
DELETE /api/cart/items/:productId
DELETE /api/cart
POST   /api/cart/coupon
DELETE /api/cart/coupon
```

### Reviews
```
POST   /api/reviews                    (buyer reviews after delivered order)
GET    /api/reviews/product/:productId
GET    /api/reviews/vendor/:vendorId
PUT    /api/reviews/:id
DELETE /api/reviews/:id
```

### Chat
```
GET    /api/chat/conversations
GET    /api/chat/conversations/:id
POST   /api/chat/conversations         (start a new conversation)
GET    /api/chat/conversations/:id/messages
POST   /api/chat/conversations/:id/messages
```

### Loyalty
```
GET    /api/loyalty                    (current balance + expiry)
GET    /api/loyalty/transactions
POST   /api/loyalty/redeem             (apply points at checkout)
```

### Admin
```
# User management
GET    /api/admin/users
GET    /api/admin/users/:id
PUT    /api/admin/users/:id/status     (suspend, ban, activate)
POST   /api/admin/users/create-admin   (super_admin only)

# Vendor management (vendor_manager)
GET    /api/admin/vendors
PUT    /api/admin/vendors/:id/approve
PUT    /api/admin/vendors/:id/reject
PUT    /api/admin/vendors/:id/suspend

# Order management (order_manager, support)
GET    /api/admin/orders
PUT    /api/admin/orders/:id/cancel
POST   /api/admin/orders/:id/refund

# Escrow & payouts (finance_manager)
GET    /api/admin/escrow
POST   /api/admin/escrow/:id/release
POST   /api/admin/escrow/:id/refund
GET    /api/admin/payouts
POST   /api/admin/payouts/trigger      (trigger payout for a vendor)

# PPP (content_manager, super_admin)
GET    /api/admin/ppp
POST   /api/admin/ppp
PUT    /api/admin/ppp/:id
DELETE /api/admin/ppp/:id

# Audit logs (super_admin)
GET    /api/admin/audit-logs

# Analytics
GET    /api/admin/analytics
```

### Stripe Webhooks
```
POST   /api/webhooks/stripe            (payment_intent.succeeded, transfer.created, etc.)
```

---

## 9. File Upload Flow (Amazon S3)

```
Client sends file (multipart/form-data)
  → multer (upload.middleware.ts) — reads file into memory buffer
  → s3.service.ts — uploads buffer to S3 with a unique key
  → returns the public S3 URL
  → controller stores URL in the relevant model field
```

File naming convention: `{folder}/{userId}-{timestamp}-{random}.{ext}`
Example: `products/64abc123-1711900000-x7k2.webp`

---

## 10. Stripe Connect & Escrow

### Setup (per vendor)

```
Vendor onboards
  → Platform calls Stripe API: stripe.accounts.create({ type: 'custom', ... })
  → Stripe returns a Connect account ID → stored as Vendor.stripeConnectAccountId
  → Vendor submits bank account details on Vendorly (not on Stripe directly)
  → Platform attaches bank account to the Connect account via Stripe API
  → Vendor.isStripeOnboarded = true
```

### Payment & Escrow Flow

```
Buyer checks out
  → stripe.service creates a PaymentIntent for the full order total
  → Buyer pays via Stripe (card details handled entirely by Stripe — PCI compliant)
  → Stripe webhook: payment_intent.succeeded fires
  → Order.paymentStatus = 'paid'
  → Escrow document created: { status: 'holding', amount: total }
  → Order.escrowStatus = 'holding'

Buyer confirms delivery (or 7-day auto-release)
  → escrow.service.release()
  → Stripe transfer: platform account → vendor's Connect account (vendorAmount)
  → Escrow.status = 'released', Escrow.stripeTransferId = transfer.id
  → Payout document created
  → Vendor.totalRevenue += vendorPayout
  → AuditLog entry written

Dispute raised
  → Escrow.status = 'disputed'
  → Support / order_manager reviews
  → Resolves as: release (vendor wins) or refund (buyer wins) or partially_refunded
  → Stripe Refund API called if buyer wins
  → AuditLog entry written with resolvedBy
```

### Platform Fee Calculation

```
Order total:          $100.00
Vendor on growth plan (7% fee):
  platformFee   =     $7.00
  vendorPayout  =    $93.00
```

---

## 11. Order & Payout State Machine

### Order Status Flow

```
pending → confirmed → processing → shipped → delivered → [closed]
                                          ↘ cancelled
                                          ↘ returned
```

### Escrow Status Flow

```
holding → released       (delivery confirmed or auto-release after 7 days)
        → refunded       (dispute: buyer wins)
        → disputed       → released / refunded / partially_refunded
```

### Payout Status Flow

```
pending → processing → completed
                    ↘ failed → (retry manually by finance_manager)
```

---

## 12. Purchasing Power Parity (PPP)

PPP reduces prices for buyers in lower-income regions. Only applies to **marketplace products**
(Product.isMarketplaceProduct === true). Vendor products always sell at the vendor's set price.

### How Region Is Detected

```
1. Check User.country (set from billing address on first purchase)
2. Fallback: detect from request IP address
3. Look up PPPRegion by countryCode
4. If no PPPRegion found or isActive = false → no discount applied
```

### Checkout Calculation

```
Marketplace product price:    $100.00
Buyer from Nigeria (60% PPP): discount = $60.00
Buyer pays:                   $40.00
Order.pppDiscount:            $60.00

The platform absorbs this discount — vendor always receives full vendor payout
based on the pre-PPP price. PPP comes out of the platform fee.
```

### PPP Management

Super_admin and content_manager can create, update, and deactivate PPP regions
via the admin dashboard. Every change is written to AuditLog.

---

## 13. In-App Chat & Socket.io

### Architecture

Socket.io runs on the same Node.js process, sharing the HTTP server.
Connections are authenticated using the same JWT as the REST API.

```
server.ts
  → creates HTTP server from Express app
  → attaches Socket.io to the same HTTP server
  → Socket.io auth middleware validates JWT on connection
```

### Chat Events

```
Client emits:
  join_conversation     { conversationId }
  send_message          { conversationId, body, replyTo?, attachments? }
  mark_read             { conversationId }
  typing                { conversationId }

Server emits:
  new_message           { message }         → all participants in room
  message_read          { conversationId }   → sender
  typing                { userId }           → other participant
  new_notification      { notification }     → specific user
```

### Conversation Types

| Type | Participants | Notes |
|---|---|---|
| `buyer_vendor` | buyer + vendor | Can be started before an order — general product/store chat |
| `support_user` | user + support agent | Assigned to a specific support agent |

Conversations are WhatsApp-style — participants can reply to any specific message
(replyTo field). Attachments (images, files) are uploaded to S3 first, URL sent in message.

---

## 14. Loyalty Points System

### Earning Points

```
Order status changes to 'delivered'
  → loyalty.service.earn(userId, orderTotal)
  → points = Math.floor(orderTotal * 1)   (1 point per $1 — configurable)
  → User.loyaltyPoints += points
  → User.pointsExpiresAt = now + 12 months
  → LoyaltyTransaction created { type: 'earned', source: 'purchase' }
  → Notification sent
```

### Redeeming Points

```
At checkout, buyer chooses to redeem points
  → loyalty.service.redeem(userId, pointsToRedeem)
  → discount = pointsToRedeem / 100   (100 points = $1)
  → applied as Order.couponDiscount (same mechanism as coupons)
  → User.loyaltyPoints -= pointsToRedeem
  → LoyaltyTransaction created { type: 'redeemed', source: 'checkout_discount' }
```

### Point Expiry

```
Daily cron job (loyaltyExpiry.job.ts)
  → finds users where pointsExpiresAt < now AND loyaltyPoints > 0
  → sets loyaltyPoints = 0
  → LoyaltyTransaction created { type: 'expired', source: 'expiry' }
  → email sent to user

30-day warning:
  → same job checks pointsExpiresAt < now + 30 days
  → sends warning email once (tracked with a flag to avoid repeat emails)
```

---

## 15. Audit Logs

Every sensitive action in the app writes an AuditLog entry via `audit.service.ts`.
The log is append-only — never modified or deleted.

### What Gets Logged

| Category | Actions |
|---|---|
| Admin — users | created_admin, suspended_user, banned_user, activated_user |
| Admin — vendors | approved_vendor, rejected_vendor, suspended_vendor |
| Admin — orders | cancelled_order, issued_refund |
| Admin — financial | triggered_payout, released_escrow, refunded_escrow |
| Admin — platform | updated_ppp_region, created_ppp_region, deleted_ppp_region |
| User | password_reset, email_verified, account_deleted |

### Usage in Code

```typescript
// In any service, after an action completes:
await audit.service.log({
  actorId:   req.user._id,
  actorRole: req.user.adminRole ?? req.user.role,
  action:    'approved_vendor',
  entity:    'Vendor',
  entityId:  vendor._id,
  metadata:  { previousStatus: 'pending', newStatus: 'active' },
  ipAddress: req.ip,
});
```

---

## 16. AI Integration Architecture

Anthropic Claude is used for:

1. **Product description generation** — vendor provides product name, category, bullet points;
   Claude writes a full marketing description. Product.aiGenerated is set to true.

2. **Review summarisation** — on a product page, Claude summarises the top reviews into a
   short paragraph. Generated on demand, not stored.

3. **Support chat assist** (future) — Claude suggests replies to support agents in the chat UI.

```typescript
// config/ai.ts
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

---

## 17. Analytics System

Analytics are **pre-aggregated** — never computed live on request.
A nightly cron job (dailyStats.job.ts) writes DailyStat documents.

```
Every night at 00:00 UTC:
  → aggregate Orders from the past day
  → compute revenue, order count, new users, new vendors
  → find top-selling products
  → write one DailyStat per vendor + one platform-wide DailyStat
```

Admin and vendor dashboards read from DailyStat — fast, no heavy aggregation at query time.

---

## 18. Error Handling Strategy

Every error response has this exact shape:

```json
{
  "success": false,
  "message": "Product not found",
  "statusCode": 404
}
```

Every success response:

```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": { ... },
  "pagination": {
    "total": 84,
    "page": 2,
    "limit": 10,
    "totalPages": 9,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

`pagination` is optional — only included on list responses.

### Flow

```typescript
// In any service:
throw new ApiError(404, "Product not found")

// Bubbles up to errorHandler.middleware.ts
// which formats it into the standard error shape above
```

Unexpected errors (DB crash, null reference) log the full error server-side
but return a generic "Something went wrong" message to the client —
never expose internal error details in production.

---

## 19. Environment Variables

```bash
# ── SERVER ───────────────────────────────────────────────────
NODE_ENV=development
PORT=5000

# ── MONGODB ──────────────────────────────────────────────────
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/vendorly

# ── JWT ──────────────────────────────────────────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_very_long_random_secret_here
JWT_EXPIRES_IN=30d

# ── AWS S3 ───────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=eu-west-1
AWS_BUCKET_NAME=vendorly-uploads

# ── STRIPE ───────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # from Stripe dashboard — validates webhook events

# ── ANTHROPIC AI ─────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── EMAIL ────────────────────────────────────────────────────
EMAIL_FROM=noreply@vendorly.com
SENDGRID_API_KEY=SG....

# ── FRONTEND ─────────────────────────────────────────────────
CLIENT_URL=http://localhost:3000
```

---

## Summary

| Item | Decision |
|---|---|
| Language | Node.js + TypeScript |
| Framework | Express.js + Socket.io |
| Database | MongoDB via Mongoose (19 collections) |
| Auth | JWT + UUID session ID for single device login |
| Admin roles | super_admin, vendor_manager, order_manager, finance_manager, content_manager, support |
| Payments | Stripe Custom Connect — platform controls all money |
| Escrow | Logical escrow via Stripe — funds held in platform account, released on delivery |
| Platform fee | 10% (starter) / 7% (growth) / 5% (pro) — deducted from vendor payout |
| File storage | Amazon S3 |
| PPP | Marketplace products only — country-based discount, absorbed by platform |
| Loyalty | 1 point/$1 spent, 100 points = $1 discount, expires after 12 months inactivity |
| Chat | Socket.io — buyer↔vendor + user↔support, WhatsApp-style with reply quoting |
| Audit logs | Append-only AuditLog — every admin/financial action tracked |
| AI | Anthropic Claude — product descriptions, review summarisation |
| Analytics | Pre-aggregated DailyStat via nightly cron job |
| Transactions | MongoDB sessions for all financial operations |

---

*Document version: 2.0 — March 2026*
*Frontend: Next.js 14 · TypeScript · Tailwind CSS (already built)*
*Backend: Node.js · Express · TypeScript · Mongoose · MongoDB · Amazon S3 · Stripe · Socket.io · Anthropic Claude*
