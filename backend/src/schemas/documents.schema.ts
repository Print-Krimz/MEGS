import { z } from "zod";
import { boundedIdText } from "./field-limits.js";

export const documentsSchema = {
  documentParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
};
