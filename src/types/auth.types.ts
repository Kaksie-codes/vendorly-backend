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

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token:       string;
  newPassword: string;
}

export interface ChangePasswordInput {
  userId:          string;
  currentPassword: string;
  newPassword:     string;
}

export interface OAuthLoginInput {
  provider:   "google" | "github" | "facebook" | "twitter";
  providerId: string;
  email:      string;
  firstName:  string;
  lastName:   string;
  avatar?:    string;
}

// Shape of the decoded JWT payload after verification
export interface JwtPayload {
  userId:    string;
  sessionId: string;
  role:      string;
}
