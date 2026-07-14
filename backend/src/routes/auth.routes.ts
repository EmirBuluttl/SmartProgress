// ─────────────────────────────────────────────
// Auth Routes
// ─────────────────────────────────────────────
import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Public routes
router.post("/register", (req, res, next) => authController.register(req, res, next));
router.post("/login", (req, res, next) => authController.login(req, res, next));
router.post("/social/google", (req, res, next) => authController.loginWithGoogle(req, res, next));
router.post("/social/apple", (req, res, next) => authController.loginWithApple(req, res, next));
router.post("/forgot-password", (req, res, next) => authController.forgotPassword(req, res, next));
router.post("/reset-password", (req, res, next) => authController.resetPassword(req, res, next));

// Protected routes
router.get("/me", authenticate, (req, res, next) => authController.me(req, res, next));
router.patch("/me", authenticate, (req, res, next) => authController.updateProfile(req, res, next));
router.post("/sync-entitlements", authenticate, (req, res, next) => authController.syncEntitlements(req, res, next));
router.delete("/me", authenticate, (req, res, next) => authController.deleteAccount(req, res, next));

export default router;

