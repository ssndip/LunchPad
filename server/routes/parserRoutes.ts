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
import { requireAuth } from "../middleware/auth";

const router = Router();

// Bulk Sync (Database Agnostic)
router.get("/export-all", requireAuth, exportAllProfiles);
router.post("/import-bundle", requireAuth, importBundle);

// Profiles
router.get("/profiles", requireAuth, getProfiles);
router.post("/profiles", requireAuth, createProfile);
router.get("/profiles/:id/versions", requireAuth, getVersions);
router.post("/profiles/:id/publish", requireAuth, publishVersion);
router.post("/profiles/:id/activate", requireAuth, activateProfile);
router.post("/profiles/:id/duplicate", requireAuth, duplicateProfile);

// Fixtures
router.get("/fixtures", requireAuth, getFixtures);
router.post("/fixtures", requireAuth, saveFixture);

// Logs
router.get("/logs", requireAuth, getLogs);
router.post("/logs", requireAuth, saveLog);

export default router;
