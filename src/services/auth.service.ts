import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { User } from "../models/user.model";
import { Session } from "../models/session.model";
import { ApiError } from "../utils/apiError";
import { RegisterInput, LoginInput } from "../types/auth.types";

// ─── PRIVATE HELPERS ──────────────────────────────────────────────────────────
// These are not exported — only used internally by this service.

// Signs a JWT with userId, sessionId, and role baked into the payload.
// Expires in 7 days — after that it is rejected even if the signature is valid.
const signToken = (userId: string, sessionId: string, role: string): string => {
  return jwt.sign(
    { userId, sessionId, role },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );
};

// Creates a Session document and updates User.activeSessionId.
// Called on both register and login — any time a new JWT is issued.
// Updating activeSessionId invalidates any previous session automatically.
const createSession = async (
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<string> => {
  const sessionId = randomUUID();

  // expiresAt must match the JWT expiry — 7 days from now
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await Session.create({ userId, sessionId, userAgent, ipAddress, expiresAt });

  // This single update invalidates any existing session for this user —
  // the auth middleware will reject tokens whose sessionId no longer matches this field
  await User.findByIdAndUpdate(userId, { activeSessionId: sessionId });

  return sessionId;
};

// ─── REGISTER ─────────────────────────────────────────────────────────────────

export const registerUser = async (input: RegisterInput) => {
  const { firstName, lastName, email, password, userAgent, ipAddress } = input;

  // 1. Reject if email is already taken
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists");
  }

  // 2. Hash the password — 12 salt rounds is the industry standard balance of security vs speed
  const hashedPassword = await bcrypt.hash(password, 12);

  // 3. Create the user
  const user = await User.create({ firstName, lastName, email, password: hashedPassword });

  // 4. Create a session — returns the sessionId to bake into the JWT
  const sessionId = await createSession(user._id.toString(), userAgent, ipAddress);

  // 5. Sign the JWT
  const token = signToken(user._id.toString(), sessionId, user.role);

  // 6. Return token and safe user data — never return the password field
  return {
    token,
    user: {
      id:        user._id,
      firstName: user.firstName,
      lastName:  user.lastName,
      email:     user.email,
      role:      user.role,
    },
  };
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────

export const loginUser = async (input: LoginInput) => {
  const { email, password, userAgent, ipAddress } = input;

  // 1. Find the user by email — include password field (it is select:false by default)
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    // Use a vague message — never tell the caller whether the email or password was wrong
    throw new ApiError(401, "Invalid email or password");
  }

  // 2. Check account status before doing anything else
  if (user.status === "banned") {
    throw new ApiError(403, "Your account has been permanently banned");
  }
  if (user.status === "suspended") {
    throw new ApiError(403, "Your account has been suspended. Please contact support");
  }

  // 3. Compare the submitted password against the stored hash
  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid email or password");
  }

  // 4. Create a new session — this invalidates any existing session (single device login)
  const sessionId = await createSession(user._id.toString(), userAgent, ipAddress);

  // 5. Sign a new JWT
  const token = signToken(user._id.toString(), sessionId, user.role);

  // 6. Return token and safe user data
  return {
    token,
    user: {
      id:        user._id,
      firstName: user.firstName,
      lastName:  user.lastName,
      email:     user.email,
      role:      user.role,
    },
  };
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

export const logoutUser = async (userId: string, sessionId: string) => {
  // Mark the session as inactive in the sessions collection
  await Session.findOneAndUpdate({ sessionId }, { isActive: false });

  // Clear activeSessionId on the user — any token still in circulation is now rejected
  await User.findByIdAndUpdate(userId, { activeSessionId: null });
};
