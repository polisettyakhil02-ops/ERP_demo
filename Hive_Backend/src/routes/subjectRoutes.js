// routes/subjectRoutes.js
import { Router } from "express";
import {
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  toggleSubjectBranch,
} from "../controllers/subjectController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", listSubjects);
router.post("/", createSubject);
router.put("/:id", updateSubject);
// Adding a subject to a branch / taking it off again. Separate from the
// PUT above on purpose: `branches` is the one field with a per-branch
// permission check behind it, so it doesn't share an endpoint with the
// plain catalog fields.
router.put("/:id/branch", toggleSubjectBranch);
router.delete("/:id", deleteSubject);

export default router;
