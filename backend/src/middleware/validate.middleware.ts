import { Request, Response, NextFunction } from "express";
import { ZodTypeAny, ZodError } from "zod";
import { sendError } from "../utils/response.js";

// Validates req body, query, and params against the provided Zod schema.
export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        sendError(res, "Validation failed", 400, { errors: formattedErrors });
        return;
      }
      
      sendError(res, "Internal Server Error during validation", 500);
    }
  };
};
