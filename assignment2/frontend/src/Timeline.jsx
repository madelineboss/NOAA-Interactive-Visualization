import { useEffect, useRef } from "react";
import * as d3 from "d3";

const W = 1200, H = 240;
const M = { top: 16, right: 20, bottom: 40, left: 64 };
const SEL_COLOR = "#2a78d6";   // selected stations
const ALL_COLOR = "#a8a7a1";   // all stations (context)

/**
 * Timeline: yearly anomaly. Drag across it to select a range of years.
 * Props:
 *   data      timeseries for the current selection   [{year, value, n_stations}]
 *   context   timeseries for ALL stations (shown in gray when stations are selected)
 *   years     the selected [min, max] or null      (from the shared selection)
 *   onYears   called with [min, max] or null       (writes to the shared selection)
 */
export default function Timeline({ data, context, loading, years, onYears, yearRange, unit, baseline, hasStationSel }) {
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  const brushRef = useRef(null);
  const xRef = useRef(null);
  const onYearsRef = useRef(onYears);
  onYearsRef.current = onYears;

  // x-scale never changes, so build it and the brush once
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const x = d3.scaleLinear().domain(yearRange).range([M.left, W - M.right]);
    xRef.current = x;

    svg.append("g").attr("class", "grid");
    svg.append("g").attr("class", "x-axis").attr("transform", `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(10));
    svg.append("g").attr("class", "y-axis").attr("transform", `translate(${M.left},0)`);
    svg.append("path").attr("class", "line-all").attr("fill", "none")
      .attr("stroke", ALL_COLOR).attr("stroke-width", 2);
    svg.append("path").attr("class", "line-sel").attr("fill", "none")
      .attr("stroke", SEL_COLOR).attr("stroke-width", 2);
    svg.append("text").attr("class", "y-label")
      .attr("transform", "rotate(-90)").attr("x", -(H - M.bottom + M.top) / 2).attr("y", 16)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#52514e");
    svg.append("text").attr("x", (W + M.left - M.right) / 2).attr("y", H - 6)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#52514e").text("Year");

    // Hover marker (drawn under the brush so the brush still gets the drag)
    const hover = svg.append("g").attr("class", "hover").style("display", "none");
    hover.append("line").attr("y1", M.top).attr("y2", H - M.bottom).attr("stroke", "#52514e").attr("stroke-dasharray", "3,3");
    hover.append("circle").attr("r", 4).attr("fill", SEL_COLOR).attr("stroke", "#fff").attr("stroke-width", 2);

    const brush = d3.brushX()
      .extent([[M.left, M.top], [W - M.right, H - M.bottom]])
      .on("end", (event) => {
        if (!event.sourceEvent) return;            // ignore moves we made ourselves
        if (!event.selection) return onYearsRef.current(null);
        const [y0, y1] = event.selection.map((px) => Math.round(x.invert(px)));
        onYearsRef.current(y0 === y1 ? null : [y0, y1]);
      });
    brushRef.current = brush;
    svg.append("g").attr("class", "brush").call(brush)
      .on("mousemove.tip", (event) => svg.node().dispatchEvent(new CustomEvent("hoverx", { detail: d3.pointer(event)[0] })))
      .on("mouseleave.tip", () => svg.node().dispatchEvent(new CustomEvent("hoverx", { detail: null })));

    return () => svg.selectAll("*").remove();
  }, [yearRange[0], yearRange[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw lines and y-axis whenever the data change
  useEffect(() => {
    if (!data) return;
    const svg = d3.select(svgRef.current);
    const x = xRef.current;
    const showAll = hasStationSel && context;
    const vals = [...data, ...(showAll ? context : [])].map((d) => d.value).filter((v) => v != null);
    const ext = d3.extent([0, ...vals]);
    const y = d3.scaleLinear().domain(ext).nice().range([H - M.bottom, M.top]);

    svg.select(".y-axis").call(d3.axisLeft(y).ticks(6)).call((g) => g.select(".domain").remove());
    svg.select(".grid").call((g) => g.selectAll("line").data(y.ticks(6)).join("line")
      .attr("x1", M.left).attr("x2", W - M.right).attr("y1", y).attr("y2", y)
      .attr("stroke", (d) => (d === 0 ? "#52514e" : "#e8e7e3")).attr("stroke-width", (d) => (d === 0 ? 1 : 0.5)));
    svg.select(".y-label").text(`Departure from normal (${unit.replace(" of normal", "")})`);

    const line = d3.line().defined((d) => d.value != null).x((d) => x(d.year)).y((d) => y(d.value));
    svg.select(".line-sel").attr("d", line(data));
    svg.select(".line-all").attr("d", showAll ? line(context) : null);

    // Hover tooltip: nearest year
    const byYear = new Map(data.map((d) => [d.year, d]));
    const allByYear = new Map((context || []).map((d) => [d.year, d]));
    const hover = svg.select(".hover");
    const tip = d3.select(tipRef.current);
    const onHover = (e) => {
      const px = e.detail;
      const d = px == null ? null : byYear.get(Math.round(x.invert(px)));
      if (!d || d.value == null) { hover.style("display", "none"); tip.style("display", "none"); return; }
      hover.style("display", null);
      hover.select("line").attr("x1", x(d.year)).attr("x2", x(d.year));
      hover.select("circle").attr("cx", x(d.year)).attr("cy", y(d.value));
      const sign = (v) => (v > 0 ? "+" : "") + v;
      const all = allByYear.get(d.year);
      tip.style("display", "block")
        .style("left", `${(x(d.year) / W) * 100}%`)
        .html(`<strong>${d.year}</strong><br>${sign(d.value)} ${unit}` +
          `<br><span style="color:#52514e">${d.n_stations} station${d.n_stations === 1 ? "" : "s"}</span>` +
          (showAll && all ? `<br><span style="color:#52514e">All stations: ${sign(all.value)}</span>` : ""));
    };
    const node = svg.node();
    node.addEventListener("hoverx", onHover);
    return () => node.removeEventListener("hoverx", onHover);
  }, [data, context, hasStationSel, unit, baseline]);

  // Keep the brush in sync with the shared selection (e.g. after Reset)
  useEffect(() => {
    const x = xRef.current;
    const g = d3.select(svgRef.current).select(".brush");
    g.call(brushRef.current.move, years ? years.map(x) : null);
  }, [years]);

  return (
    <figure className={`view${loading ? " loading" : ""}`}>
      <h2><span className="step">3</span>Since when? Yearly departure from normal</h2>
      {hasStationSel && (
        <div className="legend">
          <span><i style={{ background: SEL_COLOR }} /> Selected stations</span>
          <span><i style={{ background: ALL_COLOR }} /> All stations</span>
        </div>
      )}
      <div style={{ position: "relative" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
             aria-label="Line chart of yearly temperature departure from normal" />
        <div ref={tipRef} className="tooltip" />
      </div>
      <figcaption>
        Each point is the average departure from the {baseline[0]}–{baseline[1]} normal across the
        selected stations and months. <strong>Drag across the chart</strong> to select a range of years;
        click outside the selection to clear it.
      </figcaption>
    </figure>
  );
}