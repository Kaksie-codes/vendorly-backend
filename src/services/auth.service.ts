import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes, createHash } from "crypto";
import { User } from "../models/user.model";
import { Session } from "../models/session.model";
import { ApiError } from "../utils/apiError";
import { RegisterInput, LoginInput, ResetPasswordInput, ChangePasswordInput, OAuthLoginInput } from "../types/auth.types";
import { IUser } from "../models/user.model";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/email";

// ─── PRIVATE HELPERS ──────────────────────────────────────────────────────────
// These are not exported — only used internally by this service.

// Generates a secure random token, stores a SHA-256 hash of it on the user,
// and returns the raw token to embed in the email link.
//
// Why store the hash instead of the raw token?
// Same reason we hash passwords — if the DB is ever breached, an attacker
// can't use the leaked token to take over accounts.
// When the user submits the token from the email, we hash it again and compare.
const generateAndStoreToken = async (
  userId: string,
  type: "emailVerification" | "passwordReset"
): Promise<string> => {
  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  const expiry =
    type === "emailVerification"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      : new Date(Date.now() + 60 * 60 * 1000);      // 1 hour

  if (type === "emailVerification") {
    await User.findByIdAndUpdate(userId, {
      emailVerificationToken:   hashedToken,
      emailVerificationExpires: expiry,
    });
  } else {
    await User.findByIdAndUpdate(userId, {
      passwordResetToken:   hashedToken,
      passwordResetExpires: expiry,
    });
  }

  return rawToken;
};

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

  // 4. Send verification email — non-blocking, we don't await so it doesn't
  //    slow down the register response. If it fails, the user can request a resend.
  generateAndStoreToken(user._id.toString(), "emailVerification")
    .then((rawToken) => sendVerificationEmail(email, firstName, rawToken))
    .catch((err) => console.error("Failed to send verification email:", err));

  // 5. Create a session — returns the sessionId to bake into the JWT
  const sessionId = await createSession(user._id.toString(), userAgent, ipAddress);

  // 6. Sign the JWT
  const token = signToken(user._id.toString(), sessionId, user.role);

  // 7. Return token and safe user data — never return the password field
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
  //    OAuth users have no password — treat it as wrong credentials
  if (!user.password) throw new ApiError(401, "Invalid email or password");
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

// ─── RESEND VERIFICATION EMAIL ────────────────────────────────────────────────
// Called when a logged-in user hasn't verified yet and wants a fresh link.

export const resendVerificationEmail = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (user.isEmailVerified) throw new ApiError(400, "Your email is already verified");

  const rawToken = await generateAndStoreToken(userId, "emailVerification");
  await sendVerificationEmail(user.email, user.firstName, rawToken);
};

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────
// The user clicks the link in their email — the frontend extracts the token
// from the URL and calls this endpoint.

export const verifyEmail = async (token: string) => {
  // Hash the raw token from the URL to match what we stored in the DB
  const hashedToken = createHash("sha256").update(token).digest("hex");

  // Find the user who owns this token AND whose token hasn't expired yet
  // We need to explicitly select these fields because they are select:false
  const user = await User.findOne({
    emailVerificationToken:   hashedToken,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationToken +emailVerificationExpires");

  if (!user) {
    throw new ApiError(400, "Verification link is invalid or has expired");
  }

  // Mark as verified and wipe the token fields — they're single-use
  user.isEmailVerified          = true;
  user.emailVerificationToken   = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
// User submits their email. We generate a reset token and email them a link.
// Important: we always return success even if the email doesn't exist in our DB.
// This prevents "email enumeration" — an attacker probing which emails are registered.

export const forgotPassword = async (email: string) => {
  const user = await User.findOne({ email });

  // Silently return if no account — the controller will still send a 200
  if (!user) return;

  const rawToken = await generateAndStoreToken(user._id.toString(), "passwordReset");
  await sendPasswordResetEmail(user.email, user.firstName, rawToken);
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
// User submits the token from the email + their new password.

export const resetPassword = async ({ token, newPassword }: ResetPasswordInput) => {
  const hashedToken = createHash("sha256").update(token).digest("hex");

  // Find user by hashed token — must not be expired
  // +password is needed so we can compare against the current password below
  const user = await User.findOne({
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select("+password +passwordResetToken +passwordResetExpires");

  if (!user) {
    throw new ApiError(400, "Reset link is invalid or has expired");
  }

  // Reject if the new password is the same as the current one
  const isSamePassword = await bcrypt.compare(newPassword, user.password!);
  if (isSamePassword) {
    throw new ApiError(400, "New password must be different from your current password");
  }

  // Hash and save the new password
  user.password            = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Invalidate all active sessions — forces the user to log in fresh with new password.
  // This also protects against an attacker who may have had an active session.
  await Session.updateMany({ userId: user._id }, { isActive: false });
  await User.findByIdAndUpdate(user._id, { activeSessionId: null });
};

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
// For logged-in users who know their current password and want to change it.
// Different from resetPassword which uses a token for users who forgot theirs.

export const changePassword = async ({ userId, currentPassword, newPassword }: ChangePasswordInput) => {
  // Fetch user with password — it is select:false by default
  const user = await User.findById(userId).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  // OAuth users signed in via Google/GitHub/etc. — they have no password to change
  if (user.authProvider !== "local") {
    const name = user.authProvider.charAt(0).toUpperCase() + user.authProvider.slice(1);
    throw new ApiError(400, `Your account uses ${name} sign-in. Password change is not available.`);
  }

  // Verify the current password is correct
  const isCorrect = await bcrypt.compare(currentPassword, user.password!);
  if (!isCorrect) {
    throw new ApiError(401, "Current password is incorrect");
  }

  // Reject if new password is the same as the current one
  const isSame = await bcrypt.compare(newPassword, user.password!);
  if (isSame) {
    throw new ApiError(400, "New password must be different from your current password");
  }

  // Hash and save the new password
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  // Invalidate all sessions — user must log in again with the new password
  await Session.updateMany({ userId: user._id }, { isActive: false });
  await User.findByIdAndUpdate(user._id, { activeSessionId: null });
};

// ─── OAUTH LOGIN ──────────────────────────────────────────────────────────────
// Used by all OAuth strategies (Google, GitHub, Facebook, Twitter).
// Finds an existing user or creates a new one. Returns the User document.
// Throws ApiError if the email is already registered under a different provider.

export const oauthLogin = async (input: OAuthLoginInput): Promise<IUser> => {
  const { provider, providerId, email, firstName, lastName, avatar } = input;

  // 1. Check if we have seen this exact provider+ID before — fastest path (returning user)
  const existingByProvider = await User.findOne({ authProvider: provider, providerId })
    .select("+providerId");
  if (existingByProvider) {
    if (existingByProvider.status === "banned")     throw new ApiError(403, "Your account has been permanently banned");
    if (existingByProvider.status === "suspended")  throw new ApiError(403, "Your account has been suspended. Please contact support");
    return existingByProvider;
  }

  // 2. Check if this email already exists under a different provider
  const existingByEmail = await User.findOne({ email });
  if (existingByEmail) {
    const registered = existingByEmail.authProvider;
    const name = registered.charAt(0).toUpperCase() + registered.slice(1);
    throw new ApiError(409, `You registered with ${name}. Please sign in with ${name}.`);
  }

  // 3. Brand new user — create account
  // isEmailVerified is set to true because the OAuth provider already verified the email
  const user = await User.create({
    firstName,
    lastName,
    email,
    authProvider: provider,
    providerId,
    avatar,
    isEmailVerified: true,
  });

  return user;
};

// ─── ISSUE TOKEN FOR USER ─────────────────────────────────────────────────────
// Creates a session and signs a JWT. Used by OAuth callback controllers
// after passport has found/created the user.

export const issueTokenForUser = async (
  userId:     string,
  role:       string,
  userAgent?: string,
  ipAddress?: string
): Promise<string> => {
  const sessionId = await createSession(userId, userAgent, ipAddress);
  return signToken(userId, sessionId, role);
};
