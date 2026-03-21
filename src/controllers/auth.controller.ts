import { Request, Response, NextFunction } from "express";
import { registerUser, loginUser, logoutUser } from "../services/auth.service";
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
