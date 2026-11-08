import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { feature, mesh } from "topojson-client";
import us from "us-atlas/states-albers-10m.json";   // U.S. states, already projected to 975 × 610
import { POLARITY, NEUTRAL, TEXT2, signed } from "./colors";
import { REGIONS } from "./Groups";

const W = 975, H = 610;
// Same projection us-atlas used, so station dots line up with the state outlines
const projection = d3.geoAlbersUsa().scale(1300).translate([487.5, 305]);
const path = d3.geoPath();
const states = feature(us, us.objects.states);
const borders = mesh(us, us.objects.states, (a, b) => a !== b);


/**
 * Map: every station, colored by its departure from normal for the selected years and months.
 * Drag a box to select stations, click a dot to add/remove it, click empty map to clear.
 * Props:
 *   data        [{id, name, state, lat, lon, value, n_months}]
 *   selected    selected station ids        (from the shared selection)
 *   onStations  called with new list of ids (writes to the shared selection)
 */
export default function MapView({ data, loading, selected, onStations, variable, unit }) {
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  const pol = POLARITY[variable];

  // Color scale: symmetric around 0, so white = normal. 95th percentile keeps one outlier from washing out the rest.
  const color = useMemo(() => {
    const abs = (data || []).map((d) => Math.abs(d.value)).filter((v) => !isNaN(v) && v != null);
    const m = d3.quantile(abs.sort(d3.ascending), 0.95) || 1;
    const max = +d3.format(".2r")(m);
    const lo = d3.interpolateRgb(pol.negColor, NEUTRAL), hi = d3.interpolateRgb(NEUTRAL, pol.posColor);
    return d3.scaleDiverging([-max, 0, max], (t) => (t < 0.5 ? lo(t * 2) : hi((t - 0.5) * 2))).clamp(true);
  }, [data, pol]);

  // Points in screen space
  const points = useMemo(() => (data || [])
    .map((d) => ({ ...d, xy: projection([d.lon, d.lat]) }))
    .filter((d) => d.xy), [data]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const tip = d3.select(tipRef.current).style("display", "none");
    const sel = new Set(selected);
    const hasSel = sel.size > 0;

    svg.append("path").datum(states).attr("d", path).attr("fill", "#f4f3f0");
    svg.append("path").datum(borders).attr("d", path).attr("fill", "none")
      .attr("stroke", "#d6d5d0").attr("stroke-width", 1);

    // Box selection. Drawn BELOW the dots so dots still get clicks.
    const brush = d3.brush()
      .extent([[0, 0], [W, H]])
      .on("end", (event) => {
        if (!event.sourceEvent) return;                       // ignore our own brush.move
        if (!event.selection) return onStations([]);           // plain click on the map = clear
        const [[x0, y0], [x1, y1]] = event.selection;
        const ids = points.filter(({ xy: [x, y] }) => x >= x0 && x <= x1 && y >= y0 && y <= y1).map((d) => d.id);
        onStations(ids);
        brushG.call(brush.move, null);                         // the dots show the selection, not the box
      });
    const brushG = svg.append("g").attr("class", "brush").call(brush);

    // Unselected first, so selected dots are drawn on top
    const ordered = [...points].sort((a, b) => sel.has(a.id) - sel.has(b.id));
    svg.append("g").selectAll("circle").data(ordered).join("circle")
      .attr("cx", (d) => d.xy[0]).attr("cy", (d) => d.xy[1])
      .attr("r", (d) => (sel.has(d.id) ? 8 : 6.5))
      .attr("fill", (d) => (d.value == null ? "#fff" : color(d.value)))
      .attr("stroke", (d) => (sel.has(d.id) ? "#0b0b0b" : d.value == null ? "#a8a7a1" : "#fff"))
      .attr("stroke-width", (d) => (sel.has(d.id) ? 2.5 : 1.5))
      .attr("opacity", (d) => (!hasSel || sel.has(d.id) ? 1 : 0.35))
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        onStations(sel.has(d.id) ? selected.filter((id) => id !== d.id) : [...selected, d.id]);
      })
      .on("mousemove", (event, d) => {
        const [px, py] = d3.pointer(event, svg.node());
        tip.style("display", "block")
          .style("left", `${(px / W) * 100}%`).style("top", `${(py / H) * 100}%`)
          .html(`<strong>${d.name}, ${d.state}</strong><br>` +
            (d.value == null ? "No data for this selection"
              : `${signed(d.value)} ${unit}<br><span style="color:${TEXT2}">${d.n_months} months of data</span>`));
      })
      .on("mouseleave", () => tip.style("display", "none"));
  }, [points, selected, onStations, color, unit]);

  // Legend gradient stops
  const [lo, , hi] = color.domain();
  const stops = d3.range(0, 1.01, 0.1).map((t) => color(lo + t * (hi - lo)));
  const regionOn = (ids) => ids.length > 0 && ids.length === selected.length && ids.every((id) => selected.includes(id));

  return (
    <figure className={`view${loading ? " loading" : ""}`}>
      <h2><span className="step">2</span>Where? Departure from normal by station</h2>
      <div className="map-legend">
        <div>
          <div className="gradient" style={{ background: `linear-gradient(to right, ${stops.join(",")})` }} />
          <div className="gradient-labels">
            <span>{signed(lo)} {unit}</span><span>0</span><span>{signed(hi)}</span>
          </div>
          <div className="gradient-labels"><span>{pol.neg}</span><span>{pol.pos}</span></div>
        </div>
        <span><i className="dot" /> No data</span>
        <span><i className="dot selected" /> Selected</span>
      </div>
      <div className="season-buttons">
        {Object.entries(REGIONS).map(([name, codes]) => {
          const ids = points.filter((d) => codes.includes(d.state)).map((d) => d.id);
          return (
            <button key={name} className={regionOn(ids) ? "on" : ""}
                    onClick={() => onStations(regionOn(ids) ? [] : ids)}>{name}</button>
          );
        })}
        <button className={selected.length === 0 ? "on" : ""} onClick={() => onStations([])}>All stations</button>
      </div>
      <div style={{ position: "relative" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
             aria-label="Map of U.S. weather stations colored by departure from normal" />
        <div ref={tipRef} className="tooltip" />
      </div>
      <figcaption>
        Each dot is a weather station, colored by its average departure from the 1961–1990 normal
        for the selected years and months. <strong>Drag a box</strong> to select stations,
        <strong> click a dot</strong> to add or remove it, or pick a region. Click empty map to clear.
      </figcaption>
    </figure>
  );
}