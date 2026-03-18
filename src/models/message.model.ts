import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;  // ref: Conversation
  senderId:       mongoose.Types.ObjectId;  // ref: User
  body:           string;
  replyTo?:       mongoose.Types.ObjectId;  // ref: Message — WhatsApp-style reply quoting
  attachments:    string[];                 // S3 URLs (images, documents)
  isRead:         boolean;
  readAt?:        Date;
  createdAt:      Date;
  // No updatedAt — messages are not editable after sending
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId:       { type: Schema.Types.ObjectId, ref: "User",         required: true },
    body:           { type: String, required: true, trim: true },

    // Self-referencing — points to another Message in the same collection.
    // When the frontend renders this, it fetches the referenced message
    // and displays it as a quoted block above the new message.
    replyTo:     { type: Schema.Types.ObjectId, ref: "Message" },
    attachments: [{ type: String }],

    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
// The main query: "give me all messages in conversation X, ordered oldest to newest"
MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ senderId: 1 });

// Quickly count unread messages per conversation for the badge count
MessageSchema.index({ conversationId: 1, isRead: 1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Message = mongoose.model<IMessage>("Message", MessageSchema);
