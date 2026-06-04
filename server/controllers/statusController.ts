import { Request, Response } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";

export let kioskOpen = true;

export const loadKioskStatus = () => {
  try {
    const record = db.prepare("SELECT value FROM settings WHERE key = ?").get("kiosk_open") as { value: string } | undefined;
    if (record) {
      kioskOpen = record.value === "1";
    }
  } catch (e) {
    // Database or table might not exist yet (e.g. during test bootstrap)
  }
};

export const setKioskOpen = (val: boolean) => {
  kioskOpen = val;
  try {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("kiosk_open", val ? "1" : "0");
  } catch (e) {
    // Ignore db errors if settings table isn't created yet
  }
};

export const getStatus = (req: Request, res: Response) => {
  res.json({ kioskOpen });
};

export const updateStatus = (req: Request, res: Response) => {
  setKioskOpen(!!req.body.open);
  broadcast({ type: "STATUS_UPDATE", kioskOpen });
  res.json({ success: true, kioskOpen });
};
