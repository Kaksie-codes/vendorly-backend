import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
export interface IConversation extends Document {
  participants:        mongoose.Types.ObjectId[];  // ref: User[] — always exactly 2
  type:                "buyer_vendor" | "support_user";
  relatedOrderId?:     mongoose.Types.ObjectId;    // ref: Order — optional context
  relatedProductId?:   mongoose.Types.ObjectId;    // ref: Product — optional context
  lastMessage?:        string;                     // preview text shown in conversation list
  lastMessageAt?:      Date;                       // used to sort conversations (newest first)
  assignedSupportId?:  mongoose.Types.ObjectId;    // ref: User — which support agent handles it
  isClosedBySupport:   boolean;                    // support can close a resolved thread
  createdAt:           Date;
  updatedAt:           Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const ConversationSchema = new Schema<IConversation>(
  {
    // Always 2 participants — stored as an array so we can query
    // "all conversations where this userId is a participant"
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],

    type: {
      type:     String,
      enum:     ["buyer_vendor", "support_user"],
      required: true,
    },

    relatedOrderId:   { type: Schema.Types.ObjectId, ref: "Order" },
    relatedProductId: { type: Schema.Types.ObjectId, ref: "Product" },

    lastMessage:   { type: String },
    lastMessageAt: { type: Date },

    assignedSupportId: { type: Schema.Types.ObjectId, ref: "User" },
    isClosedBySupport: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
// The main query: "give me all conversations this user is part of"
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });  // sort conversations by most recent message
ConversationSchema.index({ assignedSupportId: 1 });

// Prevent duplicate conversations between the same two users
// (buyer and vendor can only have one thread, not multiple)
ConversationSchema.index({ participants: 1, type: 1 }, { unique: true });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Conversation = mongoose.model<IConversation>("Conversation", ConversationSchema);
