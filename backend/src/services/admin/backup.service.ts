import crypto from "crypto";
import zlib from "zlib";
import { Readable } from "stream";
import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { logAudit } from "../../utils/audit.js";

const BACKUP_BUCKET = "system-backups";
const verifiedBuckets = new Set<string>();

export const ensureBackupBucketExists = async (): Promise<void> => {
  if (verifiedBuckets.has(BACKUP_BUCKET)) return;
  try {
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    const exists = (buckets || []).some((b) => (b.id || b.name) === BACKUP_BUCKET);
    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket(BACKUP_BUCKET, {
        public: false,
      });
      if (createErr && !createErr.message.toLowerCase().includes("already exists")) {
        console.warn(`[Storage] createBucket '${BACKUP_BUCKET}' warning:`, createErr.message);
      }
    }
    verifiedBuckets.add(BACKUP_BUCKET);
  } catch (err: any) {
    console.warn(`[Storage] Auto-bucket provisioning warning for '${BACKUP_BUCKET}':`, err?.message);
  }
};

const getEncryptionKey = (): Buffer => {
  const secret =
    process.env.BACKUP_ENCRYPTION_SECRET ||
    process.env.JWT_SECRET ||
    "megs-production-encrypted-backup-master-key-2026";
  return crypto.createHash("sha256").update(secret).digest();
};

const sanitizeBackupName = (rawName: string): string => {
  let clean = rawName
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!clean) {
    clean = "backup";
  }
  return clean;
};

export interface BackupDownloadResult {
  stream: Readable;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export const triggerDatabaseBackupRoutine = async (
  initiatedById?: string,
  backupType: "MANUAL" | "SCHEDULED_ROUTINE" = "MANUAL",
  customName?: string
) => {
  const startTime = Date.now();
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  let filename: string;
  if (customName && customName.trim()) {
    const cleanLabel = sanitizeBackupName(customName);
    filename = `megs_backup_${cleanLabel}_${timestamp}.enc.gz`;
  } else {
    filename = `megs_backup_${timestamp}.enc.gz`;
  }

  // Step 1: Create initial in-progress record
  const backupRecord = await prisma.databaseBackupRecord.create({
    data: {
      filename,
      status: "IN_PROGRESS",
      backupType,
      initiatedById: initiatedById || null,
      encryptionMethod: "AES-256-GCM",
      tablesIncluded: [],
    },
  });

  try {
    await ensureBackupBucketExists();

    // Step 2: Query Application Tables concurrently
    const [
      users,
      applicantProfiles,
      applicantSkills,
      workExperiences,
      storedDocuments,
      jobPostings,
      applications,
      interviews,
      recruiterDecisions,
      clientEndorsements,
      complianceRequirements,
      deployments,
      manpowerRequests,
      candidateScores,
      scoringConfigurations,
      auditLogs,
      notifications,
    ] = await Promise.all([
      prisma.user.findMany({ take: 500 }).catch(() => []),
      prisma.applicantProfile.findMany({ take: 500 }).catch(() => []),
      prisma.applicantSkill.findMany({ take: 500 }).catch(() => []),
      prisma.workExperience.findMany({ take: 500 }).catch(() => []),
      prisma.storedDocument.findMany({ take: 500 }).catch(() => []),
      prisma.jobPosting.findMany({ take: 500 }).catch(() => []),
      prisma.application.findMany({ take: 500 }).catch(() => []),
      prisma.interview.findMany({ take: 500 }).catch(() => []),
      prisma.recruiterDecision.findMany({ take: 500 }).catch(() => []),
      prisma.clientEndorsement.findMany({ take: 500 }).catch(() => []),
      prisma.complianceRequirement.findMany({ take: 500 }).catch(() => []),
      prisma.deployment.findMany({ take: 500 }).catch(() => []),
      prisma.manpowerRequest.findMany({ take: 500 }).catch(() => []),
      prisma.candidateScore.findMany({ take: 500 }).catch(() => []),
      prisma.candidateScoringConfiguration.findMany({ take: 50 }).catch(() => []),
      prisma.auditLog.findMany({ take: 500, orderBy: { createdAt: "desc" } }).catch(() => []),
      prisma.notification.findMany({ take: 500, orderBy: { createdAt: "desc" } }).catch(() => []),
    ]);

    const tablesIncluded = [
      "User",
      "ApplicantProfile",
      "ApplicantSkill",
      "WorkExperience",
      "StoredDocument",
      "JobPosting",
      "Application",
      "Interview",
      "RecruiterDecision",
      "ClientEndorsement",
      "ComplianceRequirement",
      "Deployment",
      "ManpowerRequest",
      "CandidateScore",
      "CandidateScoringConfiguration",
      "AuditLog",
      "Notification",
    ];

    const snapshotPayload = {
      meta: {
        version: "1.0.0",
        system: "MEGS Recruitment Management System",
        exportedAt: new Date().toISOString(),
        backupType,
        tablesCount: tablesIncluded.length,
        recordCounts: {
          User: users.length,
          ApplicantProfile: applicantProfiles.length,
          ApplicantSkill: applicantSkills.length,
          WorkExperience: workExperiences.length,
          StoredDocument: storedDocuments.length,
          JobPosting: jobPostings.length,
          Application: applications.length,
          Interview: interviews.length,
          RecruiterDecision: recruiterDecisions.length,
          ClientEndorsement: clientEndorsements.length,
          ComplianceRequirement: complianceRequirements.length,
          Deployment: deployments.length,
          ManpowerRequest: manpowerRequests.length,
          CandidateScore: candidateScores.length,
          CandidateScoringConfiguration: scoringConfigurations.length,
          AuditLog: auditLogs.length,
          Notification: notifications.length,
        },
      },
      data: {
        users,
        applicantProfiles,
        applicantSkills,
        workExperiences,
        storedDocuments,
        jobPostings,
        applications,
        interviews,
        recruiterDecisions,
        clientEndorsements,
        complianceRequirements,
        deployments,
        manpowerRequests,
        candidateScores,
        scoringConfigurations,
        auditLogs,
        notifications,
      },
    };

    // Step 3: Serialize and Gzip Compress
    const jsonString = JSON.stringify(snapshotPayload, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    );
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, "utf-8"), {
      level: 9,
    });

    // Step 4: AES-256-GCM Encryption
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(compressedBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Final file content: [IV (12B)] + [AuthTag (16B)] + [Encrypted Payload]
    const finalEncryptedFileBuffer = Buffer.concat([iv, authTag, encrypted]);

    // Step 5: Calculate SHA-256 Checksum
    const checksumSha256 = crypto
      .createHash("sha256")
      .update(finalEncryptedFileBuffer)
      .digest("hex");

    // Step 6: Upload directly to Supabase Storage
    const storagePath = filename;
    let { error: uploadErr } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(storagePath, finalEncryptedFileBuffer, {
        contentType: "application/gzip",
        upsert: true,
      });

    if (
      uploadErr &&
      (uploadErr.message?.toLowerCase().includes("not found") ||
        (uploadErr as any).statusCode === "404" ||
        (uploadErr as any).status === 404 ||
        (uploadErr as any).status === 400)
    ) {
      console.warn(`[Storage] Bucket '${BACKUP_BUCKET}' not found or uninitialized. Force-creating and retrying upload...`);
      await supabase.storage.createBucket(BACKUP_BUCKET, {
        public: false,
      });
      verifiedBuckets.add(BACKUP_BUCKET);

      const retryResult = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(storagePath, finalEncryptedFileBuffer, {
          contentType: "application/gzip",
          upsert: true,
        });
      uploadErr = retryResult.error;
    }

    if (uploadErr) {
      console.error("Supabase Storage Backup Upload Error:", uploadErr);
      throw new Error(`Failed to upload backup to Supabase Storage: ${uploadErr.message}`);
    }

    const durationMs = Date.now() - startTime;

    // Step 7: Update Backup Record with SUCCESS
    const updatedRecord = await prisma.databaseBackupRecord.update({
      where: { id: backupRecord.id },
      data: {
        status: "SUCCESS",
        sizeBytes: BigInt(finalEncryptedFileBuffer.length),
        checksumSha256,
        storagePath,
        tablesIncluded,
        durationMs,
        completedAt: new Date(),
      },
    });

    // Step 8: Log Audit Event
    await logAudit(
      initiatedById || null,
      "DATABASE_BACKUP_SUCCESS",
      "DatabaseBackupRecord",
      backupRecord.id,
      {
        filename,
        sizeBytes: finalEncryptedFileBuffer.length,
        checksumSha256,
        durationMs,
        backupType,
        tablesCount: tablesIncluded.length,
      }
    );

    return updatedRecord;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err?.message || "Failed to generate database backup snapshot";

    await prisma.databaseBackupRecord.update({
      where: { id: backupRecord.id },
      data: {
        status: "FAILED",
        errorMessage,
        durationMs,
        completedAt: new Date(),
      },
    }).catch(() => null);

    await logAudit(
      initiatedById || null,
      "DATABASE_BACKUP_FAILURE",
      "DatabaseBackupRecord",
      backupRecord.id,
      {
        filename,
        error: errorMessage,
        durationMs,
        backupType,
      }
    );

    throw err;
  }
};

export const listDatabaseBackups = async (limit = 50) => {
  const records = await prisma.databaseBackupRecord.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      initiatedBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return records.map((rec) => ({
    ...rec,
    sizeBytes: rec.sizeBytes ? Number(rec.sizeBytes) : null,
  }));
};

export const renameDatabaseBackup = async (
  backupId: string,
  newName: string,
  actorId?: string
) => {
  const record = await prisma.databaseBackupRecord.findUnique({
    where: { id: backupId },
  });

  if (!record) {
    throw new Error("Database backup record not found.");
  }

  let cleanName = sanitizeBackupName(newName);
  if (!cleanName.endsWith(".enc.gz")) {
    if (cleanName.endsWith(".gz")) {
      cleanName = cleanName.replace(/\.gz$/, ".enc.gz");
    } else if (cleanName.endsWith(".enc")) {
      cleanName = `${cleanName}.gz`;
    } else {
      cleanName = `${cleanName}.enc.gz`;
    }
  }

  const oldStoragePath = record.storagePath || record.filename;
  const newStoragePath = cleanName;

  if (oldStoragePath && oldStoragePath !== newStoragePath) {
    try {
      const { error: moveErr } = await supabase.storage
        .from(BACKUP_BUCKET)
        .move(oldStoragePath, newStoragePath);
      if (moveErr) {
        if (moveErr.message?.toLowerCase().includes("already exists")) {
          await supabase.storage.from(BACKUP_BUCKET).remove([newStoragePath]);
          await supabase.storage.from(BACKUP_BUCKET).move(oldStoragePath, newStoragePath);
        } else {
          console.warn(`[Rename Backup] Supabase Storage move warning:`, moveErr.message);
        }
      }
    } catch (err: any) {
      console.warn(`[Rename Backup] Supabase Storage move error:`, err?.message);
    }
  }

  const updated = await prisma.databaseBackupRecord.update({
    where: { id: backupId },
    data: {
      filename: cleanName,
      storagePath: newStoragePath,
    },
    include: {
      initiatedBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  await logAudit(
    actorId || null,
    "DATABASE_BACKUP_RENAMED",
    "DatabaseBackupRecord",
    backupId,
    {
      oldFilename: record.filename,
      newFilename: cleanName,
    }
  );

  return {
    ...updated,
    sizeBytes: updated.sizeBytes ? Number(updated.sizeBytes) : null,
  };
};

export const getBackupDownloadStream = async (backupId: string, actorId: string): Promise<BackupDownloadResult> => {
  const record = await prisma.databaseBackupRecord.findUnique({
    where: { id: backupId },
  });

  if (!record) {
    throw new Error("Database backup record not found.");
  }

  if (record.status !== "SUCCESS" || !record.storagePath) {
    throw new Error("Requested backup snapshot is not available for download.");
  }

  const { data, error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .download(record.storagePath);

  if (error || !data) {
    throw new Error(`Backup snapshot could not be downloaded from Supabase Storage: ${error?.message || "File not found"}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const stream = Readable.from(buffer);

  await logAudit(
    actorId,
    "DATABASE_BACKUP_DOWNLOAD",
    "DatabaseBackupRecord",
    record.id,
    {
      filename: record.filename,
      sizeBytes: Number(record.sizeBytes || buffer.length),
      checksumSha256: record.checksumSha256,
    }
  );

  return {
    stream,
    filename: record.filename,
    contentType: "application/octet-stream",
    sizeBytes: buffer.length,
  };
};

export interface RestoreResult {
  success: boolean;
  recordsRestored: Record<string, number>;
  totalRecords: number;
  durationMs: number;
  restoredAt: string;
}

export const restoreDatabaseBackupFromBuffer = async (
  buffer: Buffer,
  initiatedById?: string
): Promise<RestoreResult> => {
  const startTime = Date.now();

  if (!buffer || buffer.length < 28) {
    throw new Error("Invalid backup file: file is empty, corrupted, or too small.");
  }

  // 1. Extract IV (12 bytes), AuthTag (16 bytes), and Encrypted Payload
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encryptedPayload = buffer.subarray(28);

  const key = getEncryptionKey();
  let decompressed: Buffer;

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encryptedPayload),
      decipher.final(),
    ]);
    decompressed = zlib.gunzipSync(decrypted);
  } catch (err: any) {
    throw new Error("Failed to decrypt or decompress backup. Invalid key, corrupted file, or tampered data.");
  }

  let snapshot: any;
  try {
    snapshot = JSON.parse(decompressed.toString("utf-8"));
  } catch (err: any) {
    throw new Error("Corrupted backup payload: unable to parse JSON contents.");
  }

  if (!snapshot?.data || !snapshot?.meta) {
    throw new Error("Invalid backup structure: missing metadata or data section.");
  }

  const { data } = snapshot;
  const recordsRestored: Record<string, number> = {};
  let totalRecords = 0;

  const runInBatches = async <T>(
    items: T[],
    batchSize: number,
    fn: (item: T) => Promise<any>
  ) => {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map(fn));
    }
  };

  // 1. Users (Bulk insert missing + safe upsert)
  if (Array.isArray(data.users) && data.users.length > 0) {
    const formattedUsers = data.users.map((u: any) => ({
      id: u.id,
      email: u.email,
      password: u.password,
      role: u.role,
      accountStatus: u.accountStatus,
      isActive: u.isActive ?? true,
      createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
      updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      invitedAt: u.invitedAt ? new Date(u.invitedAt) : null,
      lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
    }));
    await prisma.user.createMany({
      data: formattedUsers,
      skipDuplicates: true,
    }).catch(() => null);
    recordsRestored.User = data.users.length;
    totalRecords += data.users.length;
  }

  // 2. Scoring Configurations
  if (Array.isArray(data.scoringConfigurations) && data.scoringConfigurations.length > 0) {
    const formattedConfigs = data.scoringConfigurations.map((sc: any) => ({
      id: sc.id,
      scope: sc.scope,
      version: sc.version,
      revision: sc.revision,
      status: sc.status,
      weights: sc.weights,
      knnSettings: sc.knnSettings,
      matchThreshold: sc.matchThreshold,
      changeReason: sc.changeReason,
      activatedById: sc.activatedById,
      createdAt: sc.createdAt ? new Date(sc.createdAt) : new Date(),
      updatedAt: sc.updatedAt ? new Date(sc.updatedAt) : new Date(),
      activatedAt: sc.activatedAt ? new Date(sc.activatedAt) : null,
    }));
    await prisma.candidateScoringConfiguration.createMany({
      data: formattedConfigs,
      skipDuplicates: true,
    }).catch(() => null);

    // Update active scoring configuration status
    await runInBatches(formattedConfigs, 20, async (sc: any) => {
      return prisma.candidateScoringConfiguration.update({
        where: { id: sc.id },
        data: {
          status: sc.status,
          weights: sc.weights,
          knnSettings: sc.knnSettings,
          matchThreshold: sc.matchThreshold,
        },
      }).catch(() => null);
    });
    recordsRestored.CandidateScoringConfiguration = data.scoringConfigurations.length;
    totalRecords += data.scoringConfigurations.length;
  }

  // 3. Job Postings
  if (Array.isArray(data.jobPostings) && data.jobPostings.length > 0) {
    const formattedJobs = data.jobPostings.map((j: any) => ({
      id: j.id,
      postedById: j.postedById,
      title: j.title,
      description: j.description,
      requirements: j.requirements,
      location: j.location,
      status: j.status,
      mrfId: j.mrfId,
      createdAt: j.createdAt ? new Date(j.createdAt) : new Date(),
      updatedAt: j.updatedAt ? new Date(j.updatedAt) : new Date(),
    }));
    await prisma.jobPosting.createMany({
      data: formattedJobs,
      skipDuplicates: true,
    }).catch(() => null);
    recordsRestored.JobPosting = data.jobPostings.length;
    totalRecords += data.jobPostings.length;
  }

  // 4. Applicant Profiles
  if (Array.isArray(data.applicantProfiles) && data.applicantProfiles.length > 0) {
    const formattedProfiles = data.applicantProfiles.map((ap: any) => ({
      id: ap.id,
      userId: ap.userId,
      firstName: ap.firstName,
      lastName: ap.lastName,
      middleName: ap.middleName,
      phone: ap.phone,
      currentAddress: ap.currentAddress,
      region: ap.region,
      dateOfBirth: ap.dateOfBirth ? new Date(ap.dateOfBirth) : null,
      highestEducation: ap.highestEducation,
      preferredRole: ap.preferredRole,
      expectedSalary: ap.expectedSalary,
      currentSalary: ap.currentSalary,
      yearsOfExperience: ap.yearsOfExperience,
      talentPoolStatus: ap.talentPoolStatus,
      createdAt: ap.createdAt ? new Date(ap.createdAt) : new Date(),
      updatedAt: ap.updatedAt ? new Date(ap.updatedAt) : new Date(),
    }));
    await prisma.applicantProfile.createMany({
      data: formattedProfiles,
      skipDuplicates: true,
    }).catch(() => null);

    // Synchronize talent pool status on applicant profiles
    await runInBatches(formattedProfiles, 50, async (ap: any) => {
      return prisma.applicantProfile.update({
        where: { id: ap.id },
        data: {
          talentPoolStatus: ap.talentPoolStatus,
          firstName: ap.firstName,
          lastName: ap.lastName,
          phone: ap.phone,
        },
      }).catch(() => null);
    });

    recordsRestored.ApplicantProfile = data.applicantProfiles.length;
    totalRecords += data.applicantProfiles.length;
  }

  // 5. Applications (Restores exact stage, status, contract, and orientation data)
  if (Array.isArray(data.applications) && data.applications.length > 0) {
    const formattedApps = data.applications.map((a: any) => ({
      id: a.id,
      userId: a.userId,
      jobPostingId: a.jobPostingId,
      status: a.status,
      resumeUrl: a.resumeUrl,
      aiScore: a.aiScore,
      aiSummary: a.aiSummary,
      isArchived: a.isArchived ?? false,
      archivedAt: a.archivedAt ? new Date(a.archivedAt) : null,
      contractSigned: a.contractSigned ?? false,
      contractSignedAt: a.contractSignedAt ? new Date(a.contractSignedAt) : null,
      contractDocumentUrl: a.contractDocumentUrl,
      contractNotes: a.contractNotes,
      orientationCompleted: a.orientationCompleted ?? false,
      orientationCompletedAt: a.orientationCompletedAt ? new Date(a.orientationCompletedAt) : null,
      orientationDate: a.orientationDate ? new Date(a.orientationDate) : null,
      orientationNotes: a.orientationNotes,
      createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
      updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
    }));

    // Step A: Insert any missing applications
    await prisma.application.createMany({
      data: formattedApps,
      skipDuplicates: true,
    }).catch(() => null);

    // Step B: Synchronize status and fields for all applications in snapshot
    await runInBatches(formattedApps, 50, async (a: any) => {
      return prisma.application.update({
        where: { id: a.id },
        data: {
          status: a.status,
          resumeUrl: a.resumeUrl,
          aiScore: a.aiScore,
          aiSummary: a.aiSummary,
          isArchived: a.isArchived,
          archivedAt: a.archivedAt,
          contractSigned: a.contractSigned,
          contractSignedAt: a.contractSignedAt,
          contractDocumentUrl: a.contractDocumentUrl,
          contractNotes: a.contractNotes,
          orientationCompleted: a.orientationCompleted,
          orientationCompletedAt: a.orientationCompletedAt,
          orientationDate: a.orientationDate,
          orientationNotes: a.orientationNotes,
        },
      }).catch(() => null);
    });

    recordsRestored.Application = data.applications.length;
    totalRecords += data.applications.length;
  }

  // 6. Interviews
  if (Array.isArray(data.interviews) && data.interviews.length > 0) {
    const formattedInterviews = data.interviews.map((iv: any) => ({
      id: iv.id,
      applicationId: iv.applicationId,
      type: iv.type,
      scheduledAt: iv.scheduledAt ? new Date(iv.scheduledAt) : null,
      conductedAt: iv.conductedAt ? new Date(iv.conductedAt) : null,
      result: iv.result,
      notes: iv.notes,
      complianceDeadline: iv.complianceDeadline ? new Date(iv.complianceDeadline) : null,
      isCompliant: iv.isCompliant,
      isActive: iv.isActive ?? true,
      createdAt: iv.createdAt ? new Date(iv.createdAt) : new Date(),
      updatedAt: iv.updatedAt ? new Date(iv.updatedAt) : new Date(),
    }));

    await prisma.interview.createMany({
      data: formattedInterviews,
      skipDuplicates: true,
    }).catch(() => null);

    await runInBatches(formattedInterviews, 50, async (iv: any) => {
      return prisma.interview.update({
        where: { id: iv.id },
        data: {
          scheduledAt: iv.scheduledAt,
          conductedAt: iv.conductedAt,
          result: iv.result,
          notes: iv.notes,
          isCompliant: iv.isCompliant,
          isActive: iv.isActive,
        },
      }).catch(() => null);
    });

    recordsRestored.Interview = data.interviews.length;
    totalRecords += data.interviews.length;
  }

  // 7. Recruiter Decisions
  if (Array.isArray(data.recruiterDecisions) && data.recruiterDecisions.length > 0) {
    const formattedDecisions = data.recruiterDecisions.map((rd: any) => ({
      id: rd.id,
      applicationId: rd.applicationId,
      actorId: rd.actorId,
      fromStatus: rd.fromStatus,
      toStatus: rd.toStatus,
      reason: rd.reason,
      createdAt: rd.createdAt ? new Date(rd.createdAt) : new Date(),
    }));

    await prisma.recruiterDecision.createMany({
      data: formattedDecisions,
      skipDuplicates: true,
    }).catch(() => null);

    recordsRestored.RecruiterDecision = data.recruiterDecisions.length;
    totalRecords += data.recruiterDecisions.length;
  }

  // 8. Compliance Requirements
  if (Array.isArray(data.complianceRequirements) && data.complianceRequirements.length > 0) {
    const formattedReqs = data.complianceRequirements.map((cr: any) => ({
      id: cr.id,
      applicationId: cr.applicationId,
      documentLabel: cr.documentLabel,
      isRequired: cr.isRequired ?? true,
      deadline: cr.deadline ? new Date(cr.deadline) : null,
      documentId: cr.documentId,
      reviewStatus: cr.reviewStatus,
      reviewedById: cr.reviewedById,
      reviewNotes: cr.reviewNotes,
      reviewedAt: cr.reviewedAt ? new Date(cr.reviewedAt) : null,
      expiresAt: cr.expiresAt ? new Date(cr.expiresAt) : null,
      createdAt: cr.createdAt ? new Date(cr.createdAt) : new Date(),
      updatedAt: cr.updatedAt ? new Date(cr.updatedAt) : new Date(),
    }));

    await prisma.complianceRequirement.createMany({
      data: formattedReqs,
      skipDuplicates: true,
    }).catch(() => null);

    await runInBatches(formattedReqs, 50, async (cr: any) => {
      return prisma.complianceRequirement.update({
        where: { id: cr.id },
        data: {
          reviewStatus: cr.reviewStatus,
          reviewNotes: cr.reviewNotes,
          reviewedAt: cr.reviewedAt,
          expiresAt: cr.expiresAt,
        },
      }).catch(() => null);
    });

    recordsRestored.ComplianceRequirement = data.complianceRequirements.length;
    totalRecords += data.complianceRequirements.length;
  }

  // 9. Deployments
  if (Array.isArray(data.deployments) && data.deployments.length > 0) {
    const formattedDeployments = data.deployments.map((d: any) => ({
      id: d.id,
      applicationId: d.applicationId,
      employeeId: d.employeeId,
      clientId: d.clientId,
      deploymentDate: d.deploymentDate ? new Date(d.deploymentDate) : null,
      startDate: d.startDate ? new Date(d.startDate) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
      status: d.status,
      remarks: d.remarks,
      createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
      updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
    }));

    await prisma.deployment.createMany({
      data: formattedDeployments,
      skipDuplicates: true,
    }).catch(() => null);

    await runInBatches(formattedDeployments, 50, async (d: any) => {
      return prisma.deployment.update({
        where: { id: d.id },
        data: {
          status: d.status,
          deploymentDate: d.deploymentDate,
          remarks: d.remarks,
        },
      }).catch(() => null);
    });

    recordsRestored.Deployment = data.deployments.length;
    totalRecords += data.deployments.length;
  }

  const durationMs = Date.now() - startTime;

  await logAudit(
    initiatedById || null,
    "DATABASE_RESTORE_SUCCESS",
    "DatabaseBackupRecord",
    null,
    {
      totalRecords,
      recordsRestored,
      durationMs,
    }
  );

  return {
    success: true,
    recordsRestored,
    totalRecords,
    durationMs,
    restoredAt: new Date().toISOString(),
  };
};

export const restoreDatabaseBackupById = async (
  backupId: string,
  initiatedById: string
): Promise<RestoreResult> => {
  const record = await prisma.databaseBackupRecord.findUnique({
    where: { id: backupId },
  });

  if (!record || !record.storagePath) {
    throw new Error("Database backup record not found.");
  }

  const { data, error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .download(record.storagePath);

  if (error || !data) {
    throw new Error(`Backup snapshot could not be retrieved from Supabase Storage: ${error?.message || "File not found"}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  return await restoreDatabaseBackupFromBuffer(fileBuffer, initiatedById);
};