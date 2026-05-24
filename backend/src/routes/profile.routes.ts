import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { profileController } from "../controllers/profile.controller";

const router = Router();

router.use(authenticate);

router.get("/:userId", (req, res, next) => profileController.getPublicProfile(req, res, next));

export default router;
