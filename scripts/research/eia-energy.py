#!/usr/bin/env python3
"""
Oil, natural gas, coal and hydropower by country, from the EIA International
Energy Statistics bulk file (https://api.eia.gov/bulk/INTL.zip — no key, US
Government work, public domain).

Writes research/eia-energy.json in the same table shape as research/usgs-mcs.json
(chapters → columns → rows → cells), so lib/resources reads both the same way.

    python3 scripts/research/eia-energy.py

What EIA does not publish here, and so this file does not have: oil and gas
reserves (EIA's international reserve figures came from the Oil & Gas Journal
and are no longer in the bulk file), and uranium. Those are listed as gaps,
not filled from elsewhere.
"""
import io
import json
import sys
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "eia-energy.json"
BULK = "https://api.eia.gov/bulk/INTL.zip"
BROWSER = "https://www.eia.gov/international/data/world"
ISO_CODES = Path("/usr/share/iso-codes/json/iso_3166-1.json")  # Debian/Ubuntu package iso-codes

# (resource, commodity, series-id pattern for production, unit, label, reserves pattern or None, reserves unit)
TABLES = [
    ("oil", "Crude oil including lease condensate", "INTL.57-1-{g}-TBPD.A", "kb/d", None, None),
    ("natural-gas", "Dry natural gas", "INTL.26-1-{g}-BCM.A", "bcm", None, None),
    ("coal", "Coal", "INTL.7-1-{g}-MT.A", "kt", "INTL.7-6-{g}-MST.A", "Mst"),
    ("hydropower", "Hydroelectricity net generation", "INTL.33-12-{g}-BKWH.A", "TWh", None, None),
]
UNIT_NOTE = {
    "kb/d": "thousand barrels per day",
    "bcm": "billion cubic metres",
    "kt": "thousand metric tons",
    "Mst": "million short tons",
    "TWh": "billion kilowatthours",
}


def iso3_to_iso2() -> dict[str, str]:
    if not ISO_CODES.exists():
        raise SystemExit(f"{ISO_CODES} missing — install the iso-codes package")
    rows = json.loads(ISO_CODES.read_text())["3166-1"]
    return {r["alpha_3"]: r["alpha_2"].lower() for r in rows}


def main() -> None:
    req = urllib.request.Request(BULK, headers={"User-Agent": "substrata-research"})
    with urllib.request.urlopen(req, timeout=300) as res:
        archive = zipfile.ZipFile(io.BytesIO(res.read()))
    series: dict[str, dict] = {}
    for line in archive.open(archive.namelist()[0]):
        d = json.loads(line)
        sid = d.get("series_id", "")
        if sid.endswith(".A"):
            series[sid] = d
    to2 = iso3_to_iso2()
    updated = max((s.get("last_updated") or "")[:10] for s in series.values())

    chapters = []
    for resource, commodity, prod_pat, unit, res_pat, res_unit in TABLES:
        world = series[prod_pat.format(g="WORL")]
        world_data = {y: v for y, v in world["data"] if isinstance(v, (int, float))}
        years = sorted(world_data)[-2:]
        y0, y1 = int(years[0]), int(years[1])
        columns = [
            {"key": f"production:{y0}", "measure": "production", "stage": "production", "year": y0},
            {"key": f"production:{y1}", "measure": "production", "stage": "production", "year": y1},
        ]
        res_year = None
        if res_pat:
            res_world = series.get(res_pat.format(g="WORL"))
            res_year = max(int(y) for y, v in res_world["data"] if isinstance(v, (int, float)))
            columns.append({"key": "reserves", "measure": "reserves", "year": res_year, "unit": res_unit})
        rows = []
        for sid, d in series.items():
            g = d.get("geography", "")
            if not (len(g) == 3 and g in to2 and sid == prod_pat.format(g=g)):
                continue
            values = {y: v for y, v in d["data"]}
            cells = {}
            for col, y in ((columns[0], y0), (columns[1], y1)):
                v = values.get(str(y))
                if isinstance(v, (int, float)):
                    cells[col["key"]] = {"raw": str(v), "value": round(v, 3)}
            if res_pat:
                r = series.get(res_pat.format(g=g))
                v = dict(r["data"]).get(str(res_year)) if r else None
                if isinstance(v, (int, float)):
                    cells["reserves"] = {"raw": str(v), "value": round(v, 3)}
            if any(c.get("value", 0) > 0 for c in cells.values()):
                rows.append({"name": d["name"].split(", ")[-2], "kind": "country", "iso2": to2[g], "cells": cells, "footnotes": []})
        rows.sort(key=lambda r: -r["cells"].get(f"production:{y1}", {}).get("value", 0))
        wcells = {f"production:{y}": {"raw": str(world_data[str(y)]), "value": round(world_data[str(y)], 3)} for y in (y0, y1)}
        if res_pat:
            v = dict(series[res_pat.format(g="WORL")]["data"]).get(str(res_year))
            wcells["reserves"] = {"raw": str(v), "value": round(v, 3)}
        rows.append({"name": "World", "kind": "world", "cells": wcells, "footnotes": []})
        chapters.append(
            {
                "slug": f"eia-{resource}",
                "commodity": commodity,
                "resource": resource,
                "source": "EIA International Energy Statistics",
                "edition": f"EIA international bulk file, updated {updated}",
                "url": BROWSER,
                "table": f"{commodity}, annual (series {prod_pat.format(g='<ISO3>')})",
                "unit": unit,
                "unitQuote": UNIT_NOTE[unit] + (f"; reserves in {UNIT_NOTE[res_unit]}" if res_unit else ""),
                "primary": "production",
                "columns": columns,
                "rows": rows,
                "footnotes": {},
                "events": "",
            }
        )
    doc = {
        "source": "EIA International Energy Statistics",
        "bulk": BULK,
        "licence": "US Government work, public domain",
        "retrieved": date.today().isoformat(),
        "updated": updated,
        "gaps": [
            "Oil and natural gas reserves: not in the EIA bulk file (formerly Oil & Gas Journal figures). Energy Institute Statistical Review has them under its own licence; not read.",
            "Uranium: not in EIA international data. The OECD-NEA/IAEA 'Red Book' publishes it as a PDF report; not read.",
        ],
        "chapters": chapters,
    }
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: " + ", ".join(f"{c['resource']} {len(c['rows']) - 1} countries" for c in chapters))


if __name__ == "__main__":
    main()
