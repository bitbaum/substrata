#!/usr/bin/env python3
"""
World production and reserves by country, from USGS Mineral Commodity Summaries.

Writes research/usgs-mcs.json. Every value carries the chapter PDF it was read
from, the table heading, the column it sits in, and the USGS markers on it
(e = estimated, W = withheld, NA = not available, > = "more than").

Why the PDFs and not the data release: the MCS data release on ScienceBase
(doi:10.5066/P14BRF29) sits behind a bot challenge that a script cannot pass,
so the machine-readable CSV is not fetchable here. The chapter PDFs on
pubs.usgs.gov are the same tables, public domain, and fetch without a key.
The parser reads word coordinates (pdftotext -bbox), so a superscript
footnote or "e" is recognised by its size and position rather than being
glued to the number beside it.

    python3 scripts/research/usgs-mcs.py            # fetch + parse + write
    python3 scripts/research/usgs-mcs.py --check    # parse, print, write nothing

Needs pdftotext (poppler-utils). Column semantics per chapter live in
scripts/research/usgs_mcs_chapters.py, and are verified against the header text
on every run: a chapter whose header no longer matches fails the script.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from datetime import date
from html import unescape
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))
from usgs_mcs_chapters import CHAPTERS, COUNTRY_ISO2, EDITION, EDITION_YEAR  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "usgs-mcs.json"
BASE = f"https://pubs.usgs.gov/periodicals/mcs{EDITION_YEAR}/mcs{EDITION_YEAR}-"
SUPER_MAX_HEIGHT = 10.0  # body ~13.7pt tall in the bbox, footnote text ~10.9, superscripts 6.8–8.8

WORD = re.compile(
    r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>'
)
PAGE = re.compile(r"<page [^>]*>(.*?)</page>", re.S)
CELL = re.compile(r"^(>|<)?([\d,]+(?:\.\d+)?|W|NA|XX|Large|—|--|\(\d*\))$")


def fetch(slug: str, cache: Path) -> Path:
    path = cache / f"{slug}.pdf"
    if not path.exists():
        req = urllib.request.Request(BASE + slug + ".pdf", headers={"User-Agent": "substrata-research"})
        with urllib.request.urlopen(req, timeout=60) as res:
            path.write_bytes(res.read())
    return path


def pages(pdf: Path) -> list[list[dict]]:
    html = subprocess.run(
        ["pdftotext", "-bbox", str(pdf), "-"], capture_output=True, text=True, check=True
    ).stdout
    out = []
    for page in PAGE.findall(html):
        words = []
        for x0, y0, x1, y1, text in WORD.findall(page):
            x0, y0, x1, y1 = map(float, (x0, y0, x1, y1))
            words.append(
                {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "t": unescape(text), "small": y1 - y0 < SUPER_MAX_HEIGHT}
            )
        out.append(words)
    return out


def lines(words: list[dict]) -> list[list[dict]]:
    """Normal-size words grouped into visual lines by their top edge."""
    rows: list[list[dict]] = []
    for w in sorted((w for w in words if not w["small"]), key=lambda w: (w["y0"], w["x0"])):
        if rows and abs(rows[-1][0]["y0"] - w["y0"]) < 3:
            rows[-1].append(w)
        else:
            rows.append([w])
    return [sorted(r, key=lambda w: w["x0"]) for r in rows]


def text_of(line: list[dict]) -> str:
    return " ".join(w["t"] for w in line)


def parse_cell(raw: str) -> dict:
    cell: dict = {"raw": raw}
    m = CELL.match(raw)
    if not m:
        raise ValueError(f"not a cell: {raw!r}")
    prefix, body = m.group(1), m.group(2)
    if prefix == ">":
        cell["moreThan"] = True
    if prefix == "<":
        cell["lessThan"] = True
    if body in ("—", "--"):
        cell["value"] = 0
        cell["zero"] = True
    elif body == "W":
        cell["withheld"] = True
    elif body in ("NA", "XX"):
        cell["notAvailable"] = True
    elif body == "Large":
        cell["qualitative"] = "Large"
    elif body.startswith("("):
        cell["footnoteOnly"] = body.strip("()")
    else:
        cell["value"] = float(body.replace(",", ""))
        if cell["value"].is_integer():
            cell["value"] = int(cell["value"])
    return cell


def table_region(pages_words: list[list[dict]], heading: str):
    for words in pages_words:
        ls = lines(words)
        start = next((i for i, l in enumerate(ls) if text_of(l).startswith(heading)), None)
        if start is None:
            continue
        end = next(
            (i for i, l in enumerate(ls) if i > start and re.match(r"^(World Resources|Substitutes)", text_of(l))),
            len(ls),
        )
        return words, ls, start, end
    raise SystemExit(f"table heading not found: {heading!r}")


def superscripts(words, y_top, y_bottom, x_limit):
    return [w for w in words if w["small"] and y_top <= w["y0"] <= y_bottom and w["x0"] < x_limit]


def parse_chapter(ch: dict, cache: Path) -> dict:
    pdf = fetch(ch["slug"], cache)
    pw = pages(pdf)
    words, ls, start, end = table_region(pw, ch["heading"])
    x_limit = ch.get("xLimit", 10_000)
    header_text = " ".join(text_of([w for w in l if w["x0"] < x_limit]) for l in ls[start:end])
    for needle in ch["headerMustContain"]:
        if needle not in header_text:
            raise SystemExit(f"{ch['slug']}: header no longer contains {needle!r} — re-read the table")

    data_lines = []
    # Every MCS world table opens with the United States row; above it is prose and headers.
    first = next((i for i in range(start, end) if text_of(ls[i]).startswith("United States")), None)
    if first is None:
        raise SystemExit(f"{ch['slug']}: no United States row under {ch['heading']!r}")
    for l in ls[first:end]:
        l = [w for w in l if w["x0"] < x_limit]
        if not l:
            continue
        # "(4)" with a superscript 4 arrives as "(" and ")": a footnote in place of a value.
        l = [w for w in l if w["t"] not in ("(", ")", "( )")]
        cells = [w for w in l if CELL.match(w["t"])]
        name = [w for w in l if w not in cells]
        if not cells or not name or name[0]["x0"] > 120:
            continue
        # A name made only of years/labels is a header, not a row.
        if re.fullmatch(r"[\d\s]+", text_of(name)):
            continue
        data_lines.append((l, name, cells))

    # Column anchors: the row with the most cells defines where each column's right edge sits.
    ncols = len(ch["columns"])
    anchor = next((c for _, _, c in data_lines if len(c) == ncols), None)
    if anchor is None:
        raise SystemExit(f"{ch['slug']}: no row with {ncols} cells to anchor the columns")
    anchors = [w["x1"] for w in anchor]

    smalls = superscripts(words, ls[start][0]["y0"], ls[end - 1][0]["y1"] if end <= len(ls) else 10_000, x_limit)
    rows = []
    for l, name_words, cells in data_lines:
        name = text_of(name_words).strip()
        row_y = l[0]["y0"]
        row: dict = {"name": name, "cells": {}, "footnotes": []}
        for w in cells:
            col = min(range(ncols), key=lambda i: abs(anchors[i] - w["x1"]))
            key = ch["columns"][col]["key"]
            if key in row["cells"]:
                raise SystemExit(f"{ch['slug']}: two values in column {key} for {name}")
            row["cells"][key] = parse_cell(w["t"])
            row["cells"][key]["_x0"] = w["x0"]
        for s in smalls:
            # A superscript shares its row's top edge and touches the word it
            # marks: its right edge is the number's left edge, or it follows the name.
            if abs(row_y - s["y0"]) >= 3:
                continue
            target = None
            touching = [k for k, c in row["cells"].items() if -1 <= c["_x0"] - s["x1"] <= 4]
            if touching:
                target = touching[0]
            elif abs(s["x0"] - name_words[-1]["x1"]) < 4:
                target = "name"  # "Russia" + small "e": the whole row is estimated
            if target is None:
                continue
            marks = [t for t in re.split(r"[,\s]+", s["t"]) if t]
            for mark in marks:
                if target == "name":
                    if mark == "e":
                        row["estimatedRow"] = True
                    else:
                        row["footnotes"].append(mark)
                else:
                    if mark == "e":
                        row["cells"][target]["estimated"] = True
                    else:
                        row["cells"][target].setdefault("footnotes", []).append(mark)
        for c in row["cells"].values():
            c.pop("_x0", None)
        if row.get("estimatedRow"):
            for c in row["cells"].values():
                c["estimated"] = True
        rows.append(row)

    # Some rows print a footnote number where a superscript should be ("Other countries6").
    out_rows = []
    for row in rows:
        m = re.match(r"^(.*?)(\d+)$", row["name"])
        if m and not m.group(1).endswith(" "):
            row["name"], row["footnotes"] = m.group(1), row["footnotes"] + [m.group(2)]
        name = row["name"]
        if name.lower().startswith("world total"):
            row["kind"] = "world"
        elif name.lower() in ("other countries", "other"):
            row["kind"] = "other"
        else:
            iso = COUNTRY_ISO2.get(name.split(",")[0] if ch.get("nameComma") else name)
            if iso is None:
                raise SystemExit(f"{ch['slug']}: no ISO code for {name!r} — add it to COUNTRY_ISO2")
            row["kind"] = "country"
            row["iso2"] = iso
        for col in ch["columns"]:
            cell = row["cells"].get(col["key"])
            if cell is not None and col.get("estimated"):
                cell["estimated"] = True
        out_rows.append(row)

    footnotes = footnote_texts(pw)
    # A cell footnoted "Reported." is a measurement even under an all-estimated header.
    for row in out_rows:
        for cell in row["cells"].values():
            if any(footnotes.get(n, "").strip() == "Reported." for n in cell.get("footnotes", [])):
                cell.pop("estimated", None)
    return {
        "slug": ch["slug"],
        "commodity": ch["commodity"],
        "resource": ch["resource"],
        "url": BASE + ch["slug"] + ".pdf",
        "table": ch["heading"],
        "unit": ch["unit"],
        "unitQuote": ch["unitQuote"],
        "primary": ch.get("primary", ch["columns"][0]["key"].split(":")[0]),
        "columns": [{k: v for k, v in c.items()} for c in ch["columns"]],
        "rows": out_rows,
        "footnotes": {
            n: t
            for n, t in footnotes.items()
            if any(n in r["footnotes"] or any(n in c.get("footnotes", []) for c in r["cells"].values()) for r in out_rows)
            or any(n == c.get("footnote") for c in ch["columns"])
        },
        "events": events_text(pdf),
    }


def footnote_texts(pw: list[list[dict]]) -> dict[str, str]:
    """Numbered footnotes at the foot of the chapter: a small number at the left margin, its text beside it."""
    notes: dict[str, str] = {}
    for words in pw:
        foot = [w for w in words if not w["small"] and 10 < w["y1"] - w["y0"] < 12]
        marks = sorted(
            (w for w in words if w["small"] and re.fullmatch(r"\d+", w["t"]) and w["x0"] < 50), key=lambda w: w["y0"]
        )
        for i, m in enumerate(marks):
            nxt = marks[i + 1]["y0"] - 2 if i + 1 < len(marks) else m["y0"] + 30
            body = sorted((w for w in foot if m["y0"] - 2 <= w["y0"] < nxt), key=lambda w: (round(w["y0"]), w["x0"]))
            text = " ".join(w["t"] for w in body).strip()
            if text and m["t"] not in notes:
                notes[m["t"]] = text
    return notes


def events_text(pdf: Path) -> str:
    """The chapter's "Events, Trends, and Issues" section, as plain prose."""
    txt = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True, check=True).stdout
    m = re.search(r"Events, Trends, and Issues:(.*?)(?:World (?:[A-Z][A-Za-z ,-]* )?(?:Production|Capacity)[A-Za-z ,-]*:)", txt, re.S)
    if not m:
        return ""
    body = m.group(1)
    body = re.sub(r"Prepared by .*?\]\s*", " ", body, flags=re.S)
    body = re.sub(r"\n\s*[A-Z][A-Z ,()-]{3,}\n", "\n", body)  # running page header (e.g. "NICKEL")
    body = re.sub(r"U\.S\. Geological Survey, Mineral Commodity Summaries, \w+ \d{4}", " ", body)
    body = re.sub(r"(\w)-\n(\w)", r"\1\2", body)
    body = re.sub(r"(?<=[a-z.,)])(\d{1,2})(?=\s)", "", body)  # footnote refs glued to words
    return re.sub(r"\s+", " ", body).strip()


def totals_problems(ch: dict) -> list[str]:
    """Countries + "other" must add up to USGS's rounded world total, or a value sits in the wrong column."""
    world = next((r for r in ch["rows"] if r["kind"] == "world"), None)
    if world is None:
        return [f"{ch['slug']}: no world total row"]
    out = []
    for col in ch["columns"]:
        total = world["cells"].get(col["key"], {}).get("value")
        if not total or world["cells"][col["key"]].get("moreThan"):
            continue
        parts = [r["cells"].get(col["key"], {}).get("value") for r in ch["rows"] if r["kind"] != "world"]
        if any(r["cells"].get(col["key"], {}).get("withheld") for r in ch["rows"]):
            continue
        s = sum(v for v in parts if v)
        if abs(s - total) / total > 0.06:
            out.append(f"{ch['slug']} {col['key']}: rows sum {s:,} vs world {total:,}")
    return out


def main() -> None:
    check = "--check" in sys.argv
    with tempfile.TemporaryDirectory() as tmp:
        # MCS_CACHE=/some/dir keeps the PDFs between runs while editing the parser.
        cache = Path(os.environ.get("MCS_CACHE") or tmp)
        chapters = [parse_chapter(ch, cache) for ch in CHAPTERS]
    doc = {
        "source": "USGS Mineral Commodity Summaries",
        "edition": EDITION,
        "publisher": "U.S. Geological Survey",
        "licence": "US Government work, public domain",
        "retrieved": date.today().isoformat(),
        "definitions": {
            "reserves": "USGS reserves: the part of an identified resource that could be economically extracted or produced at the time of determination (MCS Appendix C). Roughly proved + probable; not the broader resource.",
            "resources": "USGS resources: a concentration of material in such form and amount that economic extraction is currently or potentially feasible. Broader than reserves and given only as world totals in the chapter text.",
            "e": "Estimated by USGS.",
            "W": "Withheld to avoid disclosing company proprietary data.",
            "NA": "Not available.",
        },
        "appendix": BASE + "appendixes.pdf",
        "chapters": chapters,
    }
    problems = [p for ch in chapters for p in totals_problems(ch)]
    for p in problems:
        print("TOTAL MISMATCH:", p, file=sys.stderr)
    if problems and not check:
        raise SystemExit("country rows do not add up to the world total — a column is misread")
    if check:
        for ch in chapters:
            print(f"{ch['slug']}: {len(ch['rows'])} rows, {len(ch['events'])} chars of events")
            for r in ch["rows"]:
                print("  ", r.get("iso2", r["kind"]).ljust(6), r["name"][:28].ljust(28), {k: c.get("value", c["raw"]) for k, c in r["cells"].items()}, r["footnotes"] or "")
        return
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(chapters)} chapters")


if __name__ == "__main__":
    main()
