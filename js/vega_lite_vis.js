// Refresh chart definitions on each page load so published title edits appear.
const chartLoadVersion = Date.now().toString(36);


var vg_1 = "charts/production_lollipop.vg.json";
var vg_2 = "charts/production_trend.vg.json";
var vg_3 = "charts/growth_heatmap.vg.json";
var vg_4 = "charts/growth_slopegraph.vg.json";

var vg_6 = "charts/production_rank_bump.vg.json";

var vg_8 = "charts/state_growth_choropleth.vg.json";
var vg_9 = "charts/production_value_scatter.vg.json";
var vg_10 = "charts/sankey.vg.json";
var vg_11 = "charts/export_flow_map.vg.json";
var vg_14 = "charts/state_production_small_multiples.vg.json";

// ======================================
// Vega Embed Options
// ======================================

const embedOptions = {
  renderer: "svg",
  actions: true,
  scaleFactor: 3
};

// CSS and Vega read the same typography tokens. Chart geometry can resize,
// but text is measured in screen pixels rather than scaled with an SVG.
const typographyStyle = getComputedStyle(document.documentElement);
const typography = {
  axisTitle: parseFloat(typographyStyle.getPropertyValue("--font-axis-title")),
  label: parseFloat(typographyStyle.getPropertyValue("--font-chart-label")),
  body: parseFloat(typographyStyle.getPropertyValue("--font-body"))
};
// Wait for real font metrics before measuring labels and annotation boxes.
const chartFontsReady = Promise.all([
  document.fonts.load('400 13px "Source Sans 3"'),
  document.fonts.load('600 13px "Source Sans 3"'),
  document.fonts.load('700 13px "Source Sans 3"'),
  document.fonts.load('600 25px "Fraunces"'),
  document.fonts.load('700 56px "Fraunces"')
]);
const chartTypographyUpdates = new WeakMap();
function standardiseVegaTypography(spec) {
  spec.signals ||= [];
  spec.signals.push({ name: "typographyScale", value: 1 });
  const size = value => ({ signal: `${value} * typographyScale` });
  function visit(group) {
    (group.axes || []).forEach(axis => {
      axis.labelFontSize = size(typography.label);
      axis.titleFontSize = size(typography.axisTitle);
      axis.labelFont = axis.titleFont = "'Source Sans 3'";
      axis.labelOverlap = "greedy";
      axis.labelSeparation = 8;
    });
    (group.legends || []).forEach(legend => {
      legend.labelFontSize = size(typography.label);
      legend.titleFontSize = size(typography.body);
      legend.labelFont = legend.titleFont = "'Source Sans 3'";
    });
    (group.marks || []).forEach(mark => {
      if (mark.type === "text") {
        mark.encode ||= {};
        mark.encode.update ||= {};
        // Production-map callouts scale their padding and box with the text.
        if (!mark.encode.update.fontSize?.signal?.includes("annotationScale")) {
          mark.encode.update.fontSize = size(typography.label);
        }
        mark.encode.update.font = { value: "'Source Sans 3'" };
      }
      visit(mark);
    });
  }
  visit(spec);
  return spec;
}
function addChartHeading(target, title) {
  const chart = document.querySelector(target);
  if (!title || chart.closest(".chart-column").querySelector(".map-title, .chart-title")) return;
  const heading = document.createElement("h3");
  heading.className = "chart-title";
  heading.textContent = Array.isArray(title.text) ? title.text.join(" ") : title.text || title;
  chart.before(heading);
  mapHeadingObserver.observe(heading);
}

// Build a single filled arrow from a projected route. Its shaft uses the
// same thickness scale as the legend; the head joins it without seams.
function exportArrowPath(rows, thickness, xField, yField) {
  const points = [...rows].sort((a, b) => a.PathOrder - b.PathOrder)
    .map(row => [Number(row[xField]), Number(row[yField])]);
  if (points.length < 3 || !points.flat().every(Number.isFinite)) return "";
  const [start, control, end] = points;
  const at = t => [
    (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * control[0] + t * t * end[0],
    (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * control[1] + t * t * end[1]
  ];
  const normal = t => {
    const dx = 2 * (1 - t) * (control[0] - start[0]) + 2 * t * (end[0] - control[0]);
    const dy = 2 * (1 - t) * (control[1] - start[1]) + 2 * t * (end[1] - control[1]);
    const length = Math.hypot(dx, dy) || 1;
    return [-dy / length, dx / length];
  };
  const headLength = Math.max(12, thickness * 2);
  const headWidth = Math.max(8, thickness * 1.9);
  let distance = 0;
  let baseT = 0;
  let previous = end;
  for (let i = 199; i >= 0; i--) {
    const point = at(i / 200);
    const segment = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    if (distance + segment >= headLength) {
      baseT = (i + 1 - (headLength - distance) / segment) / 200;
      break;
    }
    distance += segment;
    previous = point;
  }
  const left = [], right = [];
  for (let i = 0; i <= 120; i++) {
    const t = baseT * i / 120;
    const point = at(t), n = normal(t);
    left.push([point[0] + n[0] * thickness / 2, point[1] + n[1] * thickness / 2]);
    right.push([point[0] - n[0] * thickness / 2, point[1] - n[1] * thickness / 2]);
  }
  const base = at(baseT);
  const dx = end[0] - base[0], dy = end[1] - base[1];
  const length = Math.hypot(dx, dy) || 1;
  const n = [-dy / length, dx / length];
  const outline = [...left,
    [base[0] + n[0] * headWidth / 2, base[1] + n[1] * headWidth / 2], end,
    [base[0] - n[0] * headWidth / 2, base[1] - n[1] * headWidth / 2],
    ...right.reverse()];
  return outline.map((point, index) => `${index ? "L" : "M"}${point.map(value => value.toFixed(3)).join(",")}`).join("") + "Z";
}

function compileExportArrows(spec) {
  vega.expressionFunction("exportArrowPath", exportArrowPath);
  const compiled = vegaLite.compile(spec).spec;
  const route = compiled.marks.find(mark => mark.type === "group" && mark.marks?.some(child => child.type === "line"));
  const line = route.marks.find(mark => mark.type === "line");
  const update = line.encode.update;
  route.data = [{ name: "exportRoute", source: line.from.data, transform: [{ type: "filter", expr: "datum.PathOrder == 0" }] }];
  route.marks = [{
    name: "exportFlowArrow", type: "path", clip: true,
    from: { data: "exportRoute" },
    encode: { update: {
      path: { signal: `exportArrowPath(data('${line.from.data}'), scale('strokeWidth', datum.ExportTonnesNum), '${update.x.field}', '${update.y.field}')` },
      fill: { value: "#8F5601" }, opacity: { value: 0.8 },
      tooltip: update.tooltip, description: update.description,
      ariaRoleDescription: { value: "export flow arrow" }
    } }
  }];
  return compiled;
}

// Size chart callouts to their text, using the same borderless grey as
// the Sankey. Padding and line spacing follow the shared annotation size.
function compileBoxedAnnotations(spec) {
  const context = document.createElement("canvas").getContext("2d");
  context.font = `${typography.label}px "Source Sans 3"`;
  const boxes = new Map();
  spec.layer = spec.layer.flatMap(layer => {
    if (!layer.name?.endsWith("AnnotationText")) return [layer];
    const datum = layer.data.values[0];
    const box = {
      x: datum.x, y: datum.y, fruit: datum.Fruit,
      width: Math.ceil(Math.max(...datum.label.map(line => context.measureText(line).width))) + 16,
      height: datum.label.length * (typography.label + 4) + 12,
      rightAligned: layer.name.startsWith("grape")
    };
    boxes.set(layer.name.split("Annotation")[0], box);
    return [{
      name: layer.name.replace("Text", "Background"),
      data: layer.data,
      mark: { type: "rect", width: box.width, height: box.height, fill: "#eeeeee", stroke: null },
      encoding: { x: layer.encoding.x, y: layer.encoding.y }
    }, layer];
  });
  const compiled = vegaLite.compile(spec).spec;
  compiled.marks.forEach(mark => {
    if (!mark.name?.includes("Annotation")) return;
    const box = boxes.get(mark.name.split("Annotation")[0]);
    if (!box) return;
    const update = mark.encode.update;
    const centre = box.fruit ? `scale('x', ${JSON.stringify(box.fruit)}) + bandwidth('x') / 2` : `scale('x', ${box.x})`;
    const desiredLeft = `${centre}${box.fruit ? ` - ${box.width / 2} * typographyScale` : box.rightAligned ? ` - ${box.width} * typographyScale` : ""}`;
    const left = box.fruit ? desiredLeft : `max(0, min((${desiredLeft}), width - ${box.width} * typographyScale))`;
    const centreY = mark.name.startsWith("orangeAnnotation")
      ? `scale('y', width < 450 ? 260 : ${box.y})` : `scale('y', ${box.y})`;
    const top = `${centreY} - ${box.height / 2} * typographyScale`;
    if (mark.name.endsWith("Background_marks")) {
      delete update.xc; delete update.yc;
      update.x = { signal: left }; update.y = { signal: top };
      update.width = { signal: `${box.width} * typographyScale` };
      update.height = { signal: `${box.height} * typographyScale` };
    } else if (mark.name.endsWith("Text_marks")) {
      update.x = { signal: `(${left}) + 8 * typographyScale` };
      update.y = { signal: `(${top}) + 6 * typographyScale` };
      update.align = { value: "left" }; update.baseline = { value: "top" };
      update.lineHeight = { signal: `${typography.label + 4} * typographyScale` };
    } else if (mark.name.endsWith("Leader_marks")) {
      if (box.fruit) {
        update.y2 = { signal: `(${top}) + ${box.height} * typographyScale` };
      } else {
        const originX = `(${left}) + ${box.width} * typographyScale`;
        const originY = `${centreY} - 8 * typographyScale`;
        update.x = { signal: originX };
        update.y = { signal: originY };
        // Reach slightly inside the coloured fill so the marker's white
        // outline and antialiasing cannot leave a visible connector gap.
        const point = spec.layer.find(layer => layer.mark?.type === "point").mark;
        const radius = Math.max(0, Math.sqrt(point.size) / 2 - (point.strokeWidth || 0) / 2 - 0.25);
        const targetX = "scale('x', datum.x2)", targetY = "scale('y', datum.y2)";
        const dx = `((${targetX}) - (${originX}))`, dy = `((${targetY}) - (${originY}))`;
        const distance = `max(1, sqrt(pow(${dx}, 2) + pow(${dy}, 2)))`;
        update.x2 = { signal: `(${targetX}) - ${dx} * ${radius} / ${distance}` };
        update.y2 = { signal: `(${targetY}) - ${dy} * ${radius} / ${distance}` };
      }
    }
  });
  return compiled;
}

// Keep the heatmap explanation in a reserved white band. The connector
// drops vertically from the box to the selected growth cell.
function compileHeatmapAnnotation(spec) {
  const note = spec.usermeta.annotation;
  const context = document.createElement("canvas").getContext("2d");
  context.font = `${typography.label}px "Source Sans 3"`;
  const boxWidth = Math.ceil(Math.max(...note.lines.map(line => context.measureText(line).width))) + 16;
  const boxHeight = note.lines.length * (typography.label + 4) + 12;
  spec.padding = { top: 12, left: 0, right: 0, bottom: 0 };
  const compiled = vegaLite.compile(spec).spec;
  // A bottom legend leaves enough room for all four years on phones.
  compiled.legends.forEach(legend => {
    legend.orient = { signal: "width < 350 ? 'bottom' : 'right'" };
    legend.direction = { signal: "width < 350 ? 'horizontal' : 'vertical'" };
    legend.gradientLength = { signal: "width < 350 ? min(220, width) : 300" };
  });
  const top = -(boxHeight + 24);
  const cx = `scale('x', '2022') + bandwidth('x') / 2`;
  const left = `max(0, (${cx}) - ${boxWidth / 2})`;
  const cy = `scale('y', 'Avocado') + bandwidth('y') / 2`;
  const connectorPath = { signal: `'M' + (${cx}) + ',${top + boxHeight} L' + (${cx}) + ',' + (${cy})` };
  // A white outline keeps the single vertical connector distinct from
  // both pale and dark cells without changing the heatmap's colour scale.
  compiled.marks.push({ name: "avocadoGrowthConnectorOutline", type: "path", aria: false, encode: { update: {
    path: connectorPath, fill: { value: null }, stroke: { value: "#ffffff" },
    strokeWidth: { value: 4 }, strokeCap: { value: "round" }
  }}}, { name: "avocadoGrowthConnector", type: "path", encode: { update: {
    path: connectorPath,
    fill: { value: null }, stroke: { value: "#333333" }, strokeWidth: { value: 1.5 }, strokeCap: { value: "round" },
    description: { value: "Connector to the Avocado 2022 growth cell" }
  }}}, { name: "avocadoGrowthBox", type: "rect", encode: { update: {
    x: { signal: left }, y: { value: top }, width: { value: boxWidth }, height: { value: boxHeight },
    fill: { value: "#eeeeee" }, stroke: { value: null }, tooltip: { value: note.text }
  }}}, { name: "avocadoGrowthText", type: "text", encode: { update: {
    x: { signal: `(${left}) + 8` }, y: { value: top + 6 }, text: { value: note.lines },
    align: { value: "left" }, baseline: { value: "top" },
    lineHeight: { value: typography.label + 4 }, fill: { value: "#333333" },
    href: { value: note.source }, tooltip: { value: "Context: Rabobank, July 2022. Click to read the source." }
  }}});
  return compiled;
}

function compileProductionMap(spec) {
  const context = document.createElement("canvas").getContext("2d");
  context.font = `${typography.label}px "Source Sans 3"`;
  const boxes = new Map();
  spec.layer.filter(layer => layer.name?.endsWith("AnnotationText")).forEach(layer => {
    const lines = JSON.parse(layer.transform.find(transform => transform.as === "NoteLines").calculate);
    boxes.set(layer.name.split("Annotation")[0], {
      width: Math.ceil(Math.max(...lines.map(line => context.measureText(line).width))) + 16,
      height: lines.length * (typography.label + 2) + 16
    });
  });
  spec.layer.filter(layer => layer.name?.endsWith("AnnotationBackground")).forEach(layer => {
    Object.assign(layer.mark, boxes.get(layer.name.split("Annotation")[0]));
  });
  const compiled = vegaLite.compile(spec).spec;
  compiled.signals.push({ name: "annotationScale", value: 1 });
  compiled.marks.forEach(mark => {
    if (!mark.name?.includes("Annotation")) return;
    const update = mark.encode.update;
    const box = boxes.get(mark.name.split("Annotation")[0]);
    // Geographic rectangles are centered by Vega-Lite. Anchor these callout
    // boxes at their top-left so their text and connectors share that anchor.
    if (mark.name.endsWith("AnnotationBackground_marks")) {
      if (update.xc) { update.x = update.xc; delete update.xc; }
      if (update.yc) { update.y = update.yc; delete update.yc; }
      update.width = { signal: `${box.width} * annotationScale` };
      update.height = { signal: `${box.height} * annotationScale` };
    } else if (mark.name.endsWith("AnnotationText_marks")) {
      update.fontSize = { signal: `${typography.label} * annotationScale` };
      update.dx = { signal: "8 * annotationScale" };
      update.dy = { signal: `(8 + datum.NoteLineIndex * ${typography.label + 2}) * annotationScale` };
    } else if (mark.name.endsWith("AnnotationLeader_marks")) {
      const offset = mark.name.startsWith("banana") ? 0 : box.width;
      update.x = { signal: `datum['${update.x.field}'] + ${offset} * annotationScale` };
      update.y = { signal: `datum['${update.y.field}'] + ${box.height / 2} * annotationScale` };
    }
  });
  return compiled;
}

// Keep headings in HTML and render every chart with the shared typography.
async function embedChart(target, source, options) {
  await chartFontsReady;
  let spec = source;
  if (typeof source === "string") {
    const chartUrl = new URL(source, window.location.href);
    chartUrl.searchParams.set("v", chartLoadVersion);
    const response = await fetch(chartUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load chart: ${source}`);
    spec = await response.json();
  }
  // Match the full divider width. Vega fits labels and legends within this
  // width, reserving only the space they actually need instead of wide gutters.
  const chartElement = document.querySelector(target);
  spec.width = spec.projection ? 1030 : chartElement.clientWidth;
  spec.padding = 0;
  spec.autosize = { type: "fit-x", contains: "padding" };
  if (["#state_production_map", "#state_growth_choropleth"].includes(target)) {
    // These map titles span the full card above the map/sidebar layout.
    delete spec.title;
    spec.width = 720;
  }
  if (target === "#export_flow_map") delete spec.title;
  if (!spec.projection && options.mode !== "vega") {
    spec.height = 400;
    spec.config = {
      ...spec.config,
      // Match the original 720 × 400 plot's automatic tick density,
      // independent of the wider rendered chart.
      axisQuantitative: { tickCount: 10, ...spec.config?.axisQuantitative },
      axisX: { tickCount: 18, ...spec.config?.axisX }
    };
  }
  addChartHeading(target, spec.title);
  delete spec.title;
  if (["#production_trend", "#export_value_per_tonne"].includes(target)) {
    const colour = spec.layer.find(layer => layer.encoding?.color?.legend)?.encoding.color;
    const legend = document.createElement("div");
    legend.className = "inline-chart-legend";
    legend.setAttribute("role", "group");
    legend.setAttribute("aria-label", colour.title);
    const row = document.createElement("div");
    row.className = "inline-chart-legend-row";
    const title = document.createElement("strong");
    title.className = "inline-chart-legend-title";
    title.textContent = colour.title;
    row.append(title);
    colour.scale.domain.forEach((label, index) => {
      const item = document.createElement("span");
      item.className = "inline-chart-legend-item";
      const swatch = document.createElement("span");
      swatch.className = target === "#production_trend" ? "inline-chart-swatch circle" : "inline-chart-swatch";
      swatch.style.backgroundColor = colour.scale.range[index];
      swatch.setAttribute("aria-hidden", "true");
      item.append(swatch, document.createTextNode(label));
      row.append(item);
    });
    legend.append(row);
    if (target === "#export_value_per_tonne") {
      chartElement.parentElement.querySelector(".export-unit-footer").append(legend);
    } else {
      chartElement.after(legend);
    }
    colour.legend = null;
  }
  const compiled = target === "#export_flow_map" ? compileExportArrows(spec)
    : target === "#state_production_map" ? compileProductionMap(spec)
    : target === "#growth_heatmap" ? compileHeatmapAnnotation(spec)
    : ["#production_value_scatter", "#export_value_waterfall"].includes(target) ? compileBoxedAnnotations(spec)
    : options.mode === "vega" ? spec : vegaLite.compile(spec).spec;
  const result = await vegaEmbed(target, standardiseVegaTypography(compiled), { ...options, mode: "vega" });
  let previousWidth;
  let previousScale;
  let pendingLayout = Promise.resolve();
  const updateTypography = () => {
    const svg = chartElement.querySelector("svg.marks");
    if (!svg) return;
    const width = chartElement.clientWidth;
    const scale = 1 / Math.abs(svg.getScreenCTM().a);
    if (width === previousWidth && Math.abs(scale - previousScale) < 0.0001) return;
    previousWidth = width;
    previousScale = scale;
    pendingLayout = pendingLayout.then(async () => {
      if (!spec.projection) result.view.width(width).resize();
      result.view.signal("typographyScale", scale);
      if (target === "#state_production_map") result.view.signal("annotationScale", scale);
      await result.view.runAsync();
      fitChartSvg(svg);
    }).catch(console.error);
  };
  chartTypographyUpdates.set(chartElement, updateTypography);
  const typographyObserver = new ResizeObserver(updateTypography);
  typographyObserver.observe(chartElement);
  typographyObserver.observe(chartElement.querySelector("svg.marks"));
  requestAnimationFrame(updateTypography);
  if (target === "#fruit_sankey") {
    const context = document.createElement("canvas").getContext("2d");
    const labels = result.view.data("destinations").flatMap(row => [row.Destination, `${Number(row.Tonnes).toLocaleString("en-US")} t`]);
    const widths = labels.map(label => {
      context.font = `${typography.label}px "Source Sans 3"`;
      const metrics = context.measureText(label);
      return metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    });
    context.font = `bold ${typography.label}px "Source Sans 3"`;
    const heading = context.measureText("Destination / Use");
    widths.push(heading.actualBoundingBoxLeft + heading.actualBoundingBoxRight);
    await result.view.signal("destinationLabelWidth", Math.max(...widths)).runAsync();
  }
  return result;
}

// Preserve inline emphasis while limiting each rendered narrative line to ten
// words. Breaks adapt to the actual column width rather than fixed word groups.
const narrativeParagraphs = [...document.querySelectorAll(".explanation-column p")];
narrativeParagraphs.forEach(paragraph => {
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const fragment = document.createDocumentFragment();
    for (const part of node.textContent.match(/\s+|\S+/g) || []) {
      if (/^\s+$/.test(part) || !/[\p{L}\p{N}]/u.test(part)) fragment.append(document.createTextNode(part));
      else {
        const word = document.createElement("span");
        word.className = "narrative-word";
        word.textContent = part;
        fragment.append(word);
      }
    }
    node.replaceWith(fragment);
  });
});
// Choose paragraph-wide line breaks instead of cutting each natural line
// after its tenth word. Balance the ragged edge without stretching spaces.
const narrativeMeasureContext = document.createElement("canvas").getContext("2d");
function limitNarrativeLines() {
  narrativeParagraphs.forEach(paragraph => {
    paragraph.querySelectorAll(".word-limit-break").forEach(br => br.remove());
    const words = [...paragraph.querySelectorAll(".narrative-word")];
    if (!words.length) return;
    const column = paragraph.closest(".explanation-column");
    const style = getComputedStyle(column);
    const columns = Number(style.columnCount) || 1;
    const gap = parseFloat(style.columnGap) || 0;
    const columnWidth = (column.clientWidth - gap * (columns - 1)) / columns;
    const available = Math.min(paragraph.clientWidth, columnWidth) - 1;
    const widths = [], spaces = [], starts = [0];
    words.forEach((word, index) => {
      narrativeMeasureContext.font = elementCanvasFont(word);
      widths.push(narrativeMeasureContext.measureText(word.textContent).width);
      spaces.push(narrativeMeasureContext.measureText(" ").width);
      starts.push(starts[index] + widths[index] + spaces[index]);
    });
    const lineWidth = (start, end) => starts[end] - starts[start] - spaces[end - 1];
    const costs = Array(words.length + 1).fill(Infinity);
    const nextBreak = Array(words.length).fill(-1);
    costs[words.length] = 0;
    for (let start = words.length - 1; start >= 0; start--) {
      for (let end = start + 1; end <= Math.min(start + 10, words.length); end++) {
        const used = lineWidth(start, end);
        if (used > available && end > start + 1) break;
        // Keep names such as "table grapes" together.
        if (end < words.length) {
          const highlight = words[end - 1].closest(".fruit-highlight");
          if (highlight && highlight === words[end].closest(".fruit-highlight")) continue;
        }
        const remainingSpace = Math.max(0, available - used);
        let cost = remainingSpace ** 2 + costs[end];
        if (end === words.length && end - start < 3 && words.length > 10) {
          cost += available ** 2; // Avoid isolated one- or two-word endings.
        }
        if (end < words.length && /^(a|an|the|and|or|to|of|in|for|with)$/i.test(words[end - 1].textContent)) {
          cost += available * 10;
        }
        if (cost < costs[start]) { costs[start] = cost; nextBreak[start] = end; }
      }
    }
    // Fall back to bounded chunks if an exceptionally long name cannot fit.
    for (let start = 0; start < words.length;) {
      const end = nextBreak[start] > start ? nextBreak[start] : Math.min(start + 10, words.length);
      if (end < words.length) {
        const br = document.createElement("br");
        br.className = "word-limit-break";
        words[end].before(br);
      }
      start = end;
    }
  });
}

const narrativeWidths = new WeakMap();
let narrativeFrame;
const narrativeObserver = new ResizeObserver(entries => {
  let changed = false;
  entries.forEach(({ target, contentRect }) => {
    if (contentRect.width !== narrativeWidths.get(target)) changed = true;
    narrativeWidths.set(target, contentRect.width);
  });
  if (!changed) return;
  cancelAnimationFrame(narrativeFrame);
  narrativeFrame = requestAnimationFrame(limitNarrativeLines);
});
document.querySelectorAll(".explanation-column").forEach(column => narrativeObserver.observe(column));
document.fonts.ready.then(limitNarrativeLines);

// Footer citations wrap naturally so full URLs remain on their own lines.

// ======================================
// Section 01
// Current Production Snapshot
// ======================================

embedChart(
  "#production_lollipop",
  vg_1,
  embedOptions
).catch(console.error);

// ======================================
// Section 02
// Production Over Time
// ======================================

embedChart(
  "#production_trend",
  vg_2,
  embedOptions
).catch(console.error);

embedChart(
  "#growth_heatmap",
  vg_3,
  embedOptions
).catch(console.error);

embedChart(
  "#growth_slopegraph",
  vg_4,
  embedOptions
).catch(console.error);

embedChart(
  "#production_rank_bump",
  vg_6,
  embedOptions
).catch(console.error);

// ======================================
// Section 03
// State and Territory Distribution
// ======================================

embedChart(
  "#state_growth_choropleth",
  vg_8,
  embedOptions
).then(() => {
  const bindings = document.querySelector("#state_growth_choropleth .vega-bindings");
  if (bindings) document.getElementById("choropleth-map-controls").appendChild(bindings);
}).catch(console.error);

// ======================================
// Section 04
// Production vs Value
// ======================================

embedChart(
  "#production_value_scatter",
  vg_9,
  embedOptions
).catch(console.error);

// ======================================
// Section 05
// Allocation and Exports
// ======================================

embedChart(
  "#fruit_sankey",
  vg_10,
  {
    ...embedOptions,
    mode: "vega"
  }
).catch(console.error);

embedChart(
  "#export_flow_map",
  vg_11,
  embedOptions
).then(result => {
  const chart = document.getElementById("export_flow_map");
  const bindings = chart.querySelector(".vega-bindings");
  if (bindings) document.getElementById("export-map-controls").appendChild(bindings);
  const legend = document.getElementById("export-volume-legend");
  const scale = result.view.scale("strokeWidth");
  const swatches = [];
  [10000, 20000, 30000, 40000].forEach(volume => {
    const item = document.createElement("div");
    item.className = "export-volume-item";
    const swatch = document.createElement("span");
    swatch.className = "export-volume-swatch";
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = volume.toLocaleString("en-US");
    item.append(swatch, label);
    legend.append(item);
    swatches.push({ swatch, volume });
  });
  const sizeLegend = () => {
    const ratio = chart.clientWidth / Number(chart.querySelector("svg.marks").getAttribute("width"));
    swatches.forEach(({ swatch, volume }) => {
      swatch.style.height = `${scale(volume) * ratio}px`;
    });
  };
  new ResizeObserver(sizeLegend).observe(chart);
  sizeLegend();
}).catch(console.error);

embedChart("#export_value_per_tonne", "charts/export_value_per_tonne.vg.json", embedOptions).catch(console.error);

// ======================================
// State production: one map with fruit and year controls.
// A fixed symbol scale makes production comparable across selections.
// ======================================

embedChart("#state_production_map", vg_14, embedOptions)
  .then(result => {
    const bindings = document.querySelector("#state_production_map .vega-bindings");
    if (bindings) {
      document.getElementById("production-map-controls").appendChild(bindings);
    }

  })
  .catch(console.error);

// ======================================
// Responsive chart scaling
// Give SVGs a viewBox so they fill the available width without distortion.
// ======================================

const observedChartSvgs = new WeakSet();
function trimMapInset(svg) {
  if (!svg.closest("#state_production_map, #state_growth_choropleth")) return;
  const height = Number(svg.getAttribute("height"));
  const inverse = svg.getScreenCTM()?.inverse();
  if (!inverse) return;
  const edges = [];
  svg.querySelectorAll(".role-mark").forEach(mark => {
    const bounds = mark.getBBox();
    if (!bounds.width || !bounds.height) return;
    const matrix = inverse.multiply(mark.getScreenCTM());
    edges.push(...[[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y + bounds.height]]
      .map(([x, y]) => matrix.a * x + matrix.c * y + matrix.e));
  });
  if (!edges.length) return;
  const left = Math.min(...edges);
  const width = Math.max(...edges) - left;
  svg.setAttribute("viewBox", `${left} 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
}
const labelTransforms = new WeakMap();
const textMeasureContext = document.createElement("canvas").getContext("2d");
const mapHeadingObserver = new ResizeObserver(entries => {
  entries.forEach(({ target }) => {
    textMeasureContext.font = elementCanvasFont(target);
    const metrics = textMeasureContext.measureText(target.textContent);
    target.style.transform = `translateX(${metrics.actualBoundingBoxLeft}px)`;
  });
});
document.querySelectorAll(".map-title, .chart-title").forEach(title => mapHeadingObserver.observe(title));
function elementCanvasFont(element) {
  const style = getComputedStyle(element);
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}
function alignLabelInk(svg) {
  const shell = svg.closest(".chart-shell").getBoundingClientRect();
  const sankeyLeft = ".fruitLabels text, .fruitValues text, .fruitHeading text";
  const sankeyRight = ".destinationLabels text, .destinationValues text, .destinationHeading text";
  const destinationWidths = [...svg.querySelectorAll(sankeyRight)].map(label => {
    textMeasureContext.font = elementCanvasFont(label);
    const metrics = textMeasureContext.measureText(label.textContent);
    return (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) * Math.abs(label.getScreenCTM().a);
  });
  const destinationLeft = shell.right - Math.max(0, ...destinationWidths);
  svg.querySelectorAll(`.role-title-text text, .role-axis-title text, ${sankeyLeft}, ${sankeyRight}`).forEach(label => {
    const isTitle = label.closest(".role-title-text");
    const isSankey = label.matches(`${sankeyLeft}, ${sankeyRight}`);
    const alignRight = label.matches(sankeyRight);
    if (!isTitle && !isSankey && !label.getAttribute("transform")?.includes("rotate(-90)")) return;
    const previous = labelTransforms.get(label);
    const current = label.getAttribute("transform") || "";
    const original = previous && current === previous.aligned ? previous.original : current;
    label.setAttribute("transform", original);
    const matrix = label.getScreenCTM();
    if (!matrix) return;
    textMeasureContext.font = elementCanvasFont(label);
    const metrics = textMeasureContext.measureText(label.querySelector("tspan")?.textContent || label.textContent);
    const anchor = label.getAttribute("text-anchor");
    const offset = anchor === "middle" ? -metrics.width / 2 : anchor === "end" ? -metrics.width : 0;
    const left = offset - metrics.actualBoundingBoxLeft;
    const right = offset + metrics.actualBoundingBoxRight;
    const top = -metrics.actualBoundingBoxAscent;
    const bottom = metrics.actualBoundingBoxDescent;
    const inkEdges = [[left, top], [right, top], [left, bottom], [right, bottom]]
      .map(([x, y]) => matrix.a * x + matrix.c * y + matrix.e);
    const delta = (alignRight ? destinationLeft : shell.left) - Math.min(...inkEdges);
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if (!determinant) return;
    const aligned = `${original} translate(${matrix.d * delta / determinant},${-matrix.b * delta / determinant})`;
    label.setAttribute("transform", aligned);
    labelTransforms.set(label, { original, aligned });
  });
}
function fitChartSvg(svg) {
  trimMapInset(svg);
  requestAnimationFrame(() => chartTypographyUpdates.get(svg.closest(".chart-shell"))?.());
  if (observedChartSvgs.has(svg)) {
    alignLabelInk(svg);
    return;
  }
  const width = parseFloat(svg.getAttribute("width"));
  const height = parseFloat(svg.getAttribute("height"));
  if (!width || !height) return;
  if (!svg.hasAttribute("viewBox")) {
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  observedChartSvgs.add(svg);
  alignLabelInk(svg);
}
new MutationObserver(() => {
  document.querySelectorAll(".chart-column .vega-embed svg.marks").forEach(fitChartSvg);
}).observe(document.body, { childList: true, subtree: true });
