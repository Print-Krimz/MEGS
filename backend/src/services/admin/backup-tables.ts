import { Prisma, type PrismaClient } from "@prisma/client";

// Dependency order also determines restoration order. Only these models can
// be restored; fields are further restricted by the generated Prisma schema.
// Derived data, job queues and auth secrets are intentionally left out.
export const BACKUP_TABLES = [
  ["users", "User"], ["clients", "Client"],
  ["scoringConfigurations", "CandidateScoringConfiguration"], ["scoringWeights", "CandidateScoringWeight"],
  ["applicantProfiles", "ApplicantProfile"], ["skills", "Skill"],
  ["educations", "Education"], ["trainingCertifications", "TrainingCertification"],
  ["characterReferences", "CharacterReference"], ["assets", "Asset"],
  ["manpowerRequests", "ManpowerRequest"], ["jobPostings", "JobPosting"], ["savedJobs", "SavedJob"],
  ["applications", "Application"], ["applicationBackouts", "ApplicationBackout"], ["postHireDocuments", "PostHireDocument"],
  ["employees", "Employee"],
  ["storedDocuments", "StoredDocument"], ["applicantSkills", "ApplicantSkill"], ["workExperiences", "WorkExperience"],
  ["interviews", "Interview"], ["recruiterDecisions", "RecruiterDecision"], ["clientEndorsements", "ClientEndorsement"],
  ["complianceRequirements", "ComplianceRequirement"], ["deployments", "Deployment"],
  ["employmentEvents", "EmploymentEvent"], ["deploymentStatusHistory", "DeploymentStatusHistory"],
  ["mrfComplianceTemplates", "MRFComplianceTemplate"], ["complianceDocumentVersions", "ComplianceDocumentVersion"],
  ["deploymentReviews", "DeploymentReview"], ["deploymentAgreementVersions", "DeploymentAgreementVersion"],
  ["talentPoolMemberships", "TalentPoolMembership"], ["talentPoolContacts", "TalentPoolContact"], ["talentPoolInvitations", "TalentPoolInvitation"],
  ["candidateScores", "CandidateScore"], ["auditLogs", "AuditLog"], ["notifications", "Notification"],
] as const;

export type BackupProgress = { table: string; tableIndex: number; tableCount: number; rowsDone: number; rowsTotal?: number };
export type OnBackupProgress = (progress: BackupProgress) => void | Promise<void>;

const delegateName = (model: string) => model[0].toLowerCase() + model.slice(1);
const requiredJson = new Set(["CandidateScoringConfiguration.knnSettings", "CandidateScore.explanation"]);
const findModel = (modelName: string) => Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === modelName);

const primaryKeyFields = (modelName: string) => {
  const model = findModel(modelName);
  const fields = model?.fields.some((field) => field.name === "id") ? ["id"]
    : modelName === "ApplicantSkill" ? ["applicantProfileId", "skillId"] : [];
  if (!fields.length) throw new Error(`Backup table has no primary key: ${modelName}`);
  return fields;
};

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const BACKUP_PAGE_SIZE = 500;
const PAGE_ATTEMPTS = 3;

// Tables with large JSON columns (e.g. CandidateScore.explanation) stream significantly
// faster and avoid WAN TCP buffer timeouts with a smaller page size.
const getBackupPageSize = (model: string): number => {
  if (model === "CandidateScore") return 200;
  return BACKUP_PAGE_SIZE;
};

const readPage = async (delegate: any, args: Record<string, unknown>) => {
  for (let attempt = 1; ; attempt++) {
    try { return await delegate.findMany(args); }
    catch (error) {
      if (attempt >= PAGE_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
};

// Reads every table in short, primary-key-ordered pages. One long transaction
// held a pooled connection for minutes on slow links and was dropped by the
// pooler ("Connection terminated unexpectedly"); short retried queries are not.
export async function collectBackupTables(db: PrismaClient, onProgress?: OnBackupProgress) {
  const data: Record<string, any[]> = {};
  for (const [tableIndex, [key, model]] of BACKUP_TABLES.entries()) {
    const delegate = (db as any)[delegateName(model)];
    const orderBy = primaryKeyFields(model).map((field) => ({ [field]: "asc" }));
    const rows: any[] = [];
    const pageSize = getBackupPageSize(model);
    try {
      for (let skip = 0; ; skip += pageSize) {
        await onProgress?.({ table: model, tableIndex, tableCount: BACKUP_TABLES.length, rowsDone: rows.length });
        const page = await readPage(delegate, { orderBy, skip, take: pageSize });
        rows.push(...page);
        if (page.length < pageSize) break;
      }
    } catch (error) {
      throw new Error(`Reading ${model}: ${describeError(error)}`, { cause: error });
    }
    data[key] = rows;
  }
  return data;
}

export function formatBackupRow(modelName: string, row: Record<string, unknown>) {
  const model = findModel(modelName);
  if (!model) throw new Error(`Unsupported backup table: ${modelName}`);
  const data: Record<string, unknown> = {};
  for (const field of model.fields) {
    if ((field.kind !== "scalar" && field.kind !== "enum") || row[field.name] === undefined) continue;
    const value = row[field.name];
    if (value === null) { data[field.name] = field.type === "Json" ? (requiredJson.has(`${modelName}.${field.name}`) ? Prisma.JsonNull : Prisma.DbNull) : null; continue; }
    if (field.type === "DateTime") {
      const date = new Date(String(value));
      if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date in ${modelName}.${field.name}`);
      data[field.name] = date;
    } else if (field.type === "BigInt") data[field.name] = BigInt(String(value));
    else data[field.name] = value;
  }
  return { model, data };
}

// Identifier values come solely from the generated schema allowlist.
// Postgres folds unquoted names to lower case, so names passed as text need quotes too.
const quotedName = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const identifier = (value: string) => Prisma.raw(quotedName(value));
// Postgres caps a statement at 65535 bind parameters; stay well under it.
const MAX_PARAMS = 30_000;

const toSqlValue = (fieldType: string, value: unknown) => {
  if (value === null || value === Prisma.DbNull) return null;
  if (value === Prisma.JsonNull) return "null";
  if (fieldType === "Json") return JSON.stringify(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
};

type ColumnTypes = Map<string, string>;

const loadColumnTypes = async (tx: any, table: string): Promise<ColumnTypes> => {
  const rows: Array<{ column: string; type: string }> = await tx.$queryRaw(Prisma.sql`
    SELECT a.attname AS "column", format_type(a.atttypid, a.atttypmod) AS "type"
    FROM pg_attribute a
    WHERE a.attrelid = to_regclass(${quotedName(table)}) AND a.attnum > 0 AND NOT a.attisdropped`);
  return new Map(rows.map((row) => [row.column, row.type]));
};

// One INSERT ... ON CONFLICT per chunk instead of one upsert per row: on a
// slow database link every round trip counts.
const buildUpsert = (modelName: string, rows: Record<string, unknown>[], columnTypes: ColumnTypes) => {
  const model = findModel(modelName)!;
  const table = model.dbName || model.name;
  const fields = model.fields.filter((field) => (field.kind === "scalar" || field.kind === "enum")
    && rows.some((row) => row[field.name] !== undefined) && columnTypes.has(field.dbName || field.name));
  const pkFields = primaryKeyFields(modelName);
  const column = (name: string) => { const field = model.fields.find((f) => f.name === name)!; return field.dbName || field.name; };
  const values = rows.map((row) => Prisma.sql`(${Prisma.join(fields.map((field) => {
    if (row[field.name] === undefined) return Prisma.raw("DEFAULT");
    const cast = Prisma.raw(`::${columnTypes.get(field.dbName || field.name)}`);
    return Prisma.sql`${toSqlValue(field.type, row[field.name])}${cast}`;
  }))})`);
  const updates = fields.filter((field) => !pkFields.includes(field.name))
    .map((field) => Prisma.sql`${identifier(field.dbName || field.name)} = EXCLUDED.${identifier(field.dbName || field.name)}`);
  const conflict = Prisma.join(pkFields.map((name) => identifier(column(name))));
  return Prisma.sql`INSERT INTO ${identifier(table)} (${Prisma.join(fields.map((field) => identifier(field.dbName || field.name)))})
    VALUES ${Prisma.join(values)}
    ON CONFLICT (${conflict}) ${updates.length ? Prisma.sql`DO UPDATE SET ${Prisma.join(updates)}` : Prisma.raw("DO NOTHING")}`;
};

export const RESTORE_TIMEOUT_MS = 45 * 60 * 1000;

export async function restoreBackupTables(db: PrismaClient, snapshot: Record<string, unknown>, onProgress?: OnBackupProgress) {
  const hasRows = BACKUP_TABLES.some(([key]) => Array.isArray(snapshot[key]) && (snapshot[key] as unknown[]).length > 0);
  if (!hasRows) return { recordsRestored: {} as Record<string, number>, totalRecords: 0 };
  return db.$transaction(async (tx) => {
    const recordsRestored: Record<string, number> = {};
    let totalRecords = 0;
    for (const [tableIndex, [key, modelName]] of BACKUP_TABLES.entries()) {
      const rows = snapshot[key];
      if (rows === undefined) continue; // Legacy backups did not include every table.
      if (!Array.isArray(rows)) throw new Error(`Invalid backup records for ${modelName}`);
      const formatted = rows.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`Invalid backup row for ${modelName}`);
        return formatBackupRow(modelName, row).data;
      });
      if (formatted.length) {
        const model = findModel(modelName)!;
        const table = model.dbName || model.name;
        try {
          const columnTypes = await loadColumnTypes(tx, table);
          const columnCount = model.fields.filter((field) => field.kind === "scalar" || field.kind === "enum").length;
          const chunkSize = Math.max(1, Math.min(BACKUP_PAGE_SIZE, Math.floor(MAX_PARAMS / Math.max(1, columnCount))));
          for (let start = 0; start < formatted.length; start += chunkSize) {
            await onProgress?.({ table: modelName, tableIndex, tableCount: BACKUP_TABLES.length, rowsDone: start, rowsTotal: formatted.length });
            await (tx as any).$executeRaw(buildUpsert(modelName, formatted.slice(start, start + chunkSize), columnTypes));
          }
          const serial = model.fields.find((field) => field.name === "id" && field.type === "Int");
          if (serial) {
            const column = serial.dbName || serial.name;
            await tx.$queryRaw(Prisma.sql`SELECT setval(pg_get_serial_sequence(${quotedName(table)}, ${column}), COALESCE(MAX(${identifier(column)}), 1), COUNT(*) > 0) FROM ${identifier(table)}`);
          }
        } catch (error) {
          throw new Error(`Could not restore ${modelName}; the backup may be incomplete or conflict with current records. (${describeError(error)})`, { cause: error });
        }
      }
      recordsRestored[modelName] = formatted.length;
      totalRecords += formatted.length;
    }
    return { recordsRestored, totalRecords };
  }, { maxWait: 10_000, timeout: RESTORE_TIMEOUT_MS });
}
