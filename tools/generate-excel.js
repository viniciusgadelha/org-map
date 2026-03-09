/**
 * generate-excel.js
 * Creates (or overwrites) data.xlsx from the current JSON files.
 * Run once to bootstrap the Excel template, or any time you want to
 * sync JSON → Excel (the reverse of sync-data.js).
 *
 *   npm run excel:generate
 */

import ExcelJS from "exceljs";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dataDir = resolve(root, "public/data");
const outFile = resolve(root, "data.xlsx");

const nodes = JSON.parse(readFileSync(resolve(dataDir, "nodes.json"), "utf8"));
const edges = JSON.parse(readFileSync(resolve(dataDir, "edges.json"), "utf8"));
const edgeTypes = JSON.parse(readFileSync(resolve(dataDir, "edge_types.json"), "utf8"));

const wb = new ExcelJS.Workbook();
wb.creator = "org-map";
wb.created = new Date();

// ── helpers ──────────────────────────────────────────────────────────────────
function addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);

  // Header row — bold, light-blue fill
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 20,
  }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF0F172A" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFBFDBFE" }, // blue-200
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  // Data rows
  rows.forEach((r) => ws.addRow(r));

  // Light border on all filled cells
  const lastRow = rows.length + 1;
  const lastCol = columns.length;
  for (let row = 1; row <= lastRow; row++) {
    for (let col = 1; col <= lastCol; col++) {
      ws.getCell(row, col).border = {
        top:    { style: "thin", color: { argb: "FFE2E8F0" } },
        left:   { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right:  { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    }
  }

  // Freeze header row
  ws.views = [{ state: "frozen", ySplit: 1 }];

  return ws;
}

// ── nodes sheet ──────────────────────────────────────────────────────────────
addSheet(
  wb,
  "nodes",
  [
    { header: "id",      key: "id",      width: 16 },
    { header: "name",    key: "name",    width: 22 },
    { header: "slug",    key: "slug",    width: 22 },
    { header: "type",    key: "type",    width: 14 },
    { header: "cluster", key: "cluster", width: 14 },
    { header: "photo",   key: "photo",   width: 26 },
  ],
  nodes.map((n) => ({
    id:      n.id,
    name:    n.name,
    slug:    n.slug,
    type:    n.type,
    cluster: n.cluster,
    photo:   n.photo ?? "",
  }))
);

// ── edges sheet ──────────────────────────────────────────────────────────────
addSheet(
  wb,
  "edges",
  [
    { header: "source", key: "source", width: 16 },
    { header: "target", key: "target", width: 16 },
    { header: "type",   key: "type",   width: 18 },
  ],
  edges.map((e) => ({
    source: e.source,
    target: e.target,
    type:   e.type,
  }))
);

// ── edge_types sheet ─────────────────────────────────────────────────────────
addSheet(
  wb,
  "edge_types",
  [
    { header: "id",    key: "id",    width: 18 },
    { header: "label", key: "label", width: 22 },
    { header: "color", key: "color", width: 12 },
  ],
  edgeTypes.map((t) => ({ id: t.id, label: t.label, color: t.color }))
);

// ── write ────────────────────────────────────────────────────────────────────
await wb.xlsx.writeFile(outFile);
console.log(`✔  data.xlsx written to ${outFile}`);
