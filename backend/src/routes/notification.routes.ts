import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { notificationController } from "../controllers/notification.controller";

const router = Router();

router.use(authenticate);

router.get("/", (req, res, next) => notificationController.list(req, res, next));
router.delete("/", (req, res, next) => notificationController.clear(req, res, next));
router.patch("/:id/read", (req, res, next) => notificationController.markRead(req, res, next));

export default router;
