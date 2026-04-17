import express from "express";
import { getLanguages, getLanguageData, importLanguage, deleteLanguage } from "../controllers/languageController";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

// Publicly available (for initial state/select)
router.get("/", getLanguages);
router.get("/:code", getLanguageData);

// Admin only operations
router.post("/import", requireAuth, importLanguage);
router.delete("/:code", requireAuth, deleteLanguage);

export default router;
