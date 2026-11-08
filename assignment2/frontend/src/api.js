export const API = "http://localhost:8000";

// Turn the shared selection into query parameters
// skip names is the filter a view must ignore (its own selection)

export function selectionParams(sel, skip){
    const skips = [].concat(skip)
    const p = new URLSearchParams({var: sel.var});
    if (!skips.includes("stations") && sel.stations.length) p.set("stations", sel.stations.join(","));
    if(!skips.includes("years") && sel.years) {
        p.set("year_min", sel.years[0]);
        p.set("year_max", sel.years[1]);
    }
    if(!skips.includes("months") && sel.months.length) p.set("months", sel.months.join(","));
    return p;
}

export async function getJSON(path, params, signal) {
    const url = `${API}${path}${params ? `?${params}` : ""}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`${res.status} from ${url}`);
    return res.json();
}