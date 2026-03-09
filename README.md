# Org-Map — CITCEA-UPC Research Network

An interactive browser-based map that visualises the people, projects, and industry partners of the **CITCEA-UPC Energy Team**. Built with [D3.js](https://d3js.org/) and [Vite](https://vitejs.dev/).

![screenshot placeholder](public/images/background.svg)

---

## Features

- **Force-directed graph** with three cluster circles: Team (People), Projects, and Industry, plus a central Professors (Core) group.
- **Node photos** — each node displays a circular avatar pulled from `public/images/nodes/`.
- **Edge types** — connections are colour-coded (Supervision, Collaboration, Works On, Mentors, …) and defined in `public/data/edge_types.json`.
- **Hover & click interactions** — hovering a node or legend entry fades everything else; clicking pins the highlight and opens a detail panel.
- **Search bar** — full-text search across names, types, clusters, and connected-node names.
- **Drag to rearrange** — nodes can be dragged and stay pinned where dropped.
- **Zoom / pan** — scroll to zoom, drag background to pan, double-click background to reset.
- **Excel-driven data** — edit `data.xlsx` and sync back to JSON in one command.

---

## Project Structure

```
org-map/
├── index.html                  # App entry point
├── package.json
├── data.xlsx                   # Master data spreadsheet (git-ignored)
├── public/
│   ├── data/
│   │   ├── nodes.json          # People, projects, industry nodes
│   │   ├── edges.json          # Connections between nodes
│   │   └── edge_types.json     # Edge type definitions (id, label, color)
│   └── images/
│       └── nodes/              # Node avatar photos (<slug>.jpg)
├── src/
│   ├── main.js                 # All app logic (D3 graph, UI, search)
│   └── style.css               # Styles
└── tools/
    ├── generate-excel.js       # JSON → data.xlsx
    └── sync-data.js            # data.xlsx → JSON
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Data Management

All graph data lives in `public/data/`. You can edit the JSON files directly, or use the Excel workflow below.

### Excel workflow (recommended)

| Command | Description |
|---|---|
| `npm run excel:generate` | Exports the current JSON files → `data.xlsx` |
| `npm run excel:sync` | Imports `data.xlsx` → overwrites the JSON files |

`data.xlsx` has three sheets:

| Sheet | JSON file |
|---|---|
| `nodes` | `public/data/nodes.json` |
| `edges` | `public/data/edges.json` |
| `edge_types` | `public/data/edge_types.json` |

> `data.xlsx` is git-ignored. Run `npm run excel:generate` once to create it from the current JSON.

### Node fields

| Field | Description |
|---|---|
| `id` | Unique identifier (e.g. `andreas.sumper`) |
| `name` | Display name |
| `cluster` | `Core`, `People`, `Projects`, or `Industry` |
| `type` | Short role label shown in the detail panel |
| `photo` | Filename in `public/images/nodes/` |
| `description` | Bio / description text (optional) |
| `links` | Array of `{ label, url }` objects (optional) |

### Adding a node photo

Place a `.jpg` file named after the node's `slug` field into `public/images/nodes/`. The recommended size is **200×200 px** or larger (square crop).

---

## Build for Production

```bash
npm run build
```

Output is in `dist/`. Preview the production build locally with:

```bash
npm run preview
```

---

## Tech Stack

- [D3.js v7](https://d3js.org/) — force simulation, SVG rendering
- [Vite v7](https://vitejs.dev/) — dev server and bundler
- [ExcelJS](https://github.com/exceljs/exceljs) — Excel read/write for the data tools

---

## Contact

For questions or contributions, contact **vinicius.gadelha@upc.edu**.
This is an interactive map of the team inside the Energy group of CITCEA-UPC
