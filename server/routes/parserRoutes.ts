import { Router } from "express";
import { 
  getProfiles, 
  createProfile, 
  publishVersion, 
  activateProfile, 
  getVersions, 
  getFixtures, 
  saveFixture, 
  getLogs,
  saveLog,
  duplicateProfile,
  exportAllProfiles,
  importBundle
} from "../controllers/parserController";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

// Bulk Sync (Database Agnostic)
router.get("/export-all", requireAdmin, exportAllProfiles);
router.post("/import-bundle", requireAdmin, importBundle);

// Profiles
router.get("/profiles", requireAdmin, getProfiles);
router.post("/profiles", requireAdmin, createProfile);
router.get("/profiles/:id/versions", requireAdmin, getVersions);
router.post("/profiles/:id/publish", requireAdmin, publishVersion);
router.post("/profiles/:id/activate", requireAdmin, activateProfile);
router.post("/profiles/:id/duplicate", requireAdmin, duplicateProfile);

// Fixtures
router.get("/fixtures", requireAdmin, getFixtures);
router.post("/fixtures", requireAdmin, saveFixture);

// Logs
router.get("/logs", requireAdmin, getLogs);
router.post("/logs", requireAdmin, saveLog);

export default router;
