import {useEffect, useState} from "react";
import {getJSON, selectionParams} from "./api";

//views read it and ask App to change it; none keeps it own copy
const EMPTY = {var: "tavg", stations:[], years: null, months: []};

//fetch path again whenever its params change; cancel the stale requests
function useApi(path, params) {
    const [data, setData] = useState(null);
    const key = params?.toString();
    useEffect(() =>{
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
 
  const meta = useApi("/api/meta");
  // Each view skips its own filter (see backend docstring)
  const stations = useApi("/api/stations", selectionParams(sel, "stations"));
  const timeseries = useApi("/api/timeseries", selectionParams(sel, "years"));
  const seasonal = useApi("/api/seasonal", selectionParams(sel, "months"));
 
  if (!meta) return <p>Loading… (is the backend running on port 8000?)</p>;
 
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
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
 
      {/* Step 1 only: test buttons that fake what the charts will do */}
      <h2>Test the shared state</h2>
      <button onClick={() => update({ months: [12, 1, 2] })}>Select winter</button>{" "}
      <button onClick={() => update({ years: [1991, 2025] })}>Select 1991–2025</button>{" "}
      <button onClick={() => update({ stations: stations.slice(0, 5).map((s) => s.id) })}>
        Select 5 stations
      </button>
 
      <pre>selection = {JSON.stringify(sel, null, 2)}</pre>
      <pre>
        {`map:      ${stations?.length} stations, first value ${stations?.[0]?.value}
timeline: ${timeseries?.length} years, 2024 value ${timeseries?.find((d) => d.year === 2024)?.value}
seasonal: January value ${seasonal?.[0]?.value}`}
      </pre>
    </main>
  );
}