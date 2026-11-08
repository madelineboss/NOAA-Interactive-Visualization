from pathlib import Path
from typing import Literal

import numpy as np 
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="GHCN-Daily Dashboard API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

#------------------Load and prepare the data once, at startup --------------------#
DATA = Path(__file__).parent / "data"    #repo-root data/ folder
BASE_START, BASE_END = 1961, 1990

VARS = {
    "tavg":         {"label": "Average temperature", "unit": "°C"},
    "tmax":         {"label": "Daily high",          "unit": "°C"},
    "tmin":         {"label": "Daily low",           "unit": "°C"},
    "prcp":         {"label": "Precipitation",       "unit": "°C"},
    "hot_days":     {"label": "Days >= 90 °F",       "unit": "°C"},
    "frost_days":   {"label": "Frost days",          "unit": "°C"},
}

Var = Literal["tavg", "tmax", "tmin", "prcp", "hot_days", "frost_days"]

stations = pd.read_csv(DATA / "stations.csv")
monthly = pd.read_csv(DATA / "monthly.csv")

#Each station's 1961-1990 avg for each calendar month, normal
base = (monthly[monthly["year"].between(BASE_START, BASE_END)]
        .groupby(["id", "month"])[list(VARS)].mean()
        .add_suffix("_base"))
monthly = monthly.join(base, on=["id", "month"])


#Anomoly = departure from normal. Precipitation as a percentage
#10mm extra means a lot in Arizona and little in Florida
for v in VARS:
    monthly[f"{v}_anom"] = monthly[v] - monthly[f"{v}_base"]

monthly["prcp_anom"] = (monthly["prcp"] / monthly["prcp_base"] * 100 - 100).replace([np.inf, -np.inf], np.nan)

print(f"Loaded {len(stations)} stations, {len(monthly):,} station-months")


#---------Helpers-----------------#
def parse_list(text: str | None, cast=str):
    if not text:
        return None
    return [cast(x) for x in text.split(",") if x.strip()]

def apply_filters(df, stations=None, year_min=None, year_max = None, months = None):
    if stations:
        df = df[df["id"].isin(parse_list(stations))]

    if year_min is not None:
        df = df[df["year"] >= year_min]

    if year_max is not None:
        df = df[df["year"] <= year_max]

    if months:
        df = df[df["month"].isin(parse_list(months, int))]

    return df

def to_records(df):
    #DataFrame -> JSON-safe list of dics, nan becomes Null
    df = df.round(2).astype(object)
    return df.where(df.notna(), None).to_dict(orient="records")


#----------Endpoints-------------#
@app.get("/api/meta")
def meta():
    return{
        "year_min": int(monthly["year"].min()),
        "year_max": int(monthly["year"].max()),
        "baseline": [BASE_START, BASE_END],
        "variables": VARS,
        "states": sorted(stations["state"].unique().tolist()),
        "n_stations": len(stations),
    }

@app.get("/api/stations")
def station_values(var: Var = "tavg", year_min: int | None = None, year_max: int | None = None, 
                   months: str | None = None):
    #Map every station with its average anomoly for the selected years and months
    col = f"{var}_anom"
    df = apply_filters(monthly, year_min=year_min, year_max=year_max, months=months)
    vals = df.groupby("id")[col].agg(value="mean", n_months="count").reset_index()
    out = stations.merge(vals, on="id", how="left")
    return to_records(out)

@app.get("/api/timeseries")
def timeseries(var: Var = "tavg", stations: str | None = None, months: str | None = None):
    #Timeline: avg anomoly per year across the selected stations and months
    col = f"{var}_anom"
    df = apply_filters(monthly, stations=stations, months = months).dropna(subset=[col])
    #Average each station's year first, so stations with more months don't count more
    per_station = df.groupby(["id", "year"])[col].mean().reset_index()
    out = (per_station.groupby("year")[col]
           .agg(value="mean", n_stations="count").reset_index())
    return to_records(out)

@app.get("/api/seasonal")
def seasonal(var: Var = "tavg", stations: str | None = None, year_min: int | None = None, year_max: int | None = None):
    #Seasonal chart: for each month, the selected years compared with the 1961-1990 normal
    col = f"{var}_anom"
    df = apply_filters(monthly, stations=stations, year_min=year_min, year_max=year_max)
    df = df.dropna(subset=[col])
    out = (df.groupby("month")
           .agg(value=(col, "mean"), actual=(var, "mean"), normal=(f"{var}_base", "mean"),
                n=(col, "count"))
            .reindex(range(1,13)).rename_axis("month").reset_index())
    return to_records(out)