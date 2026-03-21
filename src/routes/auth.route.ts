import { Router } from "express";
import { register, login, logout, getMe } from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// Public routes — no authentication required
router.post("/register", register);
router.post("/login",    login);

// Protected routes — user must be logged in (protect middleware runs first)
router.post("/logout", protect, logout);
router.get("/me",      protect, getMe);

export default router;
