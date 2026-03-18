import mongoose, { Schema, Document } from "mongoose";

// ─── INTERFACE ────────────────────────────────────────────────────────────────
// AuditLog is append-only — records are never updated or deleted.
// Every sensitive admin or financial action in the app writes one entry here.
// If two admins have the same role, this tells you exactly which one did what.
export interface IAuditLog extends Document {
  actorId:    mongoose.Types.ObjectId;  // ref: User — who performed the action
  actorRole:  string;                   // their role at the time (stored here because roles can change)
  action:     string;                   // what happened e.g. "approved_vendor", "released_escrow"
  entity:     string;                   // what collection was affected e.g. "Vendor", "Order"
  entityId:   mongoose.Types.ObjectId;  // the specific document that was affected
  metadata?:  Record<string, unknown>;  // extra context e.g. { before: "pending", after: "active" }
  ipAddress?: string;
  userAgent?: string;
  createdAt:  Date;
  // No updatedAt — audit logs must never be modified
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, required: true },
    action:    { type: String, required: true },
    entity:    { type: String, required: true },
    entityId:  { type: Schema.Types.ObjectId, required: true },
    metadata:  { type: Schema.Types.Mixed },  // Mixed = any shape — flexible for different actions
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
AuditLogSchema.index({ actorId: 1 });           // "show me everything admin X did"
AuditLogSchema.index({ entity: 1, entityId: 1 });// "show me the full history of this vendor/order"
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ createdAt: -1 });

// ─── MODEL ────────────────────────────────────────────────────────────────────
export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
