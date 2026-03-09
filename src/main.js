
// npm run excel:sync to update data from the spreadsheet, then refresh this page to see changes
// npm run dev to start the local server with the organization map at http://localhost:5173

import "./style.css";
import * as d3 from "d3";

document.querySelector("#app").innerHTML = `
  <div id="wrap">
    <svg id="svg"></svg>

    <div id="header">
      <h1>Research Network</h1>
      <h2>Explore the map</h2>
      <p>
      This interactive map presents the CITCEA-UPC Energy Team.<br><br>
      Hover over a node to reveal its connections.<br>
      Use the legend to highlight different relationship types.<br>
      Drag nodes to adjust the layout.<br><br>
      For further information or questions, please contact vinicius.gadelha@upc.edu.
    </p>
    </div>

    <div id="legend">
      <div id="legend-title">Connections</div>
      <div id="legend-items"></div>
    </div>

    <div id="detail-panel">
      <button id="detail-close">&times;</button>
      <img id="detail-photo" src="" alt="" />
      <div id="detail-name"></div>
      <div id="detail-meta"></div>
      <div id="detail-description"></div>
      <div id="detail-links"></div>
    </div>

    <div id="search-box">
      <input id="search-input" type="text" placeholder="Search nodes, clusters, connections…" autocomplete="off" />
      <div id="search-results"></div>
    </div>
  </div>
`;

const svgEl = document.querySelector("#svg");

async function buildMap() {
  const [nodesRaw, linksRaw, edgeTypesRaw] = await Promise.all([
    fetch("/data/nodes.json").then((r) => r.json()),
    fetch("/data/edges.json").then((r) => r.json()),
    fetch("/data/edge_types.json").then((r) => r.json()),
  ]);

  const nodes = nodesRaw.map((d) => ({ ...d }));
  const links = linksRaw.map((d, idx) => ({ _idx: idx, ...d }));

  const edgeColorByType = new Map(
    (edgeTypesRaw || []).map((t) => [String(t.id).toLowerCase(), t.color])
  );
  const getEdgeColor = (type) =>
    edgeColorByType.get(String(type ?? "").toLowerCase()) ?? "#8f8f8f";

  const edgeLabelByType = new Map(
    (edgeTypesRaw || []).map((t) => [String(t.id).toLowerCase(), t.label])
  );
  const getEdgeLabel = (type) =>
    edgeLabelByType.get(String(type ?? "").toLowerCase()) ?? "";

  const width = svgEl.clientWidth || 1200;
  const height = svgEl.clientHeight || 800;

  const svg = d3
    .select(svgEl)
    .attr("viewBox", [0, 0, width, height])
    .style("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial");

  svg.selectAll("*").remove();
  const defs = svg.append("defs");
  const g = svg.append("g");

  // Zoom/pan with sensible scale limits to keep users from zooming too much
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

  // Start zoomed out so the full map is visible
  svg.call(zoom.transform, d3.zoomIdentity.scale(0.6).translate(width * 0.15, height * 0.15));
  svg.on("dblclick.zoom", null); // disable built-in dblclick zoom
  svg.on("dblclick", (event) => {
    if (event.target !== svgEl) return;
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
  });

  // -------------------------------------------------------
  // FIXED symmetric triangle cluster circles (KEEP SIZE)
  // -------------------------------------------------------
  const clusterNames = ["People", "Projects", "Industry"];

  const centers = (() => {
    const cx = width * 0.52;
    const cy = height * 0.55;
    const R = Math.min(width, height) * 0.546;

    const top = { x: cx, y: cy - R };
    const bl = {
      x: cx + R * Math.cos((150 * Math.PI) / 180),
      y: cy + R * Math.sin((150 * Math.PI) / 180),
    };
    const br = {
      x: cx + R * Math.cos((30 * Math.PI) / 180),
      y: cy + R * Math.sin((30 * Math.PI) / 180),
    };

    return {
      Core: { x: cx, y: cy + R * 0.18 },
      People: top,
      Industry: bl,
      Projects: br,
    };
  })();

  // Per-cluster radii — People is 2× to accommodate more nodes
  const BASE_CLUSTER_R = Math.min(width, height) * 0.208;
  const CLUSTER_R = {
    People:   BASE_CLUSTER_R * 1.8,
    Projects: BASE_CLUSTER_R * 1.25,
    Industry: BASE_CLUSTER_R * 1.25,
  };

  const CLUSTER_COLOR = {
    Core:     "#2563eb",
    People:   "#8b5cf6",
    Projects: "#10b981",
    Industry: "#e11d48",
  };

  const circleLayer = g.append("g").style("pointer-events", "none");
  const circlesG = circleLayer.selectAll("g").data(clusterNames).join("g");

  circlesG
    .append("circle")
    .attr("cx", (d) => centers[d].x)
    .attr("cy", (d) => centers[d].y)
    .attr("r", (d) => CLUSTER_R[d] ?? BASE_CLUSTER_R)
    .attr("fill", "none")
    .attr("stroke", (d) => CLUSTER_COLOR[d])
    .attr("stroke-width", 12)
    .attr("stroke-opacity", 0.75)
    .attr("stroke-dasharray", "32,15");

  circlesG
    .append("text")
    .attr("x", (d) => centers[d].x)
    .attr("y", (d) => centers[d].y + (CLUSTER_R[d] ?? BASE_CLUSTER_R) + 36)
    .attr("text-anchor", "middle")
    .attr("font-family", "ui-serif, Georgia, 'Times New Roman', serif")
    .attr("font-size", 32)
    .attr("font-weight", 700)
    .attr("fill", (d) => CLUSTER_COLOR[d])
    .text((d) => d === "People" ? "Team" : d);

  // "Professors" label for the Core (virtual) cluster
  circleLayer.append("text")
    .attr("x", centers.Core.x)
    .attr("y", centers.Core.y + BASE_CLUSTER_R * 1.045 + 36)
    .attr("text-anchor", "middle")
    .attr("font-family", "ui-serif, Georgia, 'Times New Roman', serif")
    .attr("font-size", 32)
    .attr("font-weight", 700)
    .attr("fill", CLUSTER_COLOR.Core)
    .text("Professors");

  // Seed node positions near cluster centers (smaller jitter)
  nodes.forEach((n) => {
    const c = centers[n.cluster] ?? centers.Core;
    n.x = c.x + (Math.random() - 0.5) * 18;
    n.y = c.y + (Math.random() - 0.5) * 18;
  });

  // -------------------------------------------------------
  // Neighbor lookup
  // -------------------------------------------------------
  const neighborMap = new Map(nodes.map((n) => [n.id, new Set([n.id])]));
  links.forEach((l) => {
    const s = typeof l.source === "string" ? l.source : l.source?.id;
    const t = typeof l.target === "string" ? l.target : l.target?.id;
    if (!s || !t) return;
    neighborMap.get(s)?.add(t);
    neighborMap.get(t)?.add(s);
  });

  // -------------------------------------------------------
  // SCALE DOWN everything else: nodes/edges/labels
  // -------------------------------------------------------
  const NODE_R_CORE = 42;
  const NODE_R_OTHER = 30;

  const NODE_LABEL_SIZE = 18;
  const NODE_LABEL_Y_CORE = 56;
  const NODE_LABEL_Y_OTHER = 46;

  const EDGE_W = 8.0;

  const EDGE_LABEL_SIZE = 18;
  const EDGE_LABEL_PAD_X = 8;
  const EDGE_LABEL_PAD_Y = 4;
  const EDGE_LABEL_OFFSET = 0;

  function nodeFill(d) {
    return CLUSTER_COLOR[d.cluster] ?? "#999";
  }

  // LINKS (hidden by default)
  const link = g
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", (d) => getEdgeColor(d.type))
    .attr("stroke-width", EDGE_W)
    .attr("stroke-opacity", 0);

  // EDGE LABELS (small)
  const labelLayer = g
    .append("g")
    .attr("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial")
    .attr("font-size", EDGE_LABEL_SIZE)
    .attr("font-weight", 700)
    .attr("letter-spacing", "0.01em")
    .attr("text-anchor", "middle")
    .style("pointer-events", "none")
    .style("user-select", "none");

  const edgeLabelG = labelLayer
    .selectAll("g")
    .data(links)
    .join("g")
    .attr("opacity", 0);

  edgeLabelG
    .append("rect")
    .attr("rx", 2)
    .attr("ry", 2)
    .attr("fill", (d) => getEdgeColor(d.type))
    .attr("opacity", 0.92);

  edgeLabelG
    .append("text")
    .attr("fill", "#fff")
    .attr("dy", "0.35em")
    .text((d) => getEdgeLabel(d.type));

  function updateEdgeLabelBoxes() {
    edgeLabelG.each(function () {
      const group = d3.select(this);
      const text = group.select("text").node();
      const rect = group.select("rect");
      if (!text) return;

      const bbox = text.getBBox();
      rect
        .attr("x", bbox.x - EDGE_LABEL_PAD_X)
        .attr("y", bbox.y - EDGE_LABEL_PAD_Y)
        .attr("width", bbox.width + EDGE_LABEL_PAD_X * 2)
        .attr("height", bbox.height + EDGE_LABEL_PAD_Y * 2);
    });
  }

  // Per-node circular clip paths for photo masking
  nodes.forEach((n) => {
    const r = n.cluster === "Core" ? NODE_R_CORE : NODE_R_OTHER;
    defs.append("clipPath")
      .attr("id", `clip-${n.id}`)
      .append("circle")
      .attr("r", r);
  });

  // NODES
  const node = g
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .style("cursor", "grab");

  // 1. Background fill — visible as fallback if photo fails to load
  node
    .append("circle")
    .attr("r", (d) => (d.cluster === "Core" ? NODE_R_CORE : NODE_R_OTHER))
    .attr("fill", nodeFill);

  // 2. Photo / avatar image, clipped to the circle
  node
    .append("image")
    .attr("href", (d) => `/images/nodes/${d.photo}`)
    .attr("x", (d) => -(d.cluster === "Core" ? NODE_R_CORE : NODE_R_OTHER))
    .attr("y", (d) => -(d.cluster === "Core" ? NODE_R_CORE : NODE_R_OTHER))
    .attr("width",  (d) => (d.cluster === "Core" ? NODE_R_CORE : NODE_R_OTHER) * 2)
    .attr("height", (d) => (d.cluster === "Core" ? NODE_R_CORE : NODE_R_OTHER) * 2)
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("clip-path", (d) => `url(#clip-${d.id})`)
    .style("pointer-events", "none");

  // 3. Border ring drawn on top of the image
  node
    .append("circle")
    .attr("r", (d) => (d.cluster === "Core" ? NODE_R_CORE : NODE_R_OTHER))
    .attr("fill", "none")
    .attr("stroke", "rgba(255,255,255,0.9)")
    .attr("stroke-width", 2.5);

  node
    .append("text")
    .text((d) => d.name)
    .attr("y", (d) => (d.cluster === "Core" ? NODE_LABEL_Y_CORE : NODE_LABEL_Y_OTHER))
    .attr("text-anchor", "middle")
    .attr("font-size", NODE_LABEL_SIZE)
    .attr("font-weight", 600)
    .attr("fill", "rgba(0,0,0,0.70)")
    .style("pointer-events", "none");

  // -------------------------------------------------------
  // Forces (tighten so nodes stay inside clusters)
  // -------------------------------------------------------
  const sim = d3
    .forceSimulation(nodes)
    .velocityDecay(0.65)
    .force(
      "link",
      d3.forceLink(links).id((d) => d.id).strength(0).distance(200)
    )
    .force("charge", d3.forceManyBody().strength((d) => d.cluster === "People" ? -700 : d.cluster === "Core" ? -600 : -400).distanceMax(BASE_CLUSTER_R * 2.0))
    .force("collide", d3.forceCollide((d) => (d.cluster === "People" ? 90 : 75)))
    .force("x", d3.forceX((d) => (centers[d.cluster] ?? centers.Core).x).strength(0.05))
    .force("y", d3.forceY((d) => (centers[d.cluster] ?? centers.Core).y).strength(0.05));

  // Keep nodes inside their cluster circle
  // Virtual radius for the Core cluster (invisible, just for confinement)
  const CORE_CLUSTER_R = BASE_CLUSTER_R * 1.045;

  function constrainToCircle(n) {
    const c = centers[n.cluster] ?? centers.Core;
    const maxR = n.cluster === "Core"
      ? CORE_CLUSTER_R - (NODE_R_CORE + 6)
      : (CLUSTER_R[n.cluster] ?? BASE_CLUSTER_R) - (NODE_R_OTHER + 6);

    const dx = n.x - c.x;
    const dy = n.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxR && dist > 0) {
      const k = maxR / dist;
      n.x = c.x + dx * k;
      n.y = c.y + dy * k;
    }
  }

  // -------------------------------------------------------
  // Hover behavior
  // -------------------------------------------------------
  const BASE_NODE_OPACITY = 1;
  const FADE_NODE_OPACITY = 0.15;

  const SHOW_LINK_OPACITY = 0.85;
  const FADE_LINK_OPACITY = 0.05;

  function edgeTouches(edge, nodeId) {
    const s = edge.source?.id ?? edge.source;
    const t = edge.target?.id ?? edge.target;
    return s === nodeId || t === nodeId;
  }

  let legendActive = false;
  let pinnedNodeId = null;
  let pinnedLegendType = null;

  function highlightNode(nodeId) {
    const neigh = neighborMap.get(nodeId) ?? new Set([nodeId]);

    node.select("circle").attr("opacity", (d) => (neigh.has(d.id) ? 1 : FADE_NODE_OPACITY));
    node.select("text").attr("opacity", (d) => (neigh.has(d.id) ? 1 : 0.25));

    link
      .attr("stroke-opacity", (d) => (edgeTouches(d, nodeId) ? SHOW_LINK_OPACITY : FADE_LINK_OPACITY))
      .attr("stroke-width", EDGE_W);

    edgeLabelG.attr("opacity", (d) => (edgeTouches(d, nodeId) && getEdgeLabel(d.type) ? 1 : 0));
  }

  function clearHighlights() {
    node.select("circle").attr("opacity", BASE_NODE_OPACITY);
    node.select("text").attr("opacity", 1);
    link
      .attr("stroke-opacity", 0)
      .attr("stroke-width", EDGE_W);
    edgeLabelG.attr("opacity", 0);
  }

  node
    .on("mouseenter", (event, d) => {
      if (legendActive || pinnedNodeId || pinnedLegendType) return;
      highlightNode(d.id);
    })
    .on("mouseleave", () => {
      if (legendActive || pinnedNodeId || pinnedLegendType) return;
      clearHighlights();
    });

  svg.on("mouseleave", () => {
    if (legendActive || pinnedNodeId || pinnedLegendType) return;
    clearHighlights();
  });

  // -------------------------------------------------------
  // Detail panel: open on node click
  // -------------------------------------------------------
  const detailPanel = document.querySelector("#detail-panel");
  let activeNodeId = null;

  function openDetailPanel(d) {
    document.querySelector("#detail-photo").src = `/images/nodes/${d.photo}`;
    document.querySelector("#detail-photo").alt = d.name;
    document.querySelector("#detail-name").textContent = d.name;
    document.querySelector("#detail-meta").textContent = d.type;

    const descEl = document.querySelector("#detail-description");
    descEl.textContent = d.description ?? "";
    descEl.style.display = d.description ? "block" : "none";

    const linksEl = document.querySelector("#detail-links");
    linksEl.innerHTML = "";
    (d.links ?? []).forEach((l) => {
      const a = document.createElement("a");
      a.href = l.url;
      a.textContent = l.label;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      linksEl.appendChild(a);
    });

    detailPanel.classList.add("open");
    activeNodeId = d.id;
  }

  document.querySelector("#detail-close").addEventListener("click", () => {
    detailPanel.classList.remove("open");
    activeNodeId = null;
    pinnedNodeId = null;
    clearHighlights();
  });

  svg.on("click", () => {
    detailPanel.classList.remove("open");
    activeNodeId = null;
    pinnedNodeId = null;
    pinnedLegendType = null;
    document.querySelectorAll(".legend-row").forEach((r) => r.classList.remove("legend-pinned"));
    clearHighlights();
  });

  node.on("click", (event, d) => {
    event.stopPropagation();
    if (pinnedNodeId === d.id) {
      // unpin — connections disappear, panel closes
      pinnedNodeId = null;
      clearHighlights();
      detailPanel.classList.remove("open");
      activeNodeId = null;
    } else {
      // pin this node's connections
      pinnedNodeId = d.id;
      pinnedLegendType = null;
      document.querySelectorAll(".legend-row").forEach((r) => r.classList.remove("legend-pinned"));
      highlightNode(d.id);
      openDetailPanel(d);
    }
  });

  // -------------------------------------------------------
  // Search bar
  // -------------------------------------------------------
  const searchInput = document.querySelector("#search-input");
  const searchResults = document.querySelector("#search-results");

  // Build a searchable index: name, type, cluster, and connected node names
  function buildSearchIndex() {
    return nodes.map((n) => {
      const connectedNames = [...(neighborMap.get(n.id) ?? [])]
        .filter((id) => id !== n.id)
        .map((id) => nodes.find((x) => x.id === id)?.name ?? "")
        .join(" ");
      return {
        node: n,
        haystack: [n.name, n.type, n.cluster, connectedNames]
          .join(" ").toLowerCase(),
      };
    });
  }

  const searchIndex = buildSearchIndex();

  function focusNode(n) {
    // Pan/zoom to the node
    const t = d3.zoomIdentity
      .translate(svgEl.clientWidth / 2, svgEl.clientHeight / 2)
      .scale(1.6)
      .translate(-n.x, -n.y);
    svg.transition().duration(500).call(zoom.transform, t);
    // Highlight it
    highlightNode(n.id);
    // Open detail panel
    openDetailPanel(n);
    // Clear search
    searchInput.value = "";
    searchResults.innerHTML = "";
  }

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";
    if (!query) return;

    const matches = searchIndex
      .filter((e) => e.haystack.includes(query))
      .sort((a, b) => {
        // Name matches rank first, then type/cluster, then connection matches
        const aName = a.node.name.toLowerCase().includes(query);
        const bName = b.node.name.toLowerCase().includes(query);
        if (aName && !bName) return -1;
        if (!aName && bName) return 1;
        return 0;
      })
      .slice(0, 8);

    matches.forEach(({ node: n }) => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `
        <span class="search-result-name">${n.name}</span>
        <span class="search-result-meta">${n.type} &middot; ${n.cluster}</span>
      `;
      item.addEventListener("click", () => focusNode(n));
      searchResults.appendChild(item);
    });
  });

  // Close results when clicking outside the search box
  document.addEventListener("click", (e) => {
    if (!document.querySelector("#search-box").contains(e.target)) {
      searchResults.innerHTML = "";
    }
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchInput.value = "";
      searchResults.innerHTML = "";
      searchInput.blur();
    }
  });

  // -------------------------------------------------------
  // Legend: hover type -> highlight edges and nodes involved
  // -------------------------------------------------------
  const legendItems = document.querySelector("#legend-items");
  legendItems.innerHTML = "";

  function highlightEdgesByType(typeId) {
    legendActive = true;
    const t = String(typeId).toLowerCase();

    const activeNodeIds = new Set();
    links.forEach((e) => {
      if (String(e.type ?? "").toLowerCase() !== t) return;
      const s = e.source?.id ?? e.source;
      const tg = e.target?.id ?? e.target;
      if (s) activeNodeIds.add(s);
      if (tg) activeNodeIds.add(tg);
    });

    node.select("circle").attr("opacity", (d) => (activeNodeIds.has(d.id) ? 1 : 0.15));
    node.select("text").attr("opacity", (d) => (activeNodeIds.has(d.id) ? 1 : 0.25));

    link
      .attr("stroke-opacity", (d) => (String(d.type ?? "").toLowerCase() === t ? 0.95 : 0.05))
      .attr("stroke-width", EDGE_W);

    edgeLabelG.attr("opacity", (d) => (String(d.type ?? "").toLowerCase() === t && getEdgeLabel(d.type) ? 1 : 0));
  }

  function clearLegendHighlight() {
    legendActive = false;
    clearHighlights();
  }

  (edgeTypesRaw || []).forEach((et) => {
    const row = document.createElement("div");
    row.className = "legend-row";

    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.background = et.color;

    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = et.label;

    row.appendChild(dot);
    row.appendChild(label);

    row.addEventListener("mouseenter", () => {
      if (pinnedNodeId || pinnedLegendType) return;
      highlightEdgesByType(et.id);
    });
    row.addEventListener("mouseleave", () => {
      if (pinnedNodeId || pinnedLegendType) return;
      clearLegendHighlight();
    });
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      if (pinnedLegendType === String(et.id)) {
        // unpin
        pinnedLegendType = null;
        row.classList.remove("legend-pinned");
        clearLegendHighlight();
      } else {
        document.querySelectorAll(".legend-row").forEach((r) => r.classList.remove("legend-pinned"));
        pinnedLegendType = String(et.id);
        pinnedNodeId = null;
        detailPanel.classList.remove("open");
        activeNodeId = null;
        row.classList.add("legend-pinned");
        highlightEdgesByType(et.id);
      }
    });

    legendItems.appendChild(row);
  });

  // Pin all nodes once the simulation settles so they don't drift
  // -------------------------------------------------------
  // Drag: keep pinned where placed
  // -------------------------------------------------------
  node.call(
    d3
      .drag()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.25).restart();
        d3.select(event.sourceEvent.target.closest("g")).style("cursor", "grabbing");
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d3.select(event.sourceEvent.target.closest("g")).style("cursor", "grab");
        // Pin every node where it was dropped
        d.fx = d.x;
        d.fy = d.y;
      })
  );

  // Manual collision resolver for all pinned nodes.
  // Only resolves collisions between nodes in the same cluster so that
  // Core nodes never push outer-cluster nodes (and vice-versa).
  function separateNodes() {
    for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (a.cluster !== b.cluster) continue;
        const ra = a.cluster === "Core" ? NODE_R_CORE : NODE_R_OTHER;
        const rb = b.cluster === "Core" ? NODE_R_CORE : NODE_R_OTHER;
        const minDist = ra + rb + 6;
        const dx = (b.fx ?? b.x) - (a.fx ?? a.x);
        const dy = (b.fy ?? b.y) - (a.fy ?? a.y);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist >= minDist) continue;
        const push = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        if (a.fx != null) { a.fx -= nx * push; a.fy -= ny * push; }
        else { a.x -= nx * push; a.y -= ny * push; }
        if (b.fx != null) { b.fx += nx * push; b.fy += ny * push; }
        else { b.x += nx * push; b.y += ny * push; }
      }
    }
    }
  }

  // -------------------------------------------------------
  // Tick render (includes rotated edge labels)
  // -------------------------------------------------------
  let ticking = false;

  function render() {
    separateNodes();
    nodes.forEach(constrainToCircle);

    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);

    edgeLabelG.attr("transform", (d) => {
      const x1 = d.source.x, y1 = d.source.y;
      const x2 = d.target.x, y2 = d.target.y;

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      const px = -dy / len;
      const py = dx / len;

      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle > 90 || angle < -90) angle += 180;

      return `translate(${mx + px * EDGE_LABEL_OFFSET}, ${my + py * EDGE_LABEL_OFFSET}) rotate(${angle})`;
    });

    updateEdgeLabelBoxes();
    ticking = false;
  }

  sim.on("tick", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(render);
    }
  });

  clearHighlights();
}

buildMap().catch((err) => {
  document.querySelector("#app").insertAdjacentHTML(
    "beforeend",
    `<div style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#b91c1c;color:#fff;padding:10px 18px;border-radius:8px;font-family:sans-serif;font-size:13px;z-index:999">
      Failed to load map data: ${err.message}
    </div>`
  );
});