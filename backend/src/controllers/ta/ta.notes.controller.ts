import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import { addApplicationNote, listApplicationNotes } from "../../services/ta/application-notes.service.js";

// GET /api/ta/applications/:id/notes
export const listApplicationNotesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const notes = await listApplicationNotes(parseInt(req.params.id as string, 10));
    sendSuccess(res, "Notes retrieved", notes);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// POST /api/ta/applications/:id/notes
export const addApplicationNoteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const note = await addApplicationNote(parseInt(req.params.id as string, 10), req.user!.id, req.body.body);
    sendSuccess(res, "Note added", note, 201);
  } catch (error: any) {
    sendError(res, error.message, /not found/i.test(error.message) ? 404 : 400);
  }
};
