import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { POLARITY, TEXT2, signed } from "./colors";
import { SEASONS } from "./Groups";

const W = 440, H = 340;
const M = { top: 16, right: 12, bottom: 40, left: 64 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ORDER = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];   // start at December so winter is together

// Bar with a 4px rounded end away from the zero line
function barPath(x, w, y0, y1) {
  const r = Math.min(4, w / 2, Math.abs(y1 - y0));
  if (y1 === y0) return "";
  const s = y1 < y0 ? 1 : -1;   // 1 = bar goes up
  return `M${x},${y0} V${y1 + s * r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + s * r} V${y0} Z`;
}

const sameSet = (a, b) => a.length === b.length && a.every((m) => b.includes(m));

/**
 * Seasonal chart: departure from normal for each calendar month.
 * Click bars (or a season button) to select months.
 * Props:
 *   data      [{month, value, actual, normal, n}] for the selected stations and years
 *   months    selected months, e.g. [12, 1, 2]   (from the shared selection)
 *   onMonths  called with the new list of months (writes to the shared selection)
 */
export default function Seasonal({ data, loading, months, onMonths, variable, unit, rawUnit, baseline }) {
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  const pol = POLARITY[variable];

  useEffect(() => {
    if (!data) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    d3.select(tipRef.current).style("display", "none");   // hide a stale tooltip after a redraw

    const x = d3.scaleBand().domain(ORDER).range([M.left, W - M.right]).paddingInner(0.25).paddingOuter(0.1);
    const vals = data.map((d) => d.value).filter((v) => v != null);
    const y = d3.scaleLinear().domain(d3.extent([0, ...vals])).nice().range([H - M.bottom, M.top]);
    const byMonth = new Map(data.map((d) => [d.month, d]));
    const active = (m) => months.length === 0 || months.includes(m);

    // Grid and axes
    svg.append("g").selectAll("line").data(y.ticks(5)).join("line")
      .attr("x1", M.left).attr("x2", W - M.right).attr("y1", y).attr("y2", y)
      .attr("stroke", "#e8e7e3").attr("stroke-width", 0.5);
    svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(5)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).tickFormat((m) => MONTHS[m - 1]).tickSize(0))
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll("text").attr("dy", "1em")
        .attr("font-weight", (m) => (months.includes(m) ? 700 : 400)));
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -(H - M.bottom + M.top) / 2).attr("y", 16)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", TEXT2)
      .text(`Departure from normal (${unit.replace(" of normal", "")})`);
    svg.append("text").attr("x", (W + M.left - M.right) / 2).attr("y", H - 4)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", TEXT2).text("Month");

    // Bars
    svg.append("g").selectAll("path").data(ORDER).join("path")
      .attr("d", (m) => {
        const v = byMonth.get(m)?.value;
        return v == null ? "" : barPath(x(m), x.bandwidth(), y(0), y(v));
      })
      .attr("fill", (m) => ((byMonth.get(m)?.value ?? 0) >= 0 ? pol.posColor : pol.negColor))
      .attr("opacity", (m) => (active(m) ? 1 : 0.25));

    // Zero line on top of the bars
    svg.append("line").attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke", TEXT2).attr("stroke-width", 1);

    // Selected-month marker under the axis label
    svg.append("g").selectAll("rect").data(months).join("rect")
      .attr("x", (m) => x(m)).attr("width", x.bandwidth()).attr("y", H - M.bottom + 2).attr("height", 3)
      .attr("rx", 1.5).attr("fill", "#0b0b0b");

    // Invisible full-height hit areas: bigger than the bars, so clicks are easy
    const tip = d3.select(tipRef.current);
    svg.append("g").selectAll("rect").data(ORDER).join("rect")
      .attr("x", (m) => x(m) - (x.step() - x.bandwidth()) / 2).attr("width", x.step())
      .attr("y", M.top).attr("height", H - M.bottom - M.top + 24)
      .attr("fill", "transparent").style("cursor", "pointer")
      .on("click", (event, m) => {
        onMonths(months.includes(m) ? months.filter((k) => k !== m) : [...months, m]);
      })
      .on("mousemove", (event, m) => {
        const d = byMonth.get(m);
        if (!d || d.value == null) return tip.style("display", "none");
        tip.style("display", "block").style("left", `${((x(m) + x.bandwidth()) / W) * 100}%`)
          .html(`<strong>${MONTHS[m - 1]}</strong><br>${signed(d.value)} ${unit}` +
            `<br><span style="color:${TEXT2}">${d.actual} vs normal ${d.normal} ${rawUnit}</span>`);
      })
      .on("mouseleave", () => tip.style("display", "none"));
  }, [data, months, onMonths, pol, unit, rawUnit]);

  return (
    <figure className={`view${loading ? " loading" : ""}`}>
      <h2><span className="step">1</span>Which months? Departure from normal by month</h2>
      <div className="legend">
        <span><i className="swatch" style={{ background: pol.posColor }} /> {pol.pos}</span>
        <span><i className="swatch" style={{ background: pol.negColor }} /> {pol.neg}</span>
      </div>
      <div className="season-buttons">
        {Object.entries(SEASONS).map(([name, ms]) => (
          <button key={name} className={sameSet(ms, months) ? "on" : ""}
                  onClick={() => onMonths(sameSet(ms, months) ? [] : ms)}>
            {name}
          </button>
        ))}
        <button className={months.length === 0 ? "on" : ""} onClick={() => onMonths([])}>All months</button>
      </div>
      <div style={{ position: "relative" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
             aria-label="Bar chart of departure from normal for each month" />
        <div ref={tipRef} className="tooltip" />
      </div>
      <figcaption>
        Each bar is the average departure from the {baseline[0]}–{baseline[1]} normal for that month,
        across the selected stations and years. <strong>Click bars</strong> or a season to select
        months; click again to deselect.
      </figcaption>
    </figure>
  );
}