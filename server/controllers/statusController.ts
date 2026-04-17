import { Request, Response } from "express";
import { broadcast } from "../broadcast";

export let kioskOpen = true;

export const setKioskOpen = (val: boolean) => kioskOpen = val;

export const getStatus = (req: Request, res: Response) => {
  res.json({ kioskOpen });
};

export const updateStatus = (req: Request, res: Response) => {
  kioskOpen = !!req.body.open;
  broadcast({ type: "STATUS_UPDATE", kioskOpen });
  res.json({ success: true, kioskOpen });
};
