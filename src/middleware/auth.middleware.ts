import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { ApiError } from "../utils/apiError";
import { JwtPayload } from "../types/auth.types";

// Extend Express's Request type so TypeScript knows req.user exists
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// ─── PROTECT ──────────────────────────────────────────────────────────────────
// Attach this middleware to any route that requires the user to be logged in.
// It verifies the JWT, checks the sessionId, fetches the user, and sets req.user.

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Extract the token from the Authorization header
    // The client sends: "Authorization: Bearer eyJhbGci..."
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Not authenticated. Please log in.");
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify the JWT signature — pure math, no DB query
    // If the token is expired or tampered with, jwt.verify() throws an error
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    } catch {
      throw new ApiError(401, "Invalid or expired token. Please log in again.");
    }

    // 3. Fetch the user — we need activeSessionId (select: false) so we must explicitly select it
    const user = await User.findById(decoded.userId).select("+activeSessionId");
    if (!user) {
      throw new ApiError(401, "The account belonging to this token no longer exists.");
    }

    // 4. Check account status
    if (user.status === "banned" || user.status === "suspended") {
      throw new ApiError(403, "Your account has been suspended. Please contact support.");
    }

    // 5. Compare sessionId from the JWT payload against the user's activeSessionId
    // If they don't match, this token is from an old session (logged out, or logged in elsewhere)
    if (user.activeSessionId !== decoded.sessionId) {
      throw new ApiError(401, "Session is no longer valid. Please log in again.");
    }

    // 6. Attach user data to req.user so controllers can access it without another DB query
    req.user = {
      id:        user._id.toString(),
      sessionId: decoded.sessionId,
      firstName: user.firstName,
      lastName:  user.lastName,
      email:     user.email,
      role:      user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
