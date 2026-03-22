import { Request, Response, NextFunction } from "express";
import passport from "passport";
import {
  registerUser,
  loginUser,
  logoutUser,
  resendVerificationEmail,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  issueTokenForUser,
} from "../services/auth.service";
import { IUser } from "../models/user.model";
import { sendResponse } from "../utils/apiResponse";

// ─── REGISTER ─────────────────────────────────────────────────────────────────
// POST /api/auth/register
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const result = await registerUser({
      firstName,
      lastName,
      email,
      password,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    sendResponse(res, 201, "Account created successfully", result);
  } catch (error) {
    next(error);
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const result = await loginUser({
      email,
      password,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    sendResponse(res, 200, "Logged in successfully", result);
  } catch (error) {
    next(error);
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
// POST /api/auth/logout
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.user is attached by the auth middleware — the user must be logged in to logout
    const { id, sessionId } = req.user as { id: string; sessionId: string };

    await logoutUser(id, sessionId);

    sendResponse(res, 200, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

// ─── ME ───────────────────────────────────────────────────────────────────────
// GET /api/auth/me
export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.user is already attached by the auth middleware — no extra DB query needed
    sendResponse(res, 200, "User fetched successfully", req.user);
  } catch (error) {
    next(error);
  }
};

// ─── RESEND VERIFICATION EMAIL ────────────────────────────────────────────────
// POST /api/auth/resend-verification
export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.user as { id: string };
    await resendVerificationEmail(id);
    sendResponse(res, 200, "Verification email sent — please check your inbox");
  } catch (error) {
    next(error);
  }
};

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────
// GET /api/auth/verify-email/:token
export const verifyEmailHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    await verifyEmail(token);
    sendResponse(res, 200, "Email verified successfully");
  } catch (error) {
    next(error);
  }
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
export const forgotPasswordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    await forgotPassword(email);
    // Always respond with the same message regardless of whether the email exists
    sendResponse(res, 200, "If an account with that email exists, a reset link has been sent");
  } catch (error) {
    next(error);
  }
};

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
// POST /api/auth/change-password
export const changePasswordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.user as { id: string };
    const { currentPassword, newPassword } = req.body;

    await changePassword({ userId: id, currentPassword, newPassword });

    sendResponse(res, 200, "Password changed successfully. Please log in again with your new password");
  } catch (error) {
    next(error);
  }
};

// ─── OAUTH CALLBACK ───────────────────────────────────────────────────────────
// GET /api/auth/:provider/callback
//
// Factory function — returns a callback route handler for any OAuth provider.
// Called after the user approves the OAuth consent screen and the provider
// redirects back to us.
//
// On success → redirect to frontend with JWT as a query parameter
// On failure → redirect to frontend with the error message
//
// Why a factory? Because all 4 providers (Google, GitHub, Facebook, Twitter)
// use exactly the same logic — only the provider name differs.
export const oauthCallbackHandler = (provider: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    // We use the custom callback form of passport.authenticate so we can
    // control the redirect ourselves instead of relying on successRedirect/failureRedirect.
    passport.authenticate(
      provider,
      { session: false },
      async (err: Error | null, user: IUser | false, info: { message?: string } | undefined) => {
        // Unexpected server error (DB down, network issue, etc.)
        if (err) return next(err);

        // Known failure (wrong provider, email not shared, etc.)
        if (!user) {
          const message = encodeURIComponent(info?.message ?? "Authentication failed");
          return res.redirect(`${process.env.CLIENT_URL}/auth/error?message=${message}`);
        }

        try {
          // Create a session and sign a JWT for the user
          const token = await issueTokenForUser(
            user._id.toString(),
            user.role,
            req.headers["user-agent"],
            req.ip
          );

          // Redirect to the frontend — the frontend reads the token from the URL
          // and stores it (e.g. in localStorage) to use for future API calls
          res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${encodeURIComponent(token)}`);
        } catch (error) {
          next(error);
        }
      }
    )(req, res, next);
  };

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
// POST /api/auth/reset-password/:token
export const resetPasswordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    await resetPassword({ token, newPassword });
    sendResponse(res, 200, "Password reset successfully. Please log in with your new password");
  } catch (error) {
    next(error);
  }
};
