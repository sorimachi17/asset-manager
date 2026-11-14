#!/usr/bin/env python3
"""Refresh public F&G and VIX histories for the static asset dashboard.

Nikkei 225 VI is deliberately excluded: its licensing does not authorize
republishing its daily history in this public repository. Users import it
privately in the browser instead.
"""
from __future__ import annotations

import csv
import io
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone, date
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "market-data.json"
HEADERS = {"User-Agent": "AssetManagerPersonal/1.0 (GitHub Actions)", "Accept": "text/csv,*/*"}
FEEDS = {
    "fg": [
        ("https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed.csv", "whit3rabbit/fear-greed-data (MIT)"),
    ],
    "vix": [
        ("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv", "Cboe official"),
        ("https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS", "FRED VIXCLS"),
    ],
}

def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=35) as result:
        raw = result.read()
    return raw.decode("utf-8-sig")

def parse_day(value: str) -> str:
    raw = str(value).strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return ""

def parse_csv(body: str, series: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(body))
    if not reader.fieldnames:
        raise ValueError("no CSV header")
    headers = {name.lower().strip().replace(" ", "").replace("_", ""): name for name in reader.fieldnames if name}
    day_name = next((headers[k] for k in ("date", "observationdate") if k in headers), None)
    value_keys = ("feargreed", "score", "value") if series == "fg" else ("close", "vixcls", "value")
    value_name = next((headers[k] for k in value_keys if k in headers), None)
    if not day_name or not value_name:
        raise ValueError("unsupported CSV columns: " + str(reader.fieldnames))
    rows = {}
    for row in reader:
        day = parse_day(row.get(day_name, ""))
        raw = str(row.get(value_name) or "").strip().replace(",", "")
        if not day or not raw or raw == ".":
            continue
        try:
            value = float(raw)
        except ValueError:
            continue
        if not (0 <= value <= (100 if series == "fg" else 250)):
            continue
        rows[day] = value
    if not rows:
        raise ValueError("no valid observations")
    return [{"date": day, "value": rows[day]} for day in sorted(rows)]

def read_previous() -> dict:
    if not OUTPUT.exists():
        return {"updated_at": None, "series": {"fg": [], "vix": []}, "sources": {}}
    try:
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if isinstance(data.get("series"), dict):
            return data
    except (ValueError, OSError):
        pass
    return {"updated_at": None, "series": {"fg": [], "vix": []}, "sources": {}}

def main() -> int:
    data = read_previous()
    data.setdefault("series", {})
    data.setdefault("sources", {})
    data.setdefault("last_errors", {})
    fresh = 0
    for series, candidates in FEEDS.items():
        errors = []
        for url, name in candidates:
            try:
                rows = parse_csv(fetch(url), series)
                newest = date.fromisoformat(rows[-1]["date"])
                age = (datetime.now(timezone.utc).date() - newest).days
                if age > 7 or age < -1:
                    raise ValueError(f"stale or future observations, latest {newest}")
                prior = data["series"].get(series, [])
                # Never lose old history due to a shorter upstream time window.
                merged = {r["date"]: r["value"] for r in prior if isinstance(r, dict) and "date" in r and "value" in r}
                merged.update({r["date"]: r["value"] for r in rows})
                data["series"][series] = [{"date": day, "value": merged[day]} for day in sorted(merged)]
                data["sources"][series] = name
                data["last_errors"].pop(series, None)
                fresh += 1
                print(series, name, "observations:", len(rows), "latest:", newest)
                break
            except Exception as exc:
                errors.append(f"{name}: {type(exc).__name__}: {exc}")
        else:
            data["last_errors"][series] = " | ".join(errors)[:400]
            print("ERROR", series, data["last_errors"][series], file=sys.stderr)
    if fresh:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    if fresh < len(FEEDS):
        print("Some indices could not be updated. Old data preserved.", file=sys.stderr)
    return 0 if fresh else 1

if __name__ == "__main__":
    raise SystemExit(main())
