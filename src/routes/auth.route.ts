import { Router } from "express";
import passport from "passport";
import {
  register,
  login,
  logout,
  getMe,
  resendVerification,
  verifyEmailHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  changePasswordHandler,
  oauthCallbackHandler,
} from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────
router.post("/register", register);
router.post("/login",    login);

// Email verification — token comes from the link the user clicked in their email
router.get("/verify-email/:token", verifyEmailHandler);

// Password reset flow — two steps: request a link, then submit new password
router.post("/forgot-password",          forgotPasswordHandler);
router.post("/reset-password/:token",    resetPasswordHandler);

// ─── OAUTH ROUTES ─────────────────────────────────────────────────────────────
// Each provider has two routes:
//   1. Initiate  — redirects the user to the provider's consent screen
//   2. Callback  — the provider redirects back here after the user approves

// Google
router.get("/google",          passport.authenticate("google",   { session: false, scope: ["profile", "email"], prompt: "select_account" }));
router.get("/google/callback", oauthCallbackHandler("google"));

// GitHub
router.get("/github",          passport.authenticate("github",   { session: false, scope: ["user:email"] }));
router.get("/github/callback", oauthCallbackHandler("github"));


// ─── PROTECTED ROUTES ─────────────────────────────────────────────────────────
// User must be logged in (protect middleware runs first)
router.post("/logout",              protect, logout);
router.get("/me",                   protect, getMe);
router.post("/resend-verification", protect, resendVerification);
router.post("/change-password",     protect, changePasswordHandler);

export default router;
