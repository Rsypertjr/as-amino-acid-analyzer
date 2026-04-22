"use server";

import { prisma } from "@/lib/prisma";
import { buildProgress } from "@/lib/build-progress";
import { Prisma } from "@prisma/client";
import path from "path";
import fs from "fs";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface StatusResult {
  proteinExists: boolean;
  miniMotifExists: boolean;
  message: string;
}

export interface MotifSizeResult {
  numRows: number | null;
  message: string;
}

export interface SearchResult {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface BuildProgress {
  proteinRows: number;
  miniMotifRows: number;
  phase: "idle" | "proteins" | "minimotifs" | "done";
}

// ──────────────────────────────────────────────
// Amino Acid Constants
// ──────────────────────────────────────────────

const AMINO_CODES = [
  "G", "P", "A", "V", "L", "I", "M", "C", "P", "Y",
  "W", "H", "K", "R", "Q", "N", "E", "D", "S", "T",
];

// ──────────────────────────────────────────────
// Allowed FASTA files (whitelist for security)
// ──────────────────────────────────────────────

const ALLOWED_FILES = ["FASTA-TEST.txt"];

// ──────────────────────────────────────────────
// Helper: check if table exists
// ──────────────────────────────────────────────

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ) AS "exists"
    `;
    return result[0]?.exists ?? false;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Action: Check miniMotif table size
// ──────────────────────────────────────────────

export async function checkMiniMotifSize(): Promise<MotifSizeResult> {
  try {
    const exists = await tableExists("mini_motifs");
    if (!exists) {
      return { numRows: null, message: "miniMotif table does not exist" };
    }
    const count = await prisma.$queryRaw<{ num_rows: bigint }[]>`
      SELECT COUNT(*) as num_rows FROM mini_motifs
    `;
    return {
      numRows: Number(count[0]?.num_rows ?? 0),
      message: "OK",
    };
  } catch (e) {
    return { numRows: null, message: String(e) };
  }
}

// ──────────────────────────────────────────────
// Action: Check database status
// ──────────────────────────────────────────────

export async function checkDatabaseStatus(): Promise<StatusResult> {
  const proteinExists = await tableExists("proteins");
  const miniMotifExists = await tableExists("mini_motifs");

  let message = "";
  if (proteinExists) message += "The Protein Table is Built";
  if (miniMotifExists) message += " and the miniMotif Table is Built";
  if (!proteinExists && !miniMotifExists) {
    message = "The Protein and MimiMotif Tables are Dropped";
  }

  return { proteinExists, miniMotifExists, message };
}

// ──────────────────────────────────────────────
// Action: Drop tables
// ──────────────────────────────────────────────

export async function dropTables(): Promise<ActionResult> {
  const messages: string[] = [];

  try {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS proteins`);
    messages.push("Dropped proteins table");
  } catch (e) {
    messages.push(`Error dropping proteins: ${e}`);
  }

  try {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS mini_motifs`);
    messages.push("Dropped miniMotif table");
  } catch (e) {
    messages.push(`Error dropping mini_motifs: ${e}`);
  }

  return { success: true, message: messages.join(". ") };
}

// ──────────────────────────────────────────────
// Action: Build database from FASTA file
// ──────────────────────────────────────────────

export async function buildDatabase(
  fileName: string
): Promise<ActionResult> {
  // Validate filename against whitelist to prevent path traversal
  const baseName = path.basename(fileName);
  if (!ALLOWED_FILES.includes(baseName)) {
    return {
      success: false,
      message: "Invalid file name. Only approved FASTA files are allowed.",
    };
  }

  const filePath = path.join(process.cwd(), baseName);

  if (!fs.existsSync(filePath)) {
    return { success: false, message: "File not found on server." };
  }

  const fileString = fs.readFileSync(filePath, "utf-8");

  // Create proteins table
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS proteins (
        id SERIAL PRIMARY KEY,
        locus VARCHAR(250),
        species_number VARCHAR(75),
        species_name VARCHAR(75),
        accession_number VARCHAR(75),
        protein_sequence VARCHAR(2000),
        protein_length INT
      )
    `);
  } catch (e) {
    return { success: false, message: `Error creating proteins table: ${e}` };
  }

  // Create mini_motifs table upfront (avoids race condition with PgBouncer pooling)
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS mini_motifs (
        id SERIAL PRIMARY KEY,
        motif_pattern VARCHAR(75),
        actual_motif VARCHAR(1500),
        accession_number VARCHAR(75),
        species_name VARCHAR(75),
        protein_length INT,
        motif_length INT,
        start_position INT,
        end_position INT
      )
    `);
  } catch (e) {
    return { success: false, message: `Error creating mini_motifs table: ${e}` };
  }

  // Check if already built
  try {
    const count = await prisma.$queryRaw<{ row_count: bigint }[]>`
      SELECT COUNT(*) AS row_count FROM proteins
    `;
    if (Number(count[0]?.row_count) > 0) {
      return { success: false, message: "Database already built" };
    }
  } catch {
    // Table just created, proceed
  }

  // Parse FASTA file
  const giPattern = /gi\|[0-9]+\|ref/g;
  const accPattern = /ref\|[A-Za-z0-9(.)(_)]+\|/g;
  const locusPattern = /\|\s+[A-Za-z]+[\w\d\s\-:;()/,']+\[/g;
  const seqPattern = /[A-Z][A-Z]{50}[\w\s]+[A-Z]/g;
  const speciesPattern = /\[[\w\s()\-.]*\]/g;

  const giMatches = fileString.match(giPattern) || [];
  const accMatches = fileString.match(accPattern) || [];
  const locusMatches = fileString.match(locusPattern) || [];
  const seqMatches = fileString.match(seqPattern) || [];
  const speciesMatches = fileString.match(speciesPattern) || [];

  const numSeqs = Math.min(
    giMatches.length,
    accMatches.length,
    locusMatches.length,
    seqMatches.length,
    speciesMatches.length
  );

  // Insert proteins in batches of 50
  buildProgress.reset();
  buildProgress.phase = "proteins";

  for (let i = 0; i < numSeqs; i += 50) {
    const batch = [];
    for (let j = i; j < Math.min(i + 50, numSeqs); j++) {
      const lc = locusMatches[j].slice(1, -1).trim();
      const gi = giMatches[j].slice(3, -4);
      const acc = accMatches[j].slice(4, -1);
      const sq = seqMatches[j].substring(4).replace(/\s/g, "");
      const spcNm = speciesMatches[j];
      const seqLen = sq.length;
      batch.push(`('${lc.replace(/'/g, "''")}', '${gi.replace(/'/g, "''")}', '${spcNm.replace(/'/g, "''")}', '${acc.replace(/'/g, "''")}', '${sq}', ${seqLen})`);
    }

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO proteins (locus, species_number, species_name, accession_number, protein_sequence, protein_length)
        VALUES ${batch.join(",\n")}
      `);
      buildProgress.proteinRows = Math.min(i + 50, numSeqs);
    } catch (e) {
      console.error(`Error batch inserting proteins at ${i}: ${e}`);
    }
  }

  // Build miniMotif database
  buildProgress.phase = "minimotifs";
  await buildMinimotifDatabase();

  buildProgress.phase = "done";
  return {
    success: true,
    message: "Protein and MiniMotif Tables are Done Building.",
  };
}

// ──────────────────────────────────────────────
// Internal: Build miniMotif database
// ──────────────────────────────────────────────

async function buildMinimotifDatabase(): Promise<void> {
  const proteins = await prisma.$queryRaw<
    {
      protein_sequence: string;
      accession_number: string;
      species_name: string;
      protein_length: number;
    }[]
  >`SELECT protein_sequence, accession_number, species_name, protein_length FROM proteins`;

  const totalProteins = proteins.length;

  for (let pi = 0; pi < totalProteins; pi++) {
    const protein = proteins[pi];
    const seq = protein.protein_sequence;
    const acc = protein.accession_number;
    const spName = protein.species_name;
    const sqLength = protein.protein_length;

    // Collect all motifs for this protein, then batch insert
    const motifs: {
      pattern: string;
      actual: string;
      length: number;
      start: number;
      end: number;
    }[] = [];

    // Build position index: map each amino acid to its sorted positions
    const posIndex = new Map<string, number[]>();
    for (let i = 0; i < seq.length; i++) {
      const ch = seq[i];
      if (!posIndex.has(ch)) posIndex.set(ch, []);
      posIndex.get(ch)!.push(i);
    }

    for (const first of AMINO_CODES) {
      const firstPositions = posIndex.get(first);
      if (!firstPositions) continue;

      for (const last of AMINO_CODES) {
        const lastPositions = posIndex.get(last);
        if (!lastPositions) continue;

        const pattern = `${first}XX${last}`;

        for (const fi of firstPositions) {
          // Binary search: find first index in lastPositions strictly after fi
          let lo = 0, hi = lastPositions.length;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (lastPositions[mid] <= fi) lo = mid + 1;
            else hi = mid;
          }
          // Emit a motif for every occurrence of `last` after `fi`,
          // bounded by the length of this accession's sequence
          for (let k = lo; k < lastPositions.length; k++) {
            const lj = lastPositions[k];
            const motifLen = lj - fi + 1;
            if (motifLen > sqLength) continue;
            motifs.push({
              pattern,
              actual: seq.substring(fi, lj + 1),
              length: motifLen,
              start: fi + 1,
              end: lj + 1,
            });
          }
        }
      }
    }

    // Batch insert in chunks of 50000
    for (let i = 0; i < motifs.length; i += 50000) {
      const chunk = motifs.slice(i, i + 50000);
      const values = chunk
        .map(
          (m) =>
            `('${m.pattern}', '${m.actual.replace(/'/g, "''")}', '${acc.replace(/'/g, "''")}', '${spName.replace(/'/g, "''")}', ${sqLength}, ${m.length}, ${m.start}, ${m.end})`
        )
        .join(",\n");

      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO mini_motifs (motif_pattern, actual_motif, accession_number, species_name, protein_length, motif_length, start_position, end_position)
          VALUES ${values}
        `);
        buildProgress.miniMotifRows += chunk.length;
      } catch (e) {
        console.error(`Error batch inserting motifs: ${e}`);
      }
    }

    buildProgress.miniMotifPercent = Math.round(((pi + 1) / totalProteins) * 100);
  }
}

// ──────────────────────────────────────────────
// Action: Search motif analytics
// ──────────────────────────────────────────────

export async function searchMotif(
  startMotif: string,
  endMotif: string,
  queryIndex: number
): Promise<SearchResult> {
  // Validate input characters are single amino acid letters
  if (!/^[A-Z]$/.test(startMotif) || !/^[A-Z]$/.test(endMotif)) {
    return { headers: [], rows: [] };
  }
  if (queryIndex < 0 || queryIndex > 5) {
    return { headers: [], rows: [] };
  }

  const motifPattern = `${startMotif}XX${endMotif}`;

  const headerSets = [
    ["Accession Number", "Motif Pattern"],
    ["Actual Motif", "Motif Pattern", "Accession Number", "Motif Length"],
    ["Start Position", "Motif Pattern", "Accession Number"],
    ["Accession Number", `Motif Count with Pattern ${motifPattern}`],
    ["Species Name", "Motif Pattern"],
    ["AVG Protein Length", "Motif Patterns"],
  ];

  const headers = headerSets[queryIndex];

  let rawRows: Record<string, unknown>[] = [];

  try {
    switch (queryIndex) {
      case 0:
        rawRows = await prisma.$queryRaw`
          SELECT DISTINCT accession_number AS "accessionNumber", motif_pattern AS "motifPattern"
          FROM mini_motifs
          WHERE motif_pattern = ${motifPattern}
          ORDER BY accession_number
        `;
        break;
      case 1:
        rawRows = await prisma.$queryRaw`
          SELECT actual_motif AS "actualMotif", motif_pattern AS "motifPattern",
                 accession_number AS "accessionNumber", motif_length AS "motifLength"
          FROM mini_motifs
          WHERE motif_pattern = ${motifPattern}
          ORDER BY accession_number, motif_length
        `;
        break;
      case 2:
        rawRows = await prisma.$queryRaw`
          SELECT DISTINCT start_position AS "startPosition", motif_pattern AS "motifPattern",
                 accession_number AS "accessionNumber"
          FROM mini_motifs
          WHERE motif_pattern = ${motifPattern}
          ORDER BY accession_number, start_position
        `;
        break;
      case 3:
        rawRows = await prisma.$queryRaw`
          SELECT DISTINCT accession_number AS "accessionNumber",
                 COUNT(accession_number)::int AS "motifCount"
          FROM mini_motifs
          WHERE motif_pattern = ${motifPattern}
          GROUP BY accession_number
        `;
        break;
      case 4:
        rawRows = await prisma.$queryRaw`
          SELECT DISTINCT species_name AS "speciesName", motif_pattern AS "motifPattern"
          FROM mini_motifs
          WHERE motif_pattern = ${motifPattern}
          ORDER BY species_name
        `;
        break;
      case 5:
        rawRows = await prisma.$queryRaw`
          SELECT AVG(protein_length)::float AS "avgProteinLength", motif_pattern AS "motifPattern"
          FROM mini_motifs
          WHERE motif_pattern = ${motifPattern}
          GROUP BY motif_pattern
        `;
        break;
    }

    // Replace XX with --- in motifPattern for display
    const rows = rawRows.map((row) => {
      const newRow = { ...row };
      if (
        "motifPattern" in newRow &&
        typeof newRow.motifPattern === "string"
      ) {
        newRow.motifPattern = newRow.motifPattern.replace("XX", "---");
      }
      return newRow;
    });

    return { headers, rows };
  } catch (e) {
    console.error("Search error:", e);
    return { headers: [], rows: [] };
  }
}
