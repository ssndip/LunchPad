import { Router } from "express";
import {
  getProfiles,
  createProfile,
  getFixtures,
  saveFixture,
  exportAllProfiles,
  importBundle
} from "../controllers/parserController";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// Bulk Sync (Database Agnostic)
router.get("/export-all", requireAdmin, exportAllProfiles);
router.post("/import-bundle", requireAdmin, importBundle);

// Profiles
router.get("/profiles", requireAdmin, getProfiles);
router.post("/profiles", requireAdmin, createProfile);

// Fixtures
router.get("/fixtures", requireAdmin, getFixtures);
router.post("/fixtures", requireAdmin, saveFixture);

export default router;
