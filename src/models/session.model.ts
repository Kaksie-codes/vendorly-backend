import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;   // which user this session belongs to
  sessionId: string;                 // UUID — stored in the JWT and on User.activeSessionId
  userAgent?: string;                // browser/device info (e.g. "Chrome on Windows")
  ipAddress?: string;                // IP address at login time
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const SessionSchema = new Schema<ISession>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: String, required: true, unique: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    isActive:  { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
SessionSchema.index({ userId: 1 });
SessionSchema.index({ sessionId: 1 });

// TTL (Time To Live) index — MongoDB automatically deletes a session document
// once its expiresAt date has passed. No cron job or manual cleanup needed.
// expireAfterSeconds: 0 means "delete exactly at the expiresAt time".
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const Session = mongoose.model<ISession>("Session", SessionSchema);
