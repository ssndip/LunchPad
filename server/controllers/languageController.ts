import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";
import { settings } from "../config";

export const getLanguages = (req: Request, res: Response) => {
  try {
    const customLangs = db.prepare("SELECT code, name FROM custom_languages").all() as { code: string, name: string }[];
    res.json({
      static: [
        { code: 'en', name: 'English' },
        { code: 'bg', name: 'Български' }
      ],
      custom: customLangs
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch languages" });
  }
};

export const getLanguageData = (req: Request, res: Response) => {
  const { code } = req.params;
  try {
    const lang = db.prepare("SELECT translations FROM custom_languages WHERE code = ?").get(code) as { translations: string } | undefined;
    if (!lang) return res.status(404).json({ error: "Language not found" });
    res.json(JSON.parse(lang.translations));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch language data" });
  }
};

export const importLanguage = (req: Request, res: Response) => {
  const { code, name, translations } = req.body;
  if (!code || !name || !translations) {
    return res.status(400).json({ error: "Missing code, name or translations" });
  }

  try {
    db.prepare("INSERT OR REPLACE INTO custom_languages (code, name, translations) VALUES (?, ?, ?)")
      .run(code, name, JSON.stringify(translations));
    
    broadcast({ type: "LANGUAGES_UPDATED" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to import language" });
  }
};

export const deleteLanguage = (req: Request, res: Response) => {
  const { code } = req.params;
  if (code === 'en' || code === 'bg') {
    return res.status(403).json({ error: "Cannot delete static languages" });
  }

  try {
    db.prepare("DELETE FROM custom_languages WHERE code = ?").run(code);
    
    // If the deleted language was active, fallback to English
    if (settings.systemLanguage === code) {
      settings.systemLanguage = 'en';
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run('system_language', 'en');
      broadcast({ type: "SETTINGS_UPDATE", settings: { systemLanguage: 'en' } });
    }

    broadcast({ type: "LANGUAGES_UPDATED" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete language" });
  }
};
