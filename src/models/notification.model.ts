import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
export interface INotification extends Document {
  userId:    mongoose.Types.ObjectId;  // ref: User — who receives this notification
  type:      "order_update" | "payout" | "review" | "chat" | "escrow" | "loyalty" | "system";
  title:     string;
  body:      string;
  isRead:    boolean;
  link?:     string;   // deep link to the relevant page on the frontend
                       // e.g. "/orders/VND-2026-00042" or "/chat/conv_id"
  createdAt: Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: ["order_update", "payout", "review", "chat", "escrow", "loyalty", "system"],
      required: true,
    },

    title:  { type: String, required: true },
    body:   { type: String, required: true },
    isRead: { type: Boolean, default: false },
    link:   { type: String },
  },
  {
    // Only createdAt needed — notifications are never updated, only read or deleted
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
NotificationSchema.index({ userId: 1, isRead: 1 });  // fetch unread notifications quickly
NotificationSchema.index({ userId: 1, createdAt: -1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
