-- Merge the "NBI Clearance" and "Police Clearance" requirements into one "NBI / Police Clearance".
-- Data-only: requirements are free-text labels. Uploads link by requirement id (documentId,
-- ComplianceDocumentVersion.requirementId), so renaming a row never detaches a file.
-- Idempotent: rows already carrying the merged label are never touched again.

-- 1. Application requirements.
--    Rename one old-label row per application. If the application already has a merged-label row,
--    or has both old labels, only one row is renamed; the other keeps its old label so no upload is
--    lost and no duplicate merged row appears. Preference: has an upload, approved, NBI, lowest id.
WITH ranked AS (
  SELECT
    "id",
    "applicationId",
    ROW_NUMBER() OVER (
      PARTITION BY "applicationId"
      ORDER BY ("documentId" IS NOT NULL) DESC,
               ("reviewStatus" = 'APPROVED') DESC,
               (LOWER(BTRIM("documentLabel")) = 'nbi clearance') DESC,
               "id"
    ) AS rn
  FROM "ComplianceRequirement"
  WHERE LOWER(BTRIM("documentLabel")) IN ('nbi clearance', 'police clearance')
)
UPDATE "ComplianceRequirement" cr
SET "documentLabel" = 'NBI / Police Clearance'
FROM ranked
WHERE cr."id" = ranked."id"
  AND ranked.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM "ComplianceRequirement" m
    WHERE m."applicationId" = cr."applicationId"
      AND LOWER(BTRIM(m."documentLabel")) = 'nbi / police clearance'
  );

-- 2. MRF / client compliance templates.
--    One merged template per owner (mrfId + clientId). isRequired = required if either old one was.
--    The redundant old template is deleted: templates are configuration, nothing references them,
--    and leaving it would keep generating a separate "Police Clearance" requirement.
WITH grp AS (
  SELECT
    "id",
    "mrfId",
    "clientId",
    "isRequired",
    ROW_NUMBER() OVER (
      PARTITION BY "mrfId", "clientId"
      ORDER BY (LOWER(BTRIM("documentLabel")) = 'nbi clearance') DESC, "id"
    ) AS rn,
    BOOL_OR("isRequired") OVER (PARTITION BY "mrfId", "clientId") AS any_required
  FROM "MRFComplianceTemplate"
  WHERE LOWER(BTRIM("documentLabel")) IN ('nbi clearance', 'police clearance')
),
already_merged AS (
  SELECT "mrfId", "clientId" FROM "MRFComplianceTemplate"
  WHERE LOWER(BTRIM("documentLabel")) = 'nbi / police clearance'
),
redundant AS (
  -- Old rows that are not the single survivor, or whose owner already has a merged template.
  DELETE FROM "MRFComplianceTemplate" t
  USING grp g
  WHERE t."id" = g."id"
    AND (
      g.rn > 1
      OR EXISTS (
        SELECT 1 FROM already_merged a
        WHERE a."mrfId" IS NOT DISTINCT FROM g."mrfId"
          AND a."clientId" IS NOT DISTINCT FROM g."clientId"
      )
    )
  RETURNING t."id"
)
UPDATE "MRFComplianceTemplate" t
SET "documentLabel" = 'NBI / Police Clearance',
    "isRequired" = g.any_required
FROM grp g
WHERE t."id" = g."id"
  AND g.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM already_merged a
    WHERE a."mrfId" IS NOT DISTINCT FROM g."mrfId"
      AND a."clientId" IS NOT DISTINCT FROM g."clientId"
  );

-- 3. ManpowerRequest.complianceRequirements (nullable TEXT).
--    Read as a JSON array (strings or objects with "label"/"documentLabel") and, when that fails,
--    as a comma/semicolon/newline separated list. Both shapes are rewritten here; the two old labels
--    become one merged label at the position of the first match, with duplicates dropped.
DO $$
DECLARE
  rec RECORD;
  merged CONSTANT TEXT := 'NBI / Police Clearance';
  parsed JSONB;
  elem JSONB;
  out_arr JSONB;
  lbl TEXT;
  norm TEXT;
  seen TEXT[];
  part TEXT;
  out_parts TEXT[];
BEGIN
  FOR rec IN
    SELECT "id", "complianceRequirements" AS txt
    FROM "ManpowerRequest"
    WHERE "complianceRequirements" ~* '(nbi|police)[[:space:]]+clearance'
  LOOP
    parsed := NULL;
    BEGIN
      parsed := rec.txt::jsonb;
    EXCEPTION WHEN OTHERS THEN
      parsed := NULL;
    END;

    seen := ARRAY[]::TEXT[];

    IF parsed IS NOT NULL AND jsonb_typeof(parsed) = 'array' THEN
      out_arr := '[]'::jsonb;
      FOR elem IN SELECT value FROM jsonb_array_elements(parsed) LOOP
        IF jsonb_typeof(elem) = 'string' THEN
          lbl := elem #>> '{}';
        ELSIF jsonb_typeof(elem) = 'object' THEN
          lbl := COALESCE(elem ->> 'label', elem ->> 'documentLabel');
        ELSE
          lbl := NULL;
        END IF;

        norm := LOWER(BTRIM(COALESCE(lbl, '')));
        IF norm IN ('nbi clearance', 'police clearance', 'nbi / police clearance') THEN
          IF 'nbi / police clearance' = ANY (seen) THEN
            CONTINUE; -- duplicate of an earlier merged entry
          END IF;
          seen := seen || 'nbi / police clearance';
          IF jsonb_typeof(elem) = 'string' THEN
            elem := to_jsonb(merged);
          ELSIF elem ? 'label' THEN
            elem := jsonb_set(elem, '{label}', to_jsonb(merged));
          ELSE
            elem := jsonb_set(elem, '{documentLabel}', to_jsonb(merged));
          END IF;
        END IF;
        out_arr := out_arr || jsonb_build_array(elem);
      END LOOP;

      UPDATE "ManpowerRequest" SET "complianceRequirements" = out_arr::text WHERE "id" = rec.id;
    ELSE
      out_parts := ARRAY[]::TEXT[];
      FOREACH part IN ARRAY regexp_split_to_array(rec.txt, '[,;\n]+') LOOP
        part := BTRIM(part);
        CONTINUE WHEN part = '';
        IF LOWER(part) IN ('nbi clearance', 'police clearance', 'nbi / police clearance') THEN
          IF 'nbi / police clearance' = ANY (seen) THEN
            CONTINUE;
          END IF;
          seen := seen || 'nbi / police clearance';
          part := merged;
        END IF;
        out_parts := out_parts || part;
      END LOOP;

      UPDATE "ManpowerRequest"
      SET "complianceRequirements" = array_to_string(out_parts, ', ')
      WHERE "id" = rec.id;
    END IF;
  END LOOP;
END $$;
