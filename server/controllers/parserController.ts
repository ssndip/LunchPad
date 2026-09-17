import { Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { ParserConfig, ParserProfile, ParserVersion, ParserFixture } from '../../src/types/parserConfig';

// --- Profiles ---

export const getProfiles = (req: Request, res: Response) => {
  try {
    const profiles = db.prepare("SELECT * FROM parser_profiles").all() as ParserProfile[];
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
};

export const createProfile = (req: Request, res: Response) => {
  const { name, description, config } = req.body;
  const id = uuidv4();
  const versionId = uuidv4();

  try {
    const transaction = db.transaction(() => {
      db.prepare("INSERT INTO parser_profiles (id, name, description, status, isActive) VALUES (?, ?, ?, 'draft', 0)")
        .run(id, name, description);
      
      db.prepare("INSERT INTO parser_versions (id, profileId, versionNumber, configJson, changeNote, createdAt) VALUES (?, ?, 1, ?, 'Initial version', ?)")
        .run(versionId, id, JSON.stringify(config), new Date().toISOString());
    });
    
    transaction();
    res.json({ id, versionId });
  } catch (err) {
    res.status(500).json({ error: "Failed to create profile" });
  }
};

// --- Fixtures ---

export const getFixtures = (req: Request, res: Response) => {
  try {
    const fixtures = db.prepare("SELECT * FROM parser_fixtures ORDER BY createdAt DESC").all() as ParserFixture[];
    res.json(fixtures);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch fixtures" });
  }
};

export const saveFixture = (req: Request, res: Response) => {
  const { name, rawInput, expectedOutputJson } = req.body;
  const id = uuidv4();
  try {
    db.prepare("INSERT INTO parser_fixtures (id, name, rawInput, expectedOutputJson, createdAt) VALUES (?, ?, ?, ?, ?)")
      .run(id, name, rawInput, JSON.stringify(expectedOutputJson || {}), new Date().toISOString());
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: "Failed to save fixture" });
  }
};

// --- Logs ---

// --- Bulk Sync (Database Agnostic) ---

export const exportAllProfiles = (req: Request, res: Response) => {
  try {
    const profilesWithConfig = db.prepare(`
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.isActive, 
        v.configJson
      FROM parser_profiles p
      LEFT JOIN parser_versions v ON v.profileId = p.id
        AND v.versionNumber = (
          SELECT MAX(versionNumber) 
          FROM parser_versions 
          WHERE profileId = p.id
        )
    `).all() as any[];

    const bundle = {
      version: "1.0",
      type: "LUNCHPAD_PARSER_BUNDLE",
      exportedAt: new Date().toISOString(),
      profiles: profilesWithConfig.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        isActive: p.isActive,
        config: p.configJson ? JSON.parse(p.configJson) : {}
      }))
    };
    res.json(bundle);
  } catch (err) {
    res.status(500).json({ error: "Failed to export bundle" });
  }
};

export const importBundle = (req: Request, res: Response) => {
  const bundle = req.body;
  if (!bundle || bundle.type !== "LUNCHPAD_PARSER_BUNDLE") {
    return res.status(400).json({ error: "Invalid bundle format" });
  }

  try {
    const transaction = db.transaction(() => {
      for (const p of bundle.profiles) {
        // Upsert profile
        const exists = db.prepare("SELECT id FROM parser_profiles WHERE id = ?").get(p.id);
        if (exists) {
          db.prepare("UPDATE parser_profiles SET name = ?, description = ? WHERE id = ?")
            .run(p.name, p.description, p.id);
        } else {
          db.prepare("INSERT INTO parser_profiles (id, name, description, status, isActive) VALUES (?, ?, ?, 'published', 0)")
            .run(p.id, p.name, p.description);
        }

        // Add a new version with the imported config
        const row = db.prepare("SELECT MAX(versionNumber) as maxV FROM parser_versions WHERE profileId = ?").get(p.id) as { maxV: number };
        const nextV = (row.maxV || 0) + 1;
        const versionId = uuidv4();
        
        db.prepare("INSERT INTO parser_versions (id, profileId, versionNumber, configJson, changeNote, createdAt) VALUES (?, ?, ?, ?, ?, ?)")
          .run(versionId, p.id, nextV, JSON.stringify(p.config), `Imported via Bundle v${bundle.version}`, new Date().toISOString());
      }
    });

    transaction();
    res.json({ success: true, count: bundle.profiles.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to import bundle" });
  }
};
