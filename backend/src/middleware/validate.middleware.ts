import { Request, Response, NextFunction } from "express";
import { ZodTypeAny, ZodError } from "zod";
import { sendError } from "../utils/response.js";
import { isValidDateOnly } from "../schemas/field-limits.js";

type UnknownFieldIssue = { path: (string | number)[]; message: string };

const collectUnknownFields = (schema: any, value: any, path: (string | number)[] = []): UnknownFieldIssue[] => {
  if (value === undefined || value === null || typeof value !== "object") return [];
  const definition = schema?._def;
  if (!definition) return [];

  if (definition.type === "object") {
    const shape = schema.shape ?? (typeof definition.shape === "function" ? definition.shape() : definition.shape) ?? {};
    const allowed = new Set(Object.keys(shape));
    const permitsUnknown = Boolean(definition.catchall && definition.catchall._def?.type !== "never");
    const issues: UnknownFieldIssue[] = permitsUnknown ? [] : Object.keys(value)
      .filter((key) => !allowed.has(key))
      .map((key) => ({ path: [...path, key], message: `Unsupported field: ${key}` }));

    for (const [key, childSchema] of Object.entries(shape)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        issues.push(...collectUnknownFields(childSchema, value[key], [...path, key]));
      }
    }
    return issues;
  }

  if (definition.type === "array") {
    return Array.isArray(value)
      ? value.flatMap((entry, index) => collectUnknownFields(definition.element, entry, [...path, index]))
      : [];
  }

  if (["optional", "nullable", "default", "prefault", "catch", "nonoptional", "readonly"].includes(definition.type)) {
    const inner = definition.innerType ?? definition.inner;
    return inner ? collectUnknownFields(inner, value, path) : [];
  }

  if (definition.type === "pipe") return collectUnknownFields(definition.in, value, path);

  if (definition.type === "union" && Array.isArray(definition.options)) {
    const candidates = definition.options.map((option: any) => collectUnknownFields(option, value, path));
    return candidates.find((candidate: UnknownFieldIssue[]) => candidate.length === 0) ??
      candidates.sort((left: UnknownFieldIssue[], right: UnknownFieldIssue[]) => left.length - right.length)[0] ?? [];
  }

  if (definition.type === "intersection") {
    return [
      ...collectUnknownFields(definition.left, value, path),
      ...collectUnknownFields(definition.right, value, path),
    ];
  }

  return [];
};

// Validates req body, query, and params against the provided Zod schema.
export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestShape = (schema as any)?.shape ?? (schema as any)?._def?.shape;
      if (requestShape && typeof requestShape === "object") {
        const unknownFields: UnknownFieldIssue[] = [];
        for (const key of ["body", "query", "params"] as const) {
          if (requestShape[key]) {
            unknownFields.push(...collectUnknownFields(requestShape[key], req[key], [key]));
          } else {
            const value = req[key];
            const emptyObject = value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
            if (value !== undefined && value !== null && !emptyObject) {
              unknownFields.push({ path: [key], message: `This request does not accept ${key} fields` });
            }
          }
        }
        if (unknownFields.length > 0) {
          sendError(res, "Validation failed", 400, {
            errors: unknownFields.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
          });
          return;
        }
      }

      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as { body?: any; query?: any; params?: any };
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.params !== undefined) req.params = parsed.params;
      if (parsed.query !== undefined) {
        Object.defineProperty(req, "query", {
          configurable: true,
          enumerable: true,
          writable: true,
          value: parsed.query,
        });
      }
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

/** Enforce bounded business-calendar values on analytics and audit filters. */
export const validateDateRangeQuery = (req: Request, res: Response, next: NextFunction): void => {
  const { range, startDate, endDate } = req.query;
  const singleValue = (value: unknown): string | undefined =>
    typeof value === "string" ? value : value === undefined ? undefined : "";
  const start = singleValue(startDate);
  const end = singleValue(endDate);
  const selectedRange = singleValue(range);

  if (selectedRange && !["7d", "30d", "90d", "custom"].includes(selectedRange)) {
    sendError(res, "Unsupported date range", 400);
    return;
  }
  if (selectedRange === "custom" && (!start || !end)) {
    sendError(res, "Both start date and end date are required for a custom range", 400);
    return;
  }
  if ((start && !isValidDateOnly(start)) || (end && !isValidDateOnly(end))) {
    sendError(res, "Enter dates from 1900 through 2100", 400);
    return;
  }
  if (start && end) {
    if (!isValidDateOnly(start) || !isValidDateOnly(end)) {
      sendError(res, "Enter valid start and end dates from 1900 through 2100", 400);
      return;
    }
    if (start > end) {
      sendError(res, "Start date must be on or before end date", 400);
      return;
    }
    if (selectedRange === "custom") {
      const inclusiveDays = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1;
      if (inclusiveDays > 366) {
        sendError(res, "Choose a date range of 366 days or fewer.", 400);
        return;
      }
    }
  }
  next();
};
