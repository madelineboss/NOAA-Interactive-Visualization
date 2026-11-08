import { useCallback, useEffect, useState } from "react";
import { getJSON, selectionParams } from "./api";
import Timeline from "./Timeline";
import Seasonal from "./Seasonal";
import MapView from "./MapView";

// The single source of truth for what the user has selected.
// Views read it and ask App to change it; none keeps its own copy.
const EMPTY = { var: "tavg", stations: [], years: null, months: [] };

// Fetch `path` again whenever its params change; cancel stale requests.
function useApi(path, params) {
  const [data, setData] = useState(null);
  const key = params?.toString();
  useEffect(() => {
    const ctrl = new AbortController();
    getJSON(path, key, ctrl.signal)
      .then(setData)
      .catch((e) => e.name !== "AbortError" && console.error(e));
    return () => ctrl.abort();
  }, [path, key]);
  return data;
}

export default function App() {
  const [sel, setSel] = useState(EMPTY);
  const update = (changes) => setSel((s) => ({ ...s, ...changes }));
  // Stable callbacks, so the charts don't redraw on every render
  const onYears = useCallback((years) => setSel((s) => ({ ...s, years })), []);
  const onMonths = useCallback((months) => setSel((s) => ({ ...s, months })), []);
  const onStations = useCallback((stations) => setSel((s) => ({ ...s, stations })), []);

  const meta = useApi("/api/meta");
  // Each view skips its own filter (see backend docstring)
  const stations = useApi("/api/stations", selectionParams(sel, "stations"));
  const timeseries = useApi("/api/timeseries", selectionParams(sel, "years"));
  const timeseriesAll = useApi("/api/timeseries", selectionParams(sel, ["years", "stations"]));
  const seasonal = useApi("/api/seasonal", selectionParams(sel, "months"));

  if (!meta) return <p>Loading… (is the backend running on port 8000?)</p>;
  const unit = meta.variables[sel.var].unit;
  const rawUnit = sel.var === "prcp" ? "mm" : unit;   // actual/normal precipitation is in mm, not %

  return (
    <main>
      <h1>U.S. Warming by Region and Season</h1>

      <label>
        Variable{" "}
        <select value={sel.var} onChange={(e) => update({ var: e.target.value })}>
          {Object.entries(meta.variables).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
      </label>{" "}
      <button onClick={() => setSel(EMPTY)}>Reset</button>

      <MapView
        data={stations}
        selected={sel.stations}
        onStations={onStations}
        variable={sel.var}
        unit={unit}
      />

      <Timeline
        data={timeseries}
        context={timeseriesAll}
        years={sel.years}
        onYears={onYears}
        yearRange={[meta.year_min, meta.year_max]}
        baseline={meta.baseline}
        unit={unit}
        hasStationSel={sel.stations.length > 0}
      />

      <div className="seasonal-wrap">
        <Seasonal
          data={seasonal}
          months={sel.months}
          onMonths={onMonths}
          variable={sel.var}
          unit={unit}
          rawUnit={rawUnit}
          baseline={meta.baseline}
        />
      </div>

      {/* Temporary: shows the shared selection while we build. Removed in step 6. */}
      <pre style={{ fontSize: 12, color: "#52514e" }}>selection = {JSON.stringify(sel)}</pre>
    </main>
  );
}