import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { moderationController } from "../controllers/moderation.controller";

const router = Router();

router.use(authenticate);

router.get("/blocks", (req, res, next) => moderationController.listBlocks(req, res, next));
router.post("/reports", (req, res, next) => moderationController.report(req, res, next));
router.post("/blocks", (req, res, next) => moderationController.block(req, res, next));
router.delete("/blocks/:userId", (req, res, next) => moderationController.unblock(req, res, next));

export default router;
