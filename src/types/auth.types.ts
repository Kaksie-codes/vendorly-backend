// ─── AUTH TYPES ───────────────────────────────────────────────────────────────
// All input shapes and return types used across auth service, controller, and middleware.

export interface RegisterInput {
  firstName: string;
  lastName:  string;
  email:     string;
  password:  string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginInput {
  email:      string;
  password:   string;
  userAgent?: string;
  ipAddress?: string;
}

// Shape of the decoded JWT payload after verification
export interface JwtPayload {
  userId:    string;
  sessionId: string;
  role:      string;
}
