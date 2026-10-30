import prisma from "../../utils/prisma.js";
import { ownedWhere, owns } from "../ta/ownership.js";
import supabase from "../../utils/supabase.js";
import { ensureBucketExists } from "../../middleware/upload.middleware.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { validateDocumentBytes, MAX_CONTRACT_SCAN_BYTES, sanitizeUploadFileName } from "../../security/file-validation.js";
import { validateLegacyResumeUrl } from "../../security/legacy-resume-download.js";

export const uploadAndStoreDocument = async (
  userId: string,
  category: "RESUME" | "PHOTO" | "ASSET" | "POST_HIRE" | "VAULT_201" | "CONTRACT",
  file: Express.Multer.File,
  applicationId?: number,
  profileId?: number
) => {
  const validated = validateDocumentBytes(file.buffer, file.mimetype, category === "CONTRACT" ? MAX_CONTRACT_SCAN_BYTES : undefined);
  const BUCKET = "documents";
  await ensureBucketExists(BUCKET);

  const extension = validated.extension;
  const storagePath = `${userId}/${category.toLowerCase()}/${uuidv4()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    console.error("Supabase Storage Error:", error);
    throw new Error(`Failed to upload file to Supabase: ${error.message}`);
  }

  const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");

  const doc = await prisma.storedDocument.create({
    data: {
      ownerId: userId,
      category,
      originalName: sanitizeUploadFileName(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sha256,
      storageBucket: BUCKET,
      storagePath,
      applicationId,
      profileId,
    },
  });

  return doc;
};

// Owner and Admin always pass. A TA reads application documents of owned applications, and profile documents
// (resume, photo) of applicants who applied to an owned job or sit in the shared talent / redeployment pools.
// Signed contracts are staff-only: the applicant and employee never read them, even though the uploading TA owns the row.
async function mayRead(
  doc: { ownerId: string; applicationId: number | null; category?: string },
  requesterId: string,
  role: string
) {
  if (role === "ADMINISTRATOR") return true;
  if (doc.category === "CONTRACT") {
    if (role !== "TALENT_ACQUISITION" || !doc.applicationId) return false;
    return owns("application", doc.applicationId, { id: requesterId, role });
  }
  if (doc.ownerId === requesterId) return true;
  if (role !== "TALENT_ACQUISITION") return false;
  const actor = { id: requesterId, role };
  if (doc.applicationId) return owns("application", doc.applicationId, actor);
  const visible = await prisma.user.count({
    where: {
      id: doc.ownerId,
      OR: [
        { applications: { some: ownedWhere.application(actor) } },
        { employee: { is: ownedWhere.employeePool(actor) } },
        { applicantProfile: { is: { talentPoolMembership: { isNot: null } } } },
      ],
    } as any,
  });
  return visible > 0;
}

// Generates short-lived (60s) signed URL for document owner or TA/Admin staff.
export const getDocumentDownloadUrl = async (documentId: number, requesterId: string, requesterRole: string) => {
  const doc = await prisma.storedDocument.findUnique({
    where: { id: documentId }
  });

  if (!doc) {
    throw new Error("Document not found");
  }

  if (!(await mayRead(doc, requesterId, requesterRole))) {
    throw new Error("Unauthorized to access this document");
  }
  await ensureBucketExists(doc.storageBucket);

  const { data, error } = await supabase.storage
    .from(doc.storageBucket)
    .createSignedUrl(doc.storagePath, 60);

  if (error || !data) {
    throw new Error("Failed to generate download URL");
  }

  return data.signedUrl;
};

// Generates short-lived (300s) signed URL and metadata for document preview modal.
export const getDocumentPreview = async (documentId: number, requesterId: string, requesterRole: string) => {
  const doc = await prisma.storedDocument.findUnique({
    where: { id: documentId },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          applicantProfile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!doc) {
    throw new Error("Document not found");
  }

  if (!(await mayRead(doc, requesterId, requesterRole))) {
    throw new Error("Unauthorized to access this document");
  }
  await ensureBucketExists(doc.storageBucket);

  const { data, error } = await supabase.storage
    .from(doc.storageBucket)
    .createSignedUrl(doc.storagePath, 300);

  if (error || !data) {
    throw new Error("Failed to generate download URL");
  }

  const applicantName = doc.owner?.applicantProfile
    ? `${doc.owner.applicantProfile.firstName} ${doc.owner.applicantProfile.lastName}`.trim()
    : undefined;

  return {
    id: doc.id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    category: doc.category,
    uploadedAt: doc.uploadedAt,
    applicantName,
    applicantEmail: doc.owner?.email,
    url: data.signedUrl,
  };
};

// Resolves stored document route or ID to a secure short-lived signed URL (default 900s / 15m)
export const resolveDocumentSignedUrl = async (
  urlOrPath: string | null | undefined,
  requesterId: string,
  requesterRole: string = "APPLICANT",
  expiresInSeconds: number = 900
): Promise<string | null> => {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    // Approved historic links remain supported; arbitrary URLs never pass through.
    return validateLegacyResumeUrl(urlOrPath).toString();
  }
  const match = urlOrPath.match(/^\/api\/documents\/(\d+)(?:\/download)?$/);
  const docId = match ? Number(match[1]) : /^\d+$/.test(urlOrPath) ? Number(urlOrPath) : NaN;
    const doc = Number.isSafeInteger(docId) && docId > 0
      ? await prisma.storedDocument.findUnique({ where: { id: docId } })
      : await prisma.storedDocument.findFirst({ where: { storagePath: urlOrPath } });

    if (!doc) throw new Error("Document not found");
    if (!(await mayRead(doc, requesterId, requesterRole))) {
      throw new Error("Unauthorized to access this document");
    }
    await ensureBucketExists(doc.storageBucket);
    const { data, error } = await supabase.storage
      .from(doc.storageBucket)
      .createSignedUrl(doc.storagePath, Math.min(900, Math.max(1, Math.trunc(expiresInSeconds) || 60)));
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  throw new Error("Failed to generate download URL");
};

export interface DocumentUrlRequest {
  ref: string | null | undefined;
  requesterId: string;
  requesterRole?: string;
}

// Batch form of mayRead for one requester: same rules, but ownership is checked with one query per kind
// (applications, applicant owners) instead of one per document. Returns the ids of the readable documents.
async function readableDocumentIds(
  docs: Array<{ id: number; ownerId: string; applicationId: number | null; category?: string }>,
  requesterId: string,
  role: string
): Promise<Set<number>> {
  const allowed = new Set<number>();
  if (role === "ADMINISTRATOR") return new Set(docs.map((d) => d.id));
  const actor = { id: requesterId, role };
  const appChecks: typeof docs = [];
  const ownerChecks: typeof docs = [];
  for (const doc of docs) {
    if (doc.category === "CONTRACT") {
      if (role === "TALENT_ACQUISITION" && doc.applicationId) appChecks.push(doc);
    } else if (doc.ownerId === requesterId) {
      allowed.add(doc.id);
    } else if (role === "TALENT_ACQUISITION") {
      (doc.applicationId ? appChecks : ownerChecks).push(doc);
    }
  }
  if (appChecks.length > 0) {
    const apps = await prisma.application.findMany({
      where: { id: { in: [...new Set(appChecks.map((d) => d.applicationId as number))] }, ...ownedWhere.application(actor) } as any,
      select: { id: true },
    });
    const ownedApps = new Set(apps.map((a) => a.id));
    for (const doc of appChecks) if (ownedApps.has(doc.applicationId as number)) allowed.add(doc.id);
  }
  if (ownerChecks.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: [...new Set(ownerChecks.map((d) => d.ownerId))] },
        OR: [
          { applications: { some: ownedWhere.application(actor) } },
          { employee: { is: ownedWhere.employeePool(actor) } },
          { applicantProfile: { is: { talentPoolMembership: { isNot: null } } } },
        ],
      } as any,
      select: { id: true },
    });
    const visible = new Set(users.map((u) => u.id));
    for (const doc of ownerChecks) if (visible.has(doc.ownerId)) allowed.add(doc.id);
  }
  return allowed;
}

// Signed URLs are reused for 10 minutes. They are signed for 15 minutes, so a served URL always has 5 minutes left.
// The cache only replaces the createSignedUrls call: authorization runs on every call before any lookup.
const SIGNED_URL_TTL_MS = 600_000;
const SIGNED_URL_CACHE_MAX = 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export const clearSignedUrlCache = (): void => signedUrlCache.clear();

// Batch form of resolveDocumentSignedUrl for lists. Result is index-aligned with the requests; anything the single
// resolver would throw for (malformed, missing, unauthorized, storage failure, bad legacy URL) becomes null.
// One metadata query, at most two authorization queries per requester, and one createSignedUrls call per bucket.
export const resolveDocumentSignedUrls = async (
  requests: DocumentUrlRequest[],
  expiresInSeconds: number = 900
): Promise<Array<string | null>> => {
  const results: Array<string | null> = requests.map(() => null);
  const ids = new Set<number>();
  const paths = new Set<string>();
  const lookups: Array<{ index: number; id?: number; path?: string }> = [];

  requests.forEach((request, index) => {
    const ref = request.ref;
    if (!ref) return;
    if (ref.startsWith("http://") || ref.startsWith("https://")) {
      try {
        results[index] = validateLegacyResumeUrl(ref).toString();
      } catch {
        results[index] = null;
      }
      return;
    }
    const match = ref.match(/^\/api\/documents\/(\d+)(?:\/download)?$/);
    const docId = match ? Number(match[1]) : /^\d+$/.test(ref) ? Number(ref) : NaN;
    if (Number.isSafeInteger(docId) && docId > 0) {
      ids.add(docId);
      lookups.push({ index, id: docId });
    } else {
      paths.add(ref);
      lookups.push({ index, path: ref });
    }
  });
  if (lookups.length === 0) return results;

  const or: any[] = [];
  if (ids.size > 0) or.push({ id: { in: [...ids] } });
  if (paths.size > 0) or.push({ storagePath: { in: [...paths] } });
  const docs = await prisma.storedDocument.findMany({ where: { OR: or } });
  const byId = new Map(docs.map((d) => [d.id, d]));
  const byPath = new Map<string, (typeof docs)[number]>();
  for (const d of docs) if (!byPath.has(d.storagePath)) byPath.set(d.storagePath, d);

  // Authorize each distinct requester once over the distinct documents they asked for.
  const wanted = new Map<string, { requesterId: string; role: string; docs: Map<number, (typeof docs)[number]> }>();
  const targets: Array<{ index: number; doc: (typeof docs)[number]; key: string }> = [];
  for (const lookup of lookups) {
    const doc = lookup.id !== undefined ? byId.get(lookup.id) : byPath.get(lookup.path as string);
    if (!doc) continue;
    const { requesterId, requesterRole = "APPLICANT" } = requests[lookup.index];
    const key = `${requesterRole}:${requesterId}`;
    if (!wanted.has(key)) wanted.set(key, { requesterId, role: requesterRole, docs: new Map() });
    wanted.get(key)!.docs.set(doc.id, doc);
    targets.push({ index: lookup.index, doc, key });
  }
  const readable = new Map<string, Set<number>>();
  for (const [key, group] of wanted) {
    try {
      readable.set(key, await readableDocumentIds([...group.docs.values()], group.requesterId, group.role));
    } catch {
      readable.set(key, new Set());
    }
  }

  // Sign each distinct bucket/path once. Only readable documents get here; cached URLs (900 s expiry only) skip signing.
  const expiry = Math.min(900, Math.max(1, Math.trunc(expiresInSeconds) || 60));
  const useCache = expiry === 900;
  const now = Date.now();
  const signed = new Map<string, string>();
  const pathsByBucket = new Map<string, Set<string>>();
  for (const { doc, key } of targets) {
    if (!readable.get(key)?.has(doc.id)) continue;
    const cacheKey = `${doc.storageBucket}\u0000${doc.storagePath}`;
    const hit = useCache ? signedUrlCache.get(cacheKey) : undefined;
    if (hit && now < hit.expiresAt) {
      signed.set(cacheKey, hit.url);
      continue;
    }
    if (hit) signedUrlCache.delete(cacheKey);
    if (!pathsByBucket.has(doc.storageBucket)) pathsByBucket.set(doc.storageBucket, new Set());
    pathsByBucket.get(doc.storageBucket)!.add(doc.storagePath);
  }
  for (const [bucket, bucketPaths] of pathsByBucket) {
    const list = [...bucketPaths];
    try {
      await ensureBucketExists(bucket);
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(list, expiry);
      if (error || !data) continue;
      data.forEach((entry, i) => {
        const path = entry.path ?? list[i];
        if (entry.error || !entry.signedUrl || !path) return;
        const cacheKey = `${bucket}\u0000${path}`;
        signed.set(cacheKey, entry.signedUrl);
        if (!useCache) return;
        signedUrlCache.delete(cacheKey);
        signedUrlCache.set(cacheKey, { url: entry.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_MS });
        if (signedUrlCache.size > SIGNED_URL_CACHE_MAX) signedUrlCache.delete(signedUrlCache.keys().next().value as string);
      });
    } catch {
      // Whole bucket failed: its rows stay null.
    }
  }
  for (const { index, doc, key } of targets) {
    if (!readable.get(key)?.has(doc.id)) continue;
    results[index] = signed.get(`${doc.storageBucket}\u0000${doc.storagePath}`) ?? null;
  }
  return results;
};


