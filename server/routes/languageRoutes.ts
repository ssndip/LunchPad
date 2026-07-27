import express from "express";
import { getLanguages, getLanguageData, importLanguage, deleteLanguage } from "../controllers/languageController";
import { requireAdmin } from "../middleware/auth";

const router = express.Router();

// Publicly available (for initial state/select)
router.get("/", getLanguages);
router.get("/:code", getLanguageData);

// Admin only operations
router.post("/import", requireAdmin, importLanguage);
router.delete("/:code", requireAdmin, deleteLanguage);

export default router;
