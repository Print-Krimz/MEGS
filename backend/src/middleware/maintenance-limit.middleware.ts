import type { RequestHandler } from "express";

let activeMaintenance = false;
// One backup/restore operation at a time per process; shared quotas separately
// bound admission across processes. Reserve before buffering a restore upload.
export const acquireMaintenanceSlot: RequestHandler = (req, res, next) => {
  if (activeMaintenance) {
    res.setHeader("Retry-After", "5");
    res.status(429).json({ success: false, message: "Backup maintenance is busy. Please retry shortly.", retryAfter: 5 });
    return;
  }
  activeMaintenance = true;
  let released = false;
  const release = () => { if (!released) { released = true; activeMaintenance = false; } };
  res.locals.releaseMaintenance = release;
  res.once("finish", release);
  res.once("close", () => { if (!req.complete) release(); });
  next();
};

export const finishMaintenance = (handler: RequestHandler): RequestHandler => async (req, res, next) => {
  try { await handler(req, res, next); }
  catch (error) { next(error); }
  finally { res.locals.releaseMaintenance?.(); }
};
