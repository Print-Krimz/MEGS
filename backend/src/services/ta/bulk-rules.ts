/** Most records a single bulk request may touch. Rows run one after another, so this also bounds the request time. */
export const BULK_MAX_IDS = 50;
