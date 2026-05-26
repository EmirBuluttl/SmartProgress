import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { coachController } from "../controllers/coach.controller";

const router = Router();

router.use(authenticate);

router.get("/weekly-report", (req, res, next) => coachController.weeklyReport(req, res, next));

export default router;
