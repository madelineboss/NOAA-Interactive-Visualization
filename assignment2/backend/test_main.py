"""
Tests for main.py. Run from the backend/ folder:
    pytest -v
"""
from fastapi.testclient import TestClient

from main import app, stations

client = TestClient(app)
ONE_STATION = stations["id"].iloc[0]


def test_meta():
    r = client.get("/api/meta")
    assert r.status_code == 200
    m = r.json()
    assert m["year_min"] == 1950
    assert m["year_max"] == 2025
    assert m["n_stations"] == len(stations)
    assert len(m["states"]) == 48


def test_stations_returns_every_station():
    # The map keeps all stations, even when years/months are filtered
    all_ = client.get("/api/stations").json()
    winter = client.get("/api/stations", params={"months": "12,1,2", "year_min": 1991}).json()
    assert len(all_) == len(winter) == len(stations)
    assert {"id", "lat", "lon", "value"} <= set(winter[0])


def test_timeseries_covers_all_years():
    rows = client.get("/api/timeseries").json()
    years = [r["year"] for r in rows]
    assert years[0] == 1950 and years[-1] == 2025


def test_timeseries_station_filter():
    rows = client.get("/api/timeseries", params={"stations": ONE_STATION}).json()
    assert rows, "selected station returned no data"
    assert all(r["n_stations"] == 1 for r in rows)


def test_seasonal_has_12_months():
    rows = client.get("/api/seasonal").json()
    assert [r["month"] for r in rows] == list(range(1, 13))


def test_seasonal_matches_notebook():
    # The notebook printed +1.11 °C for January, 1991–2025 vs 1961–1990
    jan = client.get("/api/seasonal", params={"year_min": 1991}).json()[0]
    assert abs(jan["value"] - 1.11) < 0.01


def test_baseline_anomaly_is_near_zero():
    # Averaged over the baseline period itself, anomalies should cancel out
    rows = client.get("/api/seasonal", params={"year_min": 1961, "year_max": 1990}).json()
    assert all(abs(r["value"]) < 0.05 for r in rows)


def test_every_variable_works():
    for var in ["tavg", "tmax", "tmin", "prcp", "hot_days", "frost_days"]:
        for path in ["/api/stations", "/api/timeseries", "/api/seasonal"]:
            assert client.get(path, params={"var": var}).status_code == 200, (var, path)


def test_bad_variable_rejected():
    assert client.get("/api/seasonal", params={"var": "bogus"}).status_code == 422
    