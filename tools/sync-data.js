/**
 * sync-data.js
 * Reads data.xlsx and overwrites the three JSON data files.
 * Each worksheet maps to one JSON file:
 *
 *   Sheet "nodes"       → public/data/nodes.json
 *   Sheet "edges"       → public/data/edges.json
 *   Sheet "edge_types"  → public/data/edge_types.json
 *
 * Usage:
 *   npm run excel:sync
 *
 * Rules:
 *   - Rows where the first column is blank are skipped (easy delete in Excel).
 *   - Extra whitespace in cell values is trimmed automatically.
 */

import ExcelJS from "exceljs";
import { writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "..");
const xlsxFile  = resolve(root, "data.xlsx");
const dataDir   = resolve(root, "public/data");

if (!existsSync(xlsxFile)) {
  console.error(`✖  data.xlsx not found at ${xlsxFile}`);
  console.error("   Run  npm run excel:generate  first to create it.");
  process.exit(1);
}

function clean(val) {
  return String(val ?? "").trim();
}

// ExcelJS returns hyperlinked cells as { text, hyperlink } objects.
// This extracts the actual URL regardless of whether the cell is a plain
// string or a hyperlink object.
function cleanUrl(val) {
  if (val && typeof val === "object") {
    return String(val.hyperlink ?? val.text ?? "").trim();
  }
  return String(val ?? "").trim();
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(xlsxFile);

// ── generic sheet → array of objects ─────────────────────────────────────────
function sheetToObjects(name) {
  const ws = wb.getWorksheet(name);
  if (!ws) {
    console.warn(`⚠  Sheet "${name}" not found in data.xlsx — skipping.`);
    return null;
  }

  const rows = [];
  let headers = [];

  ws.eachRow((row, rowNum) => {
    const values = row.values.slice(1); // ExcelJS row.values[0] is always null

    if (rowNum === 1) {
      headers = values.map((h) => clean(h));
      return;
    }

    // Skip blank rows (first cell empty)
    if (!clean(values[0])) return;

    const obj = {};
    headers.forEach((h, i) => {
      // Store raw value for URL columns so hyperlink objects are preserved
      obj[h] = h === "link" ? values[i] : clean(values[i]);
    });
    rows.push(obj);
  });

  return { headers, rows };
}

// ── nodes ─────────────────────────────────────────────────────────────────────
const nodesSheet = sheetToObjects("nodes");
if (nodesSheet) {
  const nodes = nodesSheet.rows.map((r) => ({
    id:          r.id,
    name:        r.name,
    slug:        r.slug,
    type:        r.type,
    cluster:     r.cluster,
    photo:       r.photo       || undefined,
    description: r.description || undefined,
    links:       cleanUrl(r.link)
      ? [{ label: "Google Scholar", url: cleanUrl(r.link) }]
      : undefined,
  }));
  // Remove undefined keys
  const clean_nodes = nodes.map((n) =>
    Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined))
  );
  const outPath = resolve(dataDir, "nodes.json");
  writeFileSync(outPath, JSON.stringify(clean_nodes, null, 2));
  console.log(`✔  nodes.json  — ${clean_nodes.length} rows written`);
}

// ── edges ─────────────────────────────────────────────────────────────────────
const edgesSheet = sheetToObjects("edges");
if (edgesSheet) {
  const edges = edgesSheet.rows.map((r) => ({
    source: r.source,
    target: r.target,
    type:   r.type,
  }));
  const outPath = resolve(dataDir, "edges.json");
  writeFileSync(outPath, JSON.stringify(edges, null, 2));
  console.log(`✔  edges.json  — ${edges.length} rows written`);
}

// ── edge_types ────────────────────────────────────────────────────────────────
const edgeTypesSheet = sheetToObjects("edge_types");
if (edgeTypesSheet) {
  const edgeTypes = edgeTypesSheet.rows.map((r) => ({
    id:    r.id,
    label: r.label,
    color: r.color,
  }));
  const outPath = resolve(dataDir, "edge_types.json");
  writeFileSync(outPath, JSON.stringify(edgeTypes, null, 2));
  console.log(`✔  edge_types.json  — ${edgeTypes.length} rows written`);
}

console.log("\nDone. Refresh your browser to see the changes.");
