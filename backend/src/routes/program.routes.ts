// ─────────────────────────────────────────────
// Program Routes
// ─────────────────────────────────────────────
import { Router } from "express";
import { programController } from "../controllers/program.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Public routes
router.get("/public", (req, res, next) => programController.listPublic(req, res, next));

// Protected routes (require authentication)
router.use(authenticate);

router.post("/", (req, res, next) => programController.create(req, res, next));
router.get("/community", (req, res, next) => programController.listCommunity(req, res, next));
router.get("/mine", (req, res, next) => programController.listMine(req, res, next));
router.patch("/:id/visibility", (req, res, next) =>
    programController.toggleVisibility(req, res, next),
);
router.patch("/:id/advance-day", (req, res, next) =>
    programController.advanceDay(req, res, next),
);
router.patch("/:id/day", (req, res, next) =>
    programController.setDay(req, res, next),
);
router.post("/:id/star", (req, res, next) => programController.star(req, res, next));
router.delete("/:id/star", (req, res, next) => programController.unstar(req, res, next));
router.post("/:id/copy", (req, res, next) => programController.copy(req, res, next));
router.get("/suggest/:exerciseName", (req, res, next) =>
    programController.suggestWeight(req, res, next),
);
router.put("/:id", (req, res, next) => programController.update(req, res, next));
router.delete("/:id", (req, res, next) => programController.delete(req, res, next));
router.get("/:id", (req, res, next) => programController.getById(req, res, next));

export default router;
