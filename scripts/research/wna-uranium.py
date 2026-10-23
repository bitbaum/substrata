#!/usr/bin/env python3
"""
Uranium mined by country, from the World Nuclear Association's "World Uranium
Mining Production" page, plus identified recoverable resources (the OECD-NEA /
IAEA Red Book figures that page reprints).

Writes research/wna-uranium.json in the same table shape as research/usgs-mcs.json
and research/eia-energy.json (chapters → columns → rows → cells), so
lib/resources reads all three the same way. Uranium is the one resource the
directory names for a country like Niger that neither USGS's chapters nor the
EIA bulk file measure; without this table Niger's headline led with oil.

    python3 scripts/research/wna-uranium.py            # fetch + parse + write
    python3 scripts/research/wna-uranium.py --check    # parse, print, write nothing

Rules kept from the other fetchers: every value is printed as the source
prints it ("(est.)" on a country marks every one of its cells estimated), the
world row is the page's own "World total tU", and "Others" is kept as a row
of kind "other" so the countries add up to the total. The latest two years
of production are written; the full ten-year run stays on the page.
"""
import json
import re
import sys
import urllib.request
from datetime import date
from html import unescape
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "wna-uranium.json"
URL = (
    "https://world-nuclear.org/information-library/nuclear-fuel-cycle/"
    "mining-of-uranium/world-uranium-mining-production"
)
PRODUCTION_HEADING = "Production from mines (tonnes U)"

ISO2 = {
    "Kazakhstan": "kz",
    "Canada": "ca",
    "Namibia": "na",
    "Australia": "au",
    "Uzbekistan": "uz",
    "Russia": "ru",
    "China": "cn",
    "Niger": "ne",
    "India": "in",
    "South Africa": "za",
    "Ukraine": "ua",
    "USA": "us",
    "United States": "us",
    "Brazil": "br",
    "Mongolia": "mn",
    "Tanzania": "tz",
    "Malawi": "mw",
    "Pakistan": "pk",
    "Iran": "ir",
    "Czech Republic": "cz",
    "Romania": "ro",
}
NAME = {"USA": "United States"}


def fetch() -> str:
    req = urllib.request.Request(URL, headers={"User-Agent": "substrata-research"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read().decode("utf-8", "replace")


def tables(html: str) -> list[list[list[str]]]:
    out = []
    for table in re.findall(r"<table.*?</table>", html, re.S):
        rows = []
        for tr in re.findall(r"<tr.*?</tr>", table, re.S):
            cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)
            rows.append([unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in cells])
        out.append(rows)
    return out


def updated_on(html: str) -> str:
    text = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", html)))
    m = re.search(r"Updated \w+, (\d{1,2}) (\w+) (\d{4})", text)
    if not m:
        raise SystemExit("WNA page: no 'Updated' date found; the page layout changed")
    months = ["January", "February", "March", "April", "May", "June", "July", "August",
              "September", "October", "November", "December"]
    return f"{m.group(3)}-{months.index(m.group(2)) + 1:02d}-{int(m.group(1)):02d}"


def cell(raw: str, estimated: bool) -> dict:
    value = int(raw.replace(",", ""))
    out = {"raw": raw, "value": value}
    if estimated:
        out["estimated"] = True
    return out


def country_row(name: str, cells: dict) -> dict:
    estimated = "(est.)" in name
    clean = name.replace("(est.)", "").strip()
    row = {"name": NAME.get(clean, clean), "kind": "country", "iso2": ISO2[clean], "cells": {}, "footnotes": []}
    for key, raw in cells.items():
        row["cells"][key] = cell(raw, estimated)
    return row


def parse(html: str) -> dict:
    found = tables(html)
    production = next(t for t in found if t and t[0] and t[0][0] == "Country" and t[0][-1].isdigit())
    resources = next(t for t in found if t and t[0] and t[0][1:] == ["tonnes U", "percentage of world"])
    years = [int(y) for y in production[0][1:]]
    latest = years[-2:]
    columns = [
        {"key": f"mine:{y}", "measure": "production", "stage": "mine", "year": y, "unit": "t"}
        for y in latest
    ]
    reserves_year = 2025
    columns.append(
        {"key": f"reserves:{reserves_year}", "measure": "reserves", "product": "identified resources recoverable to $130/kgU",
         "year": reserves_year, "unit": "t"}
    )
    rows = []
    for line in production[1:]:
        name, values = line[0], dict(zip([f"mine:{y}" for y in years], line[1:]))
        picked = {k: values[k] for k in (f"mine:{y}" for y in latest)}
        if name == "Others":
            rows.append({"name": "Other countries", "kind": "other", "cells": {k: cell(v, False) for k, v in picked.items()}, "footnotes": []})
        elif name == "World total tU":
            rows.append({"name": "World", "kind": "world", "cells": {k: cell(v, False) for k, v in picked.items()}, "footnotes": []})
        elif name.startswith("World total") or name.startswith("%"):
            continue
        else:
            rows.append(country_row(name, picked))
    by_iso = {r["iso2"]: r for r in rows if r["kind"] == "country"}
    rkey = f"reserves:{reserves_year}"
    for line in resources[1:]:
        name, raw = line[0], line[1]
        if name == "World total":
            next(r for r in rows if r["kind"] == "world")["cells"][rkey] = cell(raw, False)
        elif name == "Other":
            next(r for r in rows if r["kind"] == "other")["cells"][rkey] = cell(raw, False)
        else:
            iso = ISO2[name]
            if iso not in by_iso:
                row = {"name": NAME.get(name, name), "kind": "country", "iso2": iso, "cells": {}, "footnotes": []}
                rows.append(row)
                by_iso[iso] = row
            by_iso[iso]["cells"][rkey] = cell(raw, False)
    return {
        "slug": "wna-uranium",
        "commodity": "Uranium",
        "resource": "uranium",
        "source": "WNA",
        "edition": f"World Nuclear Association, World Uranium Mining Production, updated {updated_on(html)}",
        "url": URL,
        "table": PRODUCTION_HEADING,
        "unit": "t",
        "unitQuote": "tonnes U (uranium metal content); identified resources are tonnes U recoverable to $130/kgU as of 1 January 2025",
        "primary": "mine",
        "columns": columns,
        "rows": rows,
        "footnotes": {
            "1": "Identified resources recoverable (reasonably assured plus inferred), to $130/kg U, as of 1 January 2025, from OECD NEA & IAEA, Uranium 2026: Resources, Production and Demand (the Red Book), as reprinted by the WNA.",
            "2": "A country marked (est.) on the WNA page has every year's figure estimated.",
        },
        "events": "",
    }


def check(chapter: dict) -> list[str]:
    problems = []
    for col in chapter["columns"]:
        if col["measure"] != "production":
            continue
        key = col["key"]
        world = next(r for r in chapter["rows"] if r["kind"] == "world")["cells"][key]["value"]
        total = sum(r["cells"].get(key, {}).get("value", 0) for r in chapter["rows"] if r["kind"] != "world")
        if abs(total - world) / world > 0.01:
            problems.append(f"{key}: countries + others = {total}, world total = {world}")
    return problems


def main() -> None:
    html = fetch()
    chapter = parse(html)
    problems = check(chapter)
    if problems:
        raise SystemExit("WNA table does not add up:\n  " + "\n  ".join(problems))
    doc = {
        "source": "World Nuclear Association, World Uranium Mining Production",
        "url": URL,
        "licence": "© World Nuclear Association; figures reprinted as published, with attribution",
        "retrieved": date.today().isoformat(),
        "updated": updated_on(html),
        "gaps": [],
        "chapters": [chapter],
    }
    if "--check" in sys.argv:
        print(json.dumps(doc, indent=1, ensure_ascii=False))
        return
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(chapter['rows'])} rows")


if __name__ == "__main__":
    main()
