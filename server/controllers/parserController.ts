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

export const publishVersion = (req: Request, res: Response) => {
  const { id } = req.params; // profileId
  const { config, changeNote } = req.body;
  const versionId = uuidv4();

  try {
    const transaction = db.transaction(() => {
      // Get current max version
      const row = db.prepare("SELECT MAX(versionNumber) as maxV FROM parser_versions WHERE profileId = ?").get(id) as { maxV: number };
      const nextV = (row.maxV || 0) + 1;

      db.prepare("INSERT INTO parser_versions (id, profileId, versionNumber, configJson, changeNote, createdAt) VALUES (?, ?, ?, ?, ?, ?)")
        .run(versionId, id, nextV, JSON.stringify(config), changeNote || `Version ${nextV}`, new Date().toISOString());
      
      db.prepare("UPDATE parser_profiles SET status = 'published' WHERE id = ?").run(id);
    });

    transaction();
    res.json({ success: true, versionId });
  } catch (err) {
    res.status(500).json({ error: "Failed to publish version" });
  }
};

export const activateProfile = (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const transaction = db.transaction(() => {
      // Deactivate all
      db.prepare("UPDATE parser_profiles SET isActive = 0").run();
      // Activate this one
      db.prepare("UPDATE parser_profiles SET isActive = 1 WHERE id = ?").run(id);
    });

    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to activate profile" });
  }
};

export const getVersions = (req: Request, res: Response) => {
  const { id } = req.params; // profileId
  try {
    const versions = db.prepare("SELECT * FROM parser_versions WHERE profileId = ? ORDER BY versionNumber DESC").all() as ParserVersion[];
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch versions" });
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

export const getLogs = (req: Request, res: Response) => {
  try {
    const logs = db.prepare("SELECT * FROM parser_logs ORDER BY timestamp DESC LIMIT 100").all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
};

export const saveLog = (req: Request, res: Response) => {
  const { rawInput, unmatchedLines, configId } = req.body;
  const id = uuidv4();
  try {
    db.prepare("INSERT INTO parser_logs (id, timestamp, rawInput, unmatchedLines, configId) VALUES (?, ?, ?, ?, ?)")
      .run(id, new Date().toISOString(), rawInput, JSON.stringify(unmatchedLines), configId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save log" });
  }
};

export const logFailure = (rawInput: string, unmatchedLines: string[], configId: string) => {
  const id = uuidv4();
  try {
    db.prepare("INSERT INTO parser_logs (id, timestamp, rawInput, unmatchedLines, configId) VALUES (?, ?, ?, ?, ?)")
      .run(id, new Date().toISOString(), rawInput, JSON.stringify(unmatchedLines), configId);
  } catch (err) {
    console.error("Failed to log parser failure", err);
  }
};
export const duplicateProfile = (req: Request, res: Response) => {
  const { id } = req.params;
  const newId = uuidv4();
  const versionId = uuidv4();

  try {
    const transaction = db.transaction(() => {
      const profile = db.prepare("SELECT * FROM parser_profiles WHERE id = ?").get(id) as any;
      if (!profile) throw new Error("Profile not found");

      const version = db.prepare("SELECT * FROM parser_versions WHERE profileId = ? ORDER BY versionNumber DESC LIMIT 1").get(id) as any;
      if (!version) throw new Error("No version found for profile");

      db.prepare("INSERT INTO parser_profiles (id, name, description, status, isActive) VALUES (?, ?, ?, 'draft', 0)")
        .run(newId, `${profile.name} (Copy)`, profile.description);

      db.prepare("INSERT INTO parser_versions (id, profileId, versionNumber, configJson, changeNote, createdAt) VALUES (?, ?, 1, ?, ?, ?)")
        .run(versionId, newId, version.configJson, `Cloned from ${profile.name} (v${version.versionNumber})`, new Date().toISOString());
    });

    transaction();
    res.json({ id: newId, versionId });
  } catch (err) {
    res.status(500).json({ error: "Failed to duplicate profile" });
  }
};
