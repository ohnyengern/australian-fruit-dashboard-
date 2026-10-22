// Refresh chart definitions on each page load so published title edits appear.
const chartLoadVersion = Date.now().toString(36);

// Fit the main heading to the section width using its natural word spacing.
const pageTitle = document.querySelector(".page-header h1");
if (pageTitle) {
  const fitPageTitle = () => {
    if (!pageTitle.clientWidth) return;
    pageTitle.style.fontSize = "100px";
    const text = document.createRange();
    text.selectNodeContents(pageTitle);
    const textWidth = text.getBoundingClientRect().width;
    if (textWidth) pageTitle.style.fontSize = `${100 * pageTitle.clientWidth / textWidth}px`;
  };
  document.fonts.ready.then(() => {
    fitPageTitle();
    let previousWidth = pageTitle.clientWidth;
    new ResizeObserver(() => {
      const width = pageTitle.clientWidth;
      if (width === previousWidth) return;
      previousWidth = width;
      fitPageTitle();
    }).observe(pageTitle);
  });
}


var vg_1 = "charts/production_lollipop.vg.json";
var vg_2 = "charts/production_trend.vg.json";
var vg_3 = "charts/growth_heatmap.vg.json";
var vg_4 = "charts/growth_slopegraph.vg.json";

var vg_6 = "charts/production_rank_bump.vg.json";

var vg_8 = "charts/state_growth_choropleth.vg.json";
var vg_9 = "charts/production_value_scatter.vg.json";
var vg_10 = "charts/sankey.vg.json";
var vg_11 = "charts/export_flow_map.vg.json";
var vg_14 = "charts/state_production_proportional_symbol.vg.json";

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
  body: parseFloat(typographyStyle.getPropertyValue("--font-body")),
  legendTitle: parseFloat(typographyStyle.getPropertyValue("--font-legend-title")),
  legendItem: parseFloat(typographyStyle.getPropertyValue("--font-legend-item")),
  annotation: parseFloat(typographyStyle.getPropertyValue("--font-annotation")),
  annotationLineHeight: parseFloat(typographyStyle.getPropertyValue("--annotation-line-height")),
  labelLineHeight: parseFloat(typographyStyle.getPropertyValue("--line-chart-label")),
  paddingX: parseFloat(typographyStyle.getPropertyValue("--annotation-padding-x")),
  paddingY: parseFloat(typographyStyle.getPropertyValue("--annotation-padding-y")),
  axisTitleGap: parseFloat(typographyStyle.getPropertyValue("--axis-title-gap")),
  axisLabelGap: parseFloat(typographyStyle.getPropertyValue("--axis-label-gap")),
  legendTitleGap: parseFloat(typographyStyle.getPropertyValue("--legend-title-gap")),
  legendRowGap: parseFloat(typographyStyle.getPropertyValue("--legend-row-gap")),
  legendSymbolGap: parseFloat(typographyStyle.getPropertyValue("--legend-symbol-gap"))
};
// Wait for real font metrics before measuring labels and annotation boxes.
const chartFontsReady = Promise.all([
  document.fonts.load('400 13px "Source Sans 3"'),
  document.fonts.load('600 13px "Source Sans 3"'),
  document.fonts.load('650 17px "Source Sans 3"'),
  document.fonts.load('700 13px "Source Sans 3"'),
  document.fonts.load('600 25px "Fraunces"'),
  document.fonts.load('700 56px "Fraunces"')
]);
const chartTypographyUpdates = new WeakMap();
function standardiseVegaTypography(spec) {
  spec.signals ||= [];
  spec.signals.push({ name: "typographyScale", value: 1 });
  const size = value => ({ signal: `${value} * typographyScale` });
  const sankeyLines = spec.data?.find?.(data => data.name === "annotationLines")?.values;
  if (sankeyLines) {
    const context = document.createElement("canvas").getContext("2d");
    context.font = `${typography.annotation}px "Source Sans 3"`;
    const width = Math.ceil(Math.max(...sankeyLines.map(line => context.measureText(line.t).width))) + 2 * typography.paddingX;
    const height = sankeyLines.length * typography.annotationLineHeight + 2 * typography.paddingY;
    const box = spec.marks.find(mark => mark.name === "annotationBackground").encode.update;
    box.width = size(width); box.height = size(height);
    const text = spec.marks.find(mark => mark.name === "processingAnnotation").encode.update;
    text.x = { signal: `sourceX + ${typography.paddingX} * typographyScale` };
    text.y = { signal: `610 + (${typography.paddingY} + datum.i * ${typography.annotationLineHeight}) * typographyScale` };
    text.align = { value: "left" }; text.baseline = { value: "top" };
    spec.height = Math.max(spec.height, 610 + height + 12);
  }
  function visit(group) {
    (group.axes || []).forEach(axis => {
      axis.labelFontSize = size(typography.label);
      axis.titleFontSize = size(typography.axisTitle);
      axis.labelFont = axis.titleFont = "'Source Sans 3'";
      axis.labelOverlap = "greedy";
      axis.labelSeparation = 8;
      axis.labelFontWeight = 400;
      axis.titleFontWeight = { signal: "650" };
      axis.titlePadding = size(typography.axisTitleGap);
      axis.labelPadding = size(typography.axisLabelGap);
    });
    (group.legends || []).forEach(legend => {
      legend.labelFontSize = size(typography.legendItem);
      legend.titleFontSize = size(typography.legendTitle);
      legend.labelFont = legend.titleFont = "'Source Sans 3'";
      legend.labelFontWeight = 400;
      legend.titleFontWeight = { signal: "650" };
      legend.titlePadding = size(typography.legendTitleGap);
      legend.labelOffset = size(typography.legendSymbolGap);
      legend.rowPadding = size(typography.legendRowGap);
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
        mark.encode.update.lineHeight = size(typography.labelLineHeight);
        if (/annotation|avocadoGrowthText/i.test(mark.name || "")) {
          if (!mark.encode.update.fontSize?.signal?.includes("annotationScale")) {
            mark.encode.update.fontSize = size(typography.annotation);
          }
          mark.encode.update.fontWeight = { value: 400 };
          mark.encode.update.lineHeight = size(typography.annotationLineHeight);
        }
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

// Describe the filled arrows with standard Vega data transforms so exported
// specifications work in Vega Editor without a registered JavaScript function.
function compileExportArrows(spec) {
  const compiled = vegaLite.compile(spec).spec;
  const route = compiled.marks.find(mark => mark.type === "group" && mark.marks?.some(child => child.type === "line"));
  const line = route.marks.find(mark => mark.type === "line");
  const update = line.encode.update;
  const coordinate = (index, field) => `data('exportRoutePoints')[${index}][${JSON.stringify(field)}]`;
  const curve = (axis, t) => `pow(1 - (${t}), 2) * arrowStart${axis} + 2 * (1 - (${t})) * (${t}) * arrowControl${axis} + pow(${t}, 2) * arrowEnd${axis}`;
  const formula = (as, expr) => ({ type: "formula", as, expr });
  route.signals = [
    ...["X", "Y"].flatMap(axis => ["Start", "Control", "End"].map((part, index) => ({
      name: `arrow${part}${axis}`,
      update: `length(data('exportRoutePoints')) >= 3 ? ${coordinate(index, axis === "X" ? update.x.field : update.y.field)} : 0`
    }))),
    { name: "arrowThickness", update: "length(data('exportRoutePoints')) ? scale('strokeWidth', data('exportRoutePoints')[0].ExportTonnesNum) : 0" },
    { name: "arrowHeadLength", update: "max(12, arrowThickness * 2)" },
    { name: "arrowHeadWidth", update: "max(8, arrowThickness * 1.9)" },
    { name: "arrowBaseT", update: "length(data('exportArrowBase')) ? data('exportArrowBase')[0].baseT : 0" },
    { name: "arrowBaseX", update: curve("X", "arrowBaseT") },
    { name: "arrowBaseY", update: curve("Y", "arrowBaseT") },
    { name: "arrowHeadDX", update: "arrowEndX - arrowBaseX" },
    { name: "arrowHeadDY", update: "arrowEndY - arrowBaseY" },
    { name: "arrowHeadNorm", update: "sqrt(pow(arrowHeadDX, 2) + pow(arrowHeadDY, 2)) || 1" }
  ];
  route.data = [
    { name: "exportRoutePoints", source: line.from.data, transform: [{ type: "collect", sort: { field: "PathOrder" } }] },
    { name: "exportRoute", source: "exportRoutePoints", transform: [{ type: "filter", expr: "datum.PathOrder == 0" }] },
    { name: "exportArrowBase", transform: [
      { type: "sequence", start: 0, stop: 201, as: "sample" },
      formula("t", "datum.sample / 200"),
      formula("nextT", "min(1, datum.t + 1 / 200)"),
      formula("x", curve("X", "datum.t")),
      formula("y", curve("Y", "datum.t")),
      formula("nextX", curve("X", "datum.nextT")),
      formula("nextY", curve("Y", "datum.nextT")),
      formula("segment", "sqrt(pow(datum.nextX - datum.x, 2) + pow(datum.nextY - datum.y, 2))"),
      { type: "window", sort: { field: "sample", order: "descending" }, ops: ["sum"], fields: ["segment"], as: ["distance"], frame: [null, 0] },
      { type: "filter", expr: "datum.segment > 0 && datum.distance >= arrowHeadLength && datum.distance - datum.segment < arrowHeadLength" },
      formula("baseT", "(datum.sample + 1 - (arrowHeadLength - (datum.distance - datum.segment)) / datum.segment) / 200")
    ] },
    { name: "exportArrowOutline", transform: [
      { type: "sequence", start: 0, stop: 245, as: "index" },
      formula("t", "arrowBaseT * (datum.index <= 120 ? datum.index : 244 - datum.index) / 120"),
      formula("x", curve("X", "datum.t")),
      formula("y", curve("Y", "datum.t")),
      formula("dx", "2 * (1 - datum.t) * (arrowControlX - arrowStartX) + 2 * datum.t * (arrowEndX - arrowControlX)"),
      formula("dy", "2 * (1 - datum.t) * (arrowControlY - arrowStartY) + 2 * datum.t * (arrowEndY - arrowControlY)"),
      formula("norm", "sqrt(pow(datum.dx, 2) + pow(datum.dy, 2)) || 1"),
      formula("side", "datum.index <= 120 ? 1 : -1"),
      formula("outlineX", "datum.index == 122 ? arrowEndX : datum.index == 121 || datum.index == 123 ? arrowBaseX - arrowHeadDY / arrowHeadNorm * arrowHeadWidth / 2 * (datum.index == 121 ? 1 : -1) : datum.x - datum.dy / datum.norm * arrowThickness / 2 * datum.side"),
      formula("outlineY", "datum.index == 122 ? arrowEndY : datum.index == 121 || datum.index == 123 ? arrowBaseY + arrowHeadDX / arrowHeadNorm * arrowHeadWidth / 2 * (datum.index == 121 ? 1 : -1) : datum.y + datum.dx / datum.norm * arrowThickness / 2 * datum.side"),
      formula("pathPart", "(datum.index == 0 ? 'M' : 'L') + format(datum.outlineX, '.3f') + ',' + format(datum.outlineY, '.3f')"),
      { type: "collect", sort: { field: "index" } }
    ] }
  ];
  route.marks = [{
    name: "exportFlowArrow", type: "path", clip: true,
    from: { data: "exportRoute" },
    encode: { update: {
      path: { signal: "join(pluck(data('exportArrowOutline'), 'pathPart'), '') + 'Z'" },
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
  context.font = `${typography.annotation}px "Source Sans 3"`;
  const boxes = new Map();
  spec.layer = spec.layer.flatMap(layer => {
    if (!layer.name?.endsWith("AnnotationText")) return [layer];
    const datum = layer.data.values[0];
    const box = {
      x: datum.x, y: datum.y, fruit: datum.Fruit,
      width: Math.ceil(Math.max(...datum.label.map(line => context.measureText(line).width))) + 2 * typography.paddingX,
      height: datum.label.length * typography.annotationLineHeight + 2 * typography.paddingY,
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
    const top = `max(0, min((${centreY}) - ${box.height / 2} * typographyScale, height - ${box.height} * typographyScale))`;
    if (mark.name.endsWith("Background_marks")) {
      delete update.xc; delete update.yc;
      update.x = { signal: left }; update.y = { signal: top };
      update.width = { signal: `${box.width} * typographyScale` };
      update.height = { signal: `${box.height} * typographyScale` };
    } else if (mark.name.endsWith("Text_marks")) {
      update.x = { signal: `(${left}) + ${typography.paddingX} * typographyScale` };
      update.y = { signal: `(${top}) + ${typography.paddingY} * typographyScale` };
      update.align = { value: "left" }; update.baseline = { value: "top" };
      update.lineHeight = { signal: `${typography.annotationLineHeight} * typographyScale` };
    } else if (mark.name.endsWith("Leader_marks")) {
      if (box.fruit) {
        update.y2 = { signal: `(${top}) + ${box.height} * typographyScale` };
      } else {
        // Start at the box boundary along the direction to the point.
        // This keeps the visible leader outside the annotation rectangle.
        const boxCentreX = `((${left}) + ${box.width / 2} * typographyScale)`;
        const boxCentreY = `((${top}) + ${box.height / 2} * typographyScale)`;
        const directionX = `(scale('x', datum.x2) - ${boxCentreX})`;
        const directionY = `(scale('y', datum.y2) - ${boxCentreY})`;
        const edgeRatio = `1 / max(abs(${directionX}) / (${box.width / 2} * typographyScale), abs(${directionY}) / (${box.height / 2} * typographyScale), 0.000001)`;
        const originX = `${boxCentreX} + ${directionX} * (${edgeRatio})`;
        const originY = `${boxCentreY} + ${directionY} * (${edgeRatio})`;
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
  context.font = `${typography.annotation}px "Source Sans 3"`;
  const boxWidth = Math.ceil(Math.max(...note.lines.map(line => context.measureText(line).width))) + 2 * typography.paddingX;
  const boxHeight = note.lines.length * typography.annotationLineHeight + 2 * typography.paddingY;
  spec.padding = { top: 12, left: 0, right: 0, bottom: 0 };
  const compiled = vegaLite.compile(spec).spec;
  const top = `-(${boxHeight} + 24) * typographyScale`;
  const cx = `scale('x', '${note.target.Year}') + bandwidth('x') / 2`;
  const left = `max(0, (${cx}) - ${boxWidth / 2} * typographyScale)`;
  const cy = `scale('y', 'Avocado') + bandwidth('y') / 2`;
  const connectorPath = { signal: `'M' + (${cx}) + ',' + ((${top}) + ${boxHeight} * typographyScale) + ' L' + (${cx}) + ',' + (${cy})` };
  // A white outline keeps the single vertical connector distinct from
  // both pale and dark cells without changing the heatmap's colour scale.
  compiled.marks.push({ name: "avocadoGrowthConnectorOutline", type: "path", aria: false, encode: { update: {
    path: connectorPath, fill: { value: null }, stroke: { value: "#ffffff" },
    strokeWidth: { value: 4 }, strokeCap: { value: "round" }
  }}}, { name: "avocadoGrowthConnector", type: "path", encode: { update: {
    path: connectorPath,
    fill: { value: null }, stroke: { value: "#333333" }, strokeWidth: { value: 1.5 }, strokeCap: { value: "round" },
    description: { value: "Connector to the Avocado 2021–22 growth cell" }
  }}}, { name: "avocadoGrowthBox", type: "rect", encode: { update: {
    x: { signal: left }, y: { signal: top }, width: { signal: `${boxWidth} * typographyScale` }, height: { signal: `${boxHeight} * typographyScale` },
    fill: { value: "#eeeeee" }, stroke: { value: null }, tooltip: { value: note.text }
  }}}, { name: "avocadoGrowthText", type: "text", encode: { update: {
    x: { signal: `(${left}) + ${typography.paddingX} * typographyScale` }, y: { signal: `(${top}) + ${typography.paddingY} * typographyScale` }, text: { value: note.lines },
    align: { value: "left" }, baseline: { value: "top" },
    lineHeight: { value: typography.annotationLineHeight }, fill: { value: "#333333" },
    href: { value: note.source }, tooltip: { value: "Context: Rabobank, July 2022 — click to read the source" }
  }}});
  return compiled;
}

function compileProductionMap(spec) {
  const context = document.createElement("canvas").getContext("2d");
  context.font = `${typography.annotation}px "Source Sans 3"`;
  const boxes = new Map();
  spec.layer.filter(layer => layer.name?.endsWith("AnnotationText")).forEach(layer => {
    const lines = JSON.parse(layer.transform.find(transform => transform.as === "NoteLines").calculate);
    boxes.set(layer.name.split("Annotation")[0], {
      width: Math.ceil(Math.max(...lines.map(line => context.measureText(line).width))) + 2 * typography.paddingX,
      height: lines.length * typography.annotationLineHeight + 2 * typography.paddingY
    });
  });
  spec.layer.filter(layer => layer.name?.endsWith("AnnotationBackground")).forEach(layer => {
    Object.assign(layer.mark, boxes.get(layer.name.split("Annotation")[0]));
  });
  const compiled = vegaLite.compile(spec).spec;
  compiled.signals.push({ name: "annotationScale", value: 1 });
  compiled.signals.push({ name: "reportingYearLabel", update: "YearSelection + '–' + substring(toString(YearSelection + 1), 2)" });
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
      update.fontSize = { signal: `${typography.annotation} * annotationScale` };
      update.dx = { signal: `${typography.paddingX} * annotationScale` };
      update.dy = { signal: `(${typography.paddingY} + datum.NoteLineIndex * ${typography.annotationLineHeight}) * annotationScale` };
    } else if (mark.name.endsWith("AnnotationLeader_marks")) {
      const offset = mark.name.startsWith("banana") ? 0 : box.width;
      update.x = { signal: `datum['${update.x.field}'] + ${offset} * annotationScale` };
      update.y = { signal: `datum['${update.y.field}'] + ${box.height / 2} * annotationScale` };
    }
  });
  return addStateMapLabels(compiled, spec);
}

function addStateMapLabels(compiled, spec, outline = false) {
  // Labels are geographic context, independent of the fruit/year filters.
  const labels = spec.usermeta?.stateLabels || [];
  const projection = compiled.projections[0].name;
  const project = (lon, lat, axis) => `scale('${projection}', [datum.${lon}, datum.${lat}])[${axis}]`;
  compiled.data.push({ name: "productionStateLabels", values: labels });
  compiled.data.push({ name: "productionStateLabelConnectors", source: "productionStateLabels",
    transform: [{ type: "filter", expr: "isValid(datum.anchorLongitude)" }] });
  compiled.marks.push({
    name: "productionStateLabelConnectors_marks", type: "rule", aria: false,
    from: { data: "productionStateLabelConnectors" },
    encode: { update: {
      x: { signal: project("anchorLongitude", "anchorLatitude", 0) },
      y: { signal: project("anchorLongitude", "anchorLatitude", 1) },
      x2: { signal: `${project("longitude", "latitude", 0)} - 7 * typographyScale` },
      y2: { signal: project("longitude", "latitude", 1) },
      stroke: { value: "#777777" }, strokeWidth: { value: 1 }
    } }
  }, {
    name: "productionStateNames", type: "text", from: { data: "productionStateLabels" },
    encode: { update: {
      x: { signal: project("longitude", "latitude", 0) },
      y: { signal: `${project("longitude", "latitude", 1)} - (datum.lines.length - 1) * ${typography.labelLineHeight / 2} * typographyScale` },
      text: { field: "lines" }, description: { field: "name" },
      align: { signal: "isValid(datum.anchorLongitude) ? 'left' : 'center'" },
      baseline: { value: "middle" }, fontWeight: { value: 400 },
      lineHeight: { signal: `${typography.labelLineHeight} * typographyScale` }, fill: { value: "#333333" }
    } }
  });
  if (outline) {
    const label = compiled.marks[compiled.marks.length - 1];
    const growthMark = compiled.marks.find(mark => mark.encode?.update?.fill?.scale);
    const zeroMark = compiled.marks.find(mark => mark.encode?.update?.fill?.value === "#e0e0e0");
    const labelData = compiled.data.find(data => data.name === "productionStateLabels");
    const colourScale = growthMark.encode.update.fill.scale;
    // Read the displayed region colour from the same filtered data as the map.
    labelData.transform = [
      { type: "lookup", from: growthMark.from.data, key: "State", fields: ["name"], values: ["GrowthClass"], as: ["labelGrowthClass"] },
      { type: "lookup", from: zeroMark.from.data, key: "State", fields: ["name"], values: ["State"], as: ["zeroState"] },
      { type: "formula", as: "labelBackground", expr: `isValid(datum.anchorLongitude) ? '#ffffff' : isValid(datum.labelGrowthClass) ? scale('${colourScale}', datum.labelGrowthClass) : isValid(datum.zeroState) ? '#e0e0e0' : '#7a7a7a'` }
    ];
    label.encode.update.fill = { signal: "datum.labelBackground === '#54278f' || datum.labelBackground === '#7a7a7a' ? '#ffffff' : '#222222'" };
    // A subtle halo in the region colour protects solid lettering at borders.
    const halo = structuredClone(label);
    halo.name = "stateNameHalos";
    halo.aria = false;
    Object.assign(halo.encode.update, {
      fill: { field: "labelBackground" }, stroke: { field: "labelBackground" },
      strokeWidth: { signal: "1.25 * typographyScale" }, strokeJoin: { value: "round" }
    });
    compiled.marks.splice(compiled.marks.length - 1, 0, halo);
  }
  return compiled;
}

// Keep the orchard explanation in the ocean below the mainland.
function compileChoroplethMap(spec) {
  const compiled = addStateMapLabels(vegaLite.compile(spec).spec, spec, true);
  const note = spec.usermeta.orchardAnnotation;
  const context = document.createElement("canvas").getContext("2d");
  context.font = `${typography.annotation}px "Source Sans 3"`;
  const width = Math.ceil(Math.max(...note.lines.map(line => context.measureText(line).width))) + 2 * typography.paddingX;
  const height = note.lines.length * typography.annotationLineHeight + 2 * typography.paddingY;
  const projection = compiled.projections[0].name;
  const x = `scale('${projection}', [${note.longitude}, ${note.latitude}])[0] - ${width / 2} * typographyScale`;
  const y = `scale('${projection}', [${note.longitude}, ${note.latitude}])[1]`;
  const visible = [{ type: "filter", expr: "FruitSelection === 'Avocado'" }];
  compiled.data.push({ name: "orchardNote", values: [{}], transform: visible });
  compiled.data.push({ name: "orchardTargets", values: note.targets, transform: visible });
  const marks = [{
    name: "orchardAnnotationLeaders", type: "rule", from: { data: "orchardTargets" },
    encode: { update: {
      x: { signal: `scale('${projection}', [${note.connectorLongitude ?? note.longitude}, ${note.latitude}])[0]` },
      y: { signal: y },
      x2: { signal: `scale('${projection}', [datum.longitude, datum.latitude])[0]` },
      y2: { signal: `scale('${projection}', [datum.longitude, datum.latitude])[1]` },
      stroke: { value: "#777777" }, strokeWidth: { value: 1 }, strokeCap: { value: "round" },
      description: { signal: "'Orchard annotation connector to ' + datum.name" }
    } }
  }, {
    name: "orchardAnnotationBackground", type: "rect", from: { data: "orchardNote" },
    encode: { update: {
      x: { signal: x }, y: { signal: y },
      width: { signal: `${width} * typographyScale` }, height: { signal: `${height} * typographyScale` },
      fill: { value: "#eeeeee" }, cornerRadius: { signal: "3 * typographyScale" }, tooltip: { value: note.text }
    } }
  }, {
    name: "orchardAnnotationText", type: "text", from: { data: "orchardNote" },
    encode: { update: {
      x: { signal: `(${x}) + ${typography.paddingX} * typographyScale` }, y: { signal: `(${y}) + ${typography.paddingY} * typographyScale` },
      text: { value: note.lines }, align: { value: "left" }, baseline: { value: "top" },
      lineHeight: { signal: `${typography.annotationLineHeight} * typographyScale` },
      fontWeight: { value: 400 }, fill: { value: "#333333" }, description: { value: note.text }
    } }
  }];
  // Connectors sit below state labels so they cannot obscure the lettering.
  const index = compiled.marks.findIndex(mark => mark.name === "productionStateLabelConnectors_marks");
  compiled.marks.splice(index, 0, ...marks);
  return compiled;
}

// Format the selected start year as a financial year.
function styleYearControl(root, view) {
  root.querySelectorAll('.vega-bind input[type="range"]').forEach(input => {
    const label = input.closest("label");
    const nativeValue = [...label.querySelectorAll("span")].find(span => !span.classList.contains("vega-bind-name"));
    if (!nativeValue) return;
    // Vega updates its own value node on input; keep our formatted label separate.
    const value = document.createElement("span");
    nativeValue.replaceWith(value);
    value.classList.add("financial-year-value");
    const update = () => {
      const text = view.signal("reportingYearLabel");
      value.textContent = text;
      input.setAttribute("aria-valuetext", text);
    };
    view.addSignalListener("reportingYearLabel", () => queueMicrotask(update));
    update();
  });
}

// Use page typography for both the selected fruit and the open options.
let fruitMenuCount = 0;
function styleFruitMenus(root) {
  root.querySelectorAll(".vega-bindings select").forEach(select => {
    if (select.classList.contains("fruit-native-select")) return;
    const wrapper = document.createElement("span");
    wrapper.className = "fruit-dropdown";
    select.before(wrapper);
    wrapper.append(select);
    select.classList.add("fruit-native-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fruit-dropdown-button";
    button.setAttribute("role", "combobox");
    button.setAttribute("aria-label", "Select fruit");
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    wrapper.append(button);
    const menu = document.createElement("div");
    menu.id = `fruit-options-${++fruitMenuCount}`;
    menu.className = "fruit-dropdown-options";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Fruit options");
    menu.hidden = true;
    button.setAttribute("aria-controls", menu.id);
    document.body.append(menu);
    let active = select.selectedIndex;
    const choices = [...select.options].map((option, index) => {
      const item = document.createElement("div");
      item.id = `${menu.id}-${index}`;
      item.className = "fruit-dropdown-option";
      item.setAttribute("role", "option");
      item.textContent = option.textContent;
      item.addEventListener("pointerdown", event => event.preventDefault());
      item.addEventListener("click", () => choose(index));
      menu.append(item);
      return item;
    });
    function refresh() {
      button.textContent = select.options[select.selectedIndex].textContent;
      choices.forEach((item, index) => {
        item.setAttribute("aria-selected", String(index === select.selectedIndex));
        item.classList.toggle("active", index === active);
      });
      if (!menu.hidden) button.setAttribute("aria-activedescendant", choices[active].id);
    }
    function position() {
      if (menu.hidden) return;
      const r = button.getBoundingClientRect();
      menu.style.width = `${Math.min(Math.max(r.width, 170), innerWidth - 24)}px`;
      menu.style.left = `${Math.max(12, Math.min(r.left, innerWidth - menu.offsetWidth - 12))}px`;
      const below = innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const upward = below < Math.min(300, menu.scrollHeight) && above > below;
      menu.style.maxHeight = `${Math.max(60, Math.min(300, upward ? above : below))}px`;
      const top = upward ? r.top - menu.offsetHeight - 4 : r.bottom + 4;
      menu.style.top = `${Math.max(12, Math.min(top, innerHeight - menu.offsetHeight - 12))}px`;
    }
    function close() {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.removeAttribute("aria-activedescendant");
    }
    function open() {
      active = select.selectedIndex;
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      refresh(); position();
      choices[active].scrollIntoView({ block: "nearest" });
    }
    function choose(index) {
      select.selectedIndex = index;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      active = index;
      refresh(); close();
      button.focus({ preventScroll: true });
    }
    button.addEventListener("click", event => {
      event.preventDefault();
      menu.hidden ? open() : close();
    });
    button.addEventListener("keydown", event => {
      const key = event.key;
      if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(key)) {
        event.preventDefault();
        if (menu.hidden) { open(); return; }
        if (key === "Enter" || key === " ") { choose(active); return; }
        active = key === "Home" ? 0 : key === "End" ? choices.length - 1
          : Math.max(0, Math.min(choices.length - 1, active + (key === "ArrowDown" ? 1 : -1)));
        refresh(); choices[active].scrollIntoView({ block: "nearest" });
      } else if (key === "Escape") {
        event.preventDefault(); close();
      } else if (key === "Tab") close();
      else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const match = [...select.options].findIndex(option => option.text.toLowerCase().startsWith(key.toLowerCase()));
        if (match >= 0) { event.preventDefault(); if (menu.hidden) open(); active = match; refresh(); choices[active].scrollIntoView({ block: "nearest" }); }
      }
    });
    select.addEventListener("input", refresh);
    select.addEventListener("change", refresh);
    document.addEventListener("pointerdown", event => {
      if (!wrapper.contains(event.target) && !menu.contains(event.target)) close();
    });
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    refresh();
  });
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
  // Load this checkout's datasets locally and keep exported URLs absolute.
  function resolveDatasetUrls(value) {
    if (!value || typeof value !== "object") return;
    const prefix = "https://ohnyengern.github.io/australian-fruit-dashboard-/data/";
    if (typeof value.url === "string" && value.url.startsWith(prefix)) {
      const url = new URL(`data/${value.url.slice(prefix.length)}`, document.baseURI);
      url.searchParams.set("v", chartLoadVersion);
      value.url = url.href;
    }
    Object.values(value).forEach(resolveDatasetUrls);
  }
  resolveDatasetUrls(spec);
  if (target === "#export_value_per_tonne") {
    // Carry the small dataset with exported specs, avoiding relative URL failures.
    const response = await fetch(spec.data.url, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load export values per tonne");
    const values = vega.read(await response.text(), { type: "csv" });
    spec.data = { values };
  }
  // Match the full divider width. Vega fits labels and legends within this
  // width, reserving only the space they actually need instead of wide gutters.
  const chartElement = document.querySelector(target);
  spec.width = spec.projection ? 1030 : target === "#production_value_scatter" ? Math.max(720, chartElement.clientWidth) : ["#growth_heatmap", "#fruit_sankey", "#production_trend", "#production_rank_bump"].includes(target) ? Math.max(480, chartElement.clientWidth) : chartElement.clientWidth;
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
    const title = document.createElement("span");
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
      chartElement.parentElement.querySelector(".export-unit-footer").prepend(legend);
    } else {
      chartElement.after(legend);
    }
    colour.legend = null;
  }
  const compiled = target === "#export_flow_map" ? compileExportArrows(spec)
    : target === "#state_production_map" ? compileProductionMap(spec)
    : target === "#state_growth_choropleth" ? compileChoroplethMap(spec)
    : target === "#growth_heatmap" ? compileHeatmapAnnotation(spec)
    : ["#production_value_scatter", "#export_value_waterfall"].includes(target) ? compileBoxedAnnotations(spec)
    : options.mode === "vega" ? spec : vegaLite.compile(spec).spec;
  const result = await vegaEmbed(target, standardiseVegaTypography(compiled), { ...options, mode: "vega" });
  styleFruitMenus(chartElement);
  styleYearControl(chartElement, result.view);
  let previousWidth;
  let previousScale;
  let pendingLayout = Promise.resolve();
  const updateTypography = () => {
    const svg = chartElement.querySelector("svg.marks");
    if (!svg) return;
    const width = target === "#production_value_scatter" ? Math.max(720, chartElement.clientWidth) : ["#growth_heatmap", "#fruit_sankey", "#production_trend", "#production_rank_bump"].includes(target) ? Math.max(480, chartElement.clientWidth) : chartElement.clientWidth;
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
// Let the browser fill the equal-width columns. Add a break only when
// an actual rendered line contains an eleventh word; never estimate widths.
function limitNarrativeLines() {
  narrativeParagraphs.forEach(paragraph => {
    paragraph.querySelectorAll(".word-limit-break").forEach(br => br.remove());
    const column = paragraph.closest(".explanation-column");
    const style = getComputedStyle(column);
    const columns = Number(style.columnCount) || 1;
    const gap = parseFloat(style.columnGap) || 0;
    const bounds = column.getBoundingClientRect();
    const step = (bounds.width + gap) / columns;
    let previous;
    let count = 0;
    for (const word of paragraph.querySelectorAll(".narrative-word")) {
      const rect = word.getBoundingClientRect();
      const previousRect = previous?.getBoundingClientRect();
      const sameLine = previousRect && Math.abs(rect.top - previousRect.top) < 1 &&
        Math.floor((rect.left - bounds.left) / step) === Math.floor((previousRect.left - bounds.left) / step);
      count = sameLine ? count + 1 : 1;
      if (count > 10) {
        const br = document.createElement("br");
        br.className = "word-limit-break";
        word.before(br);
        count = 1;
      }
      previous = word;
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
  // Vega can retain the initial tspan spacing after a scale signal changes.
  // Keep the rendered lines in sync with the current scenegraph line height.
  svg.querySelectorAll("text").forEach(text => {
    const spans = [...text.querySelectorAll(":scope > tspan")];
    if (spans.length < 2) return;
    const matrix = text.getScreenCTM();
    if (!matrix) return;
    const scale = Math.hypot(matrix.c, matrix.d);
    if (!scale) return;
    const isAnnotation = /annotation|avocadoGrowthText/i.test(text.closest(".role-mark")?.getAttribute("class") || "");
    const lineHeight = (isAnnotation ? typography.annotationLineHeight : typography.labelLineHeight) / scale;
    spans.slice(1).forEach(span => span.setAttribute("dy", lineHeight));
  });
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
