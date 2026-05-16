import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { bodyMeasurementController } from "../controllers/bodyMeasurement.controller";

const router = Router();

router.use(authenticate);

router.get("/", (req, res, next) => bodyMeasurementController.list(req, res, next));
router.post("/", (req, res, next) => bodyMeasurementController.upsert(req, res, next));
router.delete("/:id", (req, res, next) => bodyMeasurementController.delete(req, res, next));

export default router;
