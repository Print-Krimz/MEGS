import prisma from "./prisma.js";

// In-memory cache for frequently read, rarely modified system policies (5m TTL).
interface PolicyCache {
  [key: string]: string;
}

let cache: PolicyCache | null = null;
let lastFetch = 0;
const CACHE_TTL_MS = 1000 * 60 * 5;

const ensureCache = async (): Promise<void> => {
  const now = Date.now();
  if (cache === null || now - lastFetch > CACHE_TTL_MS) {
    const policies = await prisma.policy.findMany();
    const newCache: PolicyCache = {};
    for (const p of policies) {
      newCache[p.key] = p.value;
    }
    cache = newCache;
    lastFetch = now;
  }
};

export const getPolicy = async (key: string, defaultValue: string = ""): Promise<string> => {
  await ensureCache();
  if (cache && key in cache) {
    return cache[key];
  }
  return defaultValue;
};

export const getPolicyInt = async (key: string, defaultValue: number = 0): Promise<number> => {
  const val = await getPolicy(key);
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const getPolicyBool = async (key: string, defaultValue: boolean = false): Promise<boolean> => {
  const val = await getPolicy(key);
  if (!val) return defaultValue;
  return val.toLowerCase() === "true" || val === "1";
};

// Resets policy cache; invoke on policy mutations in Admin service.
export const invalidatePolicyCache = (): void => {
  cache = null;
  lastFetch = 0;
};
