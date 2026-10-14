
var vg_1 = "charts/production_lollipop.vg.json";
var vg_2 = "charts/production_trend.vg.json";
var vg_3 = "charts/growth_heatmap.vg.json";
var vg_4 = "charts/growth_slopegraph.vg.json";

var vg_6 = "charts/production_rank_bump.vg.json";

var vg_8 = "charts/state_growth_choropleth.vg.json";
var vg_9 = "charts/production_value_scatter.vg.json";
var vg_10 = "charts/sankey.vg.json";
var vg_11 = "charts/export_flow_map.vg.json";
var vg_12 = "charts/export_value_waterfall.vg.json";
var vg_14 = "charts/state_production_small_multiples.vg.json";

// ======================================
// Vega Embed Options
// ======================================

const embedOptions = {
  renderer: "svg",
  actions: true,
  scaleFactor: 3
};

// ======================================
// Section 01
// Current Production Snapshot
// ======================================

vegaEmbed(
  "#production_lollipop",
  vg_1,
  embedOptions
).catch(console.error);

// ======================================
// Section 02
// Production Over Time
// ======================================

vegaEmbed(
  "#production_trend",
  vg_2,
  embedOptions
).catch(console.error);

vegaEmbed(
  "#growth_heatmap",
  vg_3,
  embedOptions
).catch(console.error);

vegaEmbed(
  "#growth_slopegraph",
  vg_4,
  embedOptions
).catch(console.error);

vegaEmbed(
  "#production_rank_bump",
  vg_6,
  embedOptions
).catch(console.error);

// ======================================
// Section 03
// State and Territory Distribution
// ======================================

vegaEmbed(
  "#state_growth_choropleth",
  vg_8,
  embedOptions
).catch(console.error);

// ======================================
// Section 04
// Production vs Value
// ======================================

vegaEmbed(
  "#production_value_scatter",
  vg_9,
  embedOptions
).catch(console.error);

// ======================================
// Section 05
// Allocation and Exports
// ======================================

vegaEmbed(
  "#fruit_sankey",
  vg_10,
  {
    ...embedOptions,
    mode: "vega"
  }
).catch(console.error);

vegaEmbed(
  "#export_flow_map",
  vg_11,
  embedOptions
).catch(console.error);

vegaEmbed(
  "#export_value_waterfall",
  vg_12,
  embedOptions
).catch(console.error);

// ======================================
// Small Multiples
//
// 4 columns x 2 rows of fruit maps
//
// Bottom section:
// Left: legend + existing year slider
// Right: narrative text
// ======================================

fetch(vg_14)
  .then(response => {

    if (!response.ok) {
      throw new Error(
        "Could not load small-multiples specification"
      );
    }

    return response.json();

  })
  .then(spec => {

    const chart = document.getElementById(
      "state_production_small_multiples"
    );

    const yearControl = document.getElementById(
      "small-multiples-year-control"
    );

    const row = chart.closest(".story-row");

    // Disable the built-in Vega-Lite legend.
    // The HTML legend is displayed below the maps.

    spec.spec.layer[1].encoding.size.legend = null;

    // Remember the selected year during window resizing.

    let year = spec.params[0].value;

    let rendering = false;
    let rerenderRequested = false;

    // ======================================
    // Render the Small Multiples
    // ======================================

    async function renderMap() {

      if (rendering) {
        rerenderRequested = true;
        return;
      }

      rendering = true;

      try {

        // Read the currently selected year.

        const currentSlider = yearControl.querySelector(
          'input[type="range"]'
        );

        if (currentSlider) {
          year = Number(currentSlider.value);
        }

        // Calculate the width for 4 map columns.

        spec.spec.width = Math.floor(
          row.clientWidth / 4
        );

        // Preserve the selected year.

        spec.params[0].value = year;

        // Remove the previously relocated slider.

        yearControl.replaceChildren();

        // Render the Vega-Lite maps.

        await vegaEmbed(
          chart,
          spec,
          embedOptions
        );

        // Move Vega-Lite's working year slider
        // into the bottom-left HTML column.

        const bindings = chart.querySelector(
          ".vega-bindings"
        );

        if (bindings) {
          yearControl.appendChild(bindings);
        }

      } catch (error) {

        console.error(error);

      } finally {

        rendering = false;

        // Rerender if another resize happened
        // while the map was rendering.

        if (rerenderRequested) {
          rerenderRequested = false;
          renderMap();
        }
      }
    }

    // First render.

    renderMap();

    // ======================================
    // Handle Window Resize / Browser Zoom
    // ======================================

    let resizeTimer;

    window.addEventListener("resize", () => {

      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        renderMap();
      }, 200);

    });

  })
  .catch(console.error);

// ======================================
// Responsive chart scaling
// Vega renders fixed-size SVGs, so scale each one to fill its column using
// its viewBox. Charts then fit the column exactly, with no empty space and no
// overflow into the text beside them. (Small multiples are excluded.)
// ======================================

function standardizeChartTitle(svg) {
  const naturalWidth = svg.viewBox.baseVal.width ||
    parseFloat(svg.getAttribute("width"));
  const renderedWidth = svg.getBoundingClientRect().width;

  if (!naturalWidth || !renderedWidth) {
    return;
  }

  svg.querySelectorAll(".role-title-text text").forEach(function (title) {
    const isMapHeading = svg.closest(".small-multiples-row") &&
      ["Apple", "Avocado", "Banana", "Blueberry", "Mandarin",
        "Orange", "Strawberry", "Table grapes"].includes(title.textContent.trim());
    const fontSize = (isMapHeading ? 16 : 20) * naturalWidth / renderedWidth;
    title.style.fontSize = fontSize + "px";
  });
}

const observedChartSvgs = new WeakSet();
const chartTitleResizeObserver = new ResizeObserver(function (entries) {
  entries.forEach(function (entry) {
    standardizeChartTitle(entry.target);
  });
});

function fitChartSvg(svg) {
  if (!observedChartSvgs.has(svg)) {
    observedChartSvgs.add(svg);
    chartTitleResizeObserver.observe(svg);
  }

  if (svg.style.width || svg.closest(".small-multiples-row")) {
    standardizeChartTitle(svg);
    return;
  }

  const width = parseFloat(svg.getAttribute("width"));
  const height = parseFloat(svg.getAttribute("height"));

  if (!width || !height) {
    return;
  }

  if (!svg.hasAttribute("viewBox")) {
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
  }

  svg.style.width = "100%";
  svg.style.maxWidth = "none";
  svg.style.height = "auto";
  standardizeChartTitle(svg);
}

new MutationObserver(function () {
  document
    .querySelectorAll(".chart-column .vega-embed svg.marks")
    .forEach(fitChartSvg);
}).observe(document.body, { childList: true, subtree: true });
