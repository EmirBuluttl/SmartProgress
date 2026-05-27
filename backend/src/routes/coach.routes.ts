import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { coachController } from "../controllers/coach.controller";

const router = Router();

router.use(authenticate);

router.get("/weekly-report", (req, res, next) => coachController.weeklyReport(req, res, next));
router.get("/insights", (req, res, next) => coachController.insights(req, res, next));
router.get("/ai-status", (req, res, next) => coachController.aiStatus(req, res, next));
router.get("/ai-messages", (req, res, next) => coachController.aiMessages(req, res, next));
router.post("/ask", (req, res, next) => coachController.ask(req, res, next));

export default router;
