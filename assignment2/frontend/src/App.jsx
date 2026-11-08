import { useCallback, useEffect, useState } from "react";
import { API, getJSON, selectionParams } from "./api";
import Timeline from "./Timeline";
import Seasonal from "./Seasonal";
import MapView from "./MapView";
import { SEASONS, REGIONS } from "./groups";

// Views read it and ask App to change it; none keeps its own copy.
const EMPTY = { var: "tavg", stations: [], years: null, months: [] };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Fetch `path` again whenever its params change; cancel stale requests.
// Returns { data, loading, error }. Old data stays visible while new data loads.
function useApi(path, params) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const key = params?.toString();
  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    getJSON(path, key, ctrl.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((e) => {
        if (e.name !== "AbortError") setState((s) => ({ ...s, loading: false, error: e }));
      });
    return () => ctrl.abort();
  }, [path, key]);
  return state;
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Plain-language description of each part of the selection, for the summary bar
function describe(sel, stationData) {
  const parts = [];
  if (sel.months.length) {
    const season = Object.entries(SEASONS).find(([, ms]) => sameSet(ms, sel.months));
    parts.push({ key: "months", label: season ? season[0] : sel.months.map((m) => MONTH_NAMES[m - 1]).join(", ") });
  }
  if (sel.stations.length) {
    const region = Object.entries(REGIONS).find(([, codes]) => {
      const ids = (stationData || []).filter((d) => codes.includes(d.state)).map((d) => d.id);
      return ids.length && sameSet(ids, sel.stations);
    });
    const n = sel.stations.length;
    parts.push({ key: "stations", label: region ? `${region[0]} (${n} stations)` : `${n} station${n === 1 ? "" : "s"}` });
  }
  if (sel.years) parts.push({ key: "years", label: `${sel.years[0]}–${sel.years[1]}` });
  return parts;
}

export default function App() {
  const [sel, setSel] = useState(EMPTY);
  // Stable callbacks, so the charts don't redraw on every render
  const onYears = useCallback((years) => setSel((s) => ({ ...s, years })), []);
  const onMonths = useCallback((months) => setSel((s) => ({ ...s, months })), []);
  const onStations = useCallback((stations) => setSel((s) => ({ ...s, stations })), []);
  const clear = (key) => setSel((s) => ({ ...s, [key]: EMPTY[key] }));

  const meta = useApi("/api/meta");
  // Each view skips its own filter (see backend docstring)
  const stations = useApi("/api/stations", selectionParams(sel, "stations"));
  const timeseries = useApi("/api/timeseries", selectionParams(sel, "years"));
  const timeseriesAll = useApi("/api/timeseries", selectionParams(sel, ["years", "stations"]));
  const seasonal = useApi("/api/seasonal", selectionParams(sel, "months"));

  if (meta.error) {
    return (
      <main>
        <div className="error">
          <strong>Can't reach the backend at {API}.</strong> Start it from the backend folder with{" "}
          <code>uvicorn main:app --reload --port 8000</code>, then refresh this page.
        </div>
      </main>
    );
  }
  if (!meta.data) return <main><p>Loading…</p></main>;

  const m = meta.data;
  const unit = m.variables[sel.var].unit;
  const rawUnit = sel.var === "prcp" ? "mm" : unit;   // actual/normal precipitation is in mm, not %
  const parts = describe(sel, stations.data);
  const failed = [stations, timeseries, seasonal].some((r) => r.error);

  return (
    <main>
      <header className="header">
        <div>
          <h1>Is U.S. warming uniform?</h1>
          <p className="intro">
            Temperature, precipitation and extreme days at {m.n_stations} long-running NOAA weather
            stations, {m.year_min}–{m.year_max}, compared with each station's {m.baseline[0]}–{m.baseline[1]} normal.
            Start with <strong>which months</strong> changed most, then see <strong>where</strong>,
            then <strong>since when</strong>. Every selection updates the other views.
          </p>
        </div>
        <div className="controls">
          <label>
            Variable{" "}
            <select value={sel.var} onChange={(e) => setSel((s) => ({ ...s, var: e.target.value }))}>
              {Object.entries(m.variables).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
          </label>
          <button className="reset" onClick={() => setSel(EMPTY)}>Reset all</button>
        </div>
      </header>

      <div className="summary">
        <span className="summary-label">Showing:</span>
        {parts.length === 0 && <span>All months · All stations · All years</span>}
        {parts.map((p) => (
          <span key={p.key} className="chip">
            {p.label}
            <button aria-label={`Clear ${p.key}`} onClick={() => clear(p.key)}>×</button>
          </span>
        ))}
      </div>

      {failed && (
        <div className="error">Some data failed to load. Check the backend terminal for errors.</div>
      )}

      <div className="dashboard">
        <div className="area-seasonal">
          <Seasonal
            data={seasonal.data}
            loading={seasonal.loading}
            months={sel.months}
            onMonths={onMonths}
            variable={sel.var}
            unit={unit}
            rawUnit={rawUnit}
            baseline={m.baseline}
          />
        </div>
        <div className="area-map">
          <MapView
            data={stations.data}
            loading={stations.loading}
            selected={sel.stations}
            onStations={onStations}
            variable={sel.var}
            unit={unit}
          />
        </div>
        <div className="area-timeline">
          <Timeline
            data={timeseries.data}
            context={timeseriesAll.data}
            loading={timeseries.loading}
            years={sel.years}
            onYears={onYears}
            yearRange={[m.year_min, m.year_max]}
            baseline={m.baseline}
            unit={unit}
            hasStationSel={sel.stations.length > 0}
          />
        </div>
      </div>

      <footer className="footer">
        Data: NOAA Global Historical Climatology Network – Daily (GHCN-Daily), U.S. Historical Climatology
        Network stations. Anomalies are departures from each station's {m.baseline[0]}–{m.baseline[1]} average
        for the same month.
      </footer>
    </main>
  );
}