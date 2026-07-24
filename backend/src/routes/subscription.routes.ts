import { Router } from "express";
import { subscriptionController } from "../controllers/subscription.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.use(authenticate);
router.post("/trial/start", (req, res, next) => subscriptionController.startPremiumTrial(req, res, next));

export default router;
