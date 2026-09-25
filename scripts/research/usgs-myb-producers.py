#!/usr/bin/env python3
"""
Who produces what, per country: USGS Minerals Yearbook country chapters,
"Structure of the mineral industry" table (Table 2), latest year published.

Writes research/usgs-producers.json: per country and Substrata resource, the
operating companies and equity owners, facility locations and annual capacity
exactly as USGS prints them, with the chapter file and year each row came from.

    python3 scripts/research/usgs-myb-producers.py

Public domain (US Government work). Countries are the producers that matter for
the binding-now resources; add a slug to COUNTRIES to read another chapter.
The capacity unit is the table's default ("thousand metric tons unless
otherwise specified") unless the commodity line names its own, so both are kept.
"""
import html
import io
import json
import re
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "usgs-producers.json"
BASE = "https://pubs.usgs.gov/myb/vol3/{y}/myb3-{y}-{c}.xlsx"
YEARS = ("2023", "2022", "2020-21", "2019")

COUNTRIES = {
    "china": "cn", "russia": "ru", "indonesia": "id", "india": "in", "australia": "au", "chile": "cl",
    "congo-kinshasa": "cd", "brazil": "br", "south-africa": "za", "burma": "mm", "philippines": "ph",
    "guinea": "gn", "kazakhstan": "kz", "canada": "ca", "mozambique": "mz", "madagascar": "mg",
    "tajikistan": "tj", "vietnam": "vn", "bolivia": "bo", "peru": "pe", "argentina": "ar",
    "zimbabwe": "zw", "japan": "jp", "qatar": "qa", "algeria": "dz", "morocco": "ma", "turkey": "tr",
    "mexico": "mx", "zambia": "zm", "gabon": "ga", "malaysia": "my", "thailand": "th", "korea-south": "kr",
    "germany": "de", "norway": "no", "uzbekistan": "uz", "namibia": "na", "niger": "ne", "mongolia": "mn",
}

# (regex over "group line: commodity line", resource). First match wins.
RESOURCE = [
    (r"rare.?earth", "rare-earths"),
    (r"gallium", "gallium"),
    (r"germanium", "gallium"),  # shown with gallium: the same byproduct chains and the same controls
    (r"graphite", "graphite"),
    (r"lithium|spodumene", "lithium"),
    (r"cobalt", "cobalt"),
    (r"nickel", "nickel"),
    (r"tungsten|wolfram", "tungsten"),
    (r"antimony", "antimony"),
    (r"^tin\b|: *tin\b|\btin[:,]", "tin"),
    (r"bauxite|alumina|aluminum", "bauxite"),
    (r"ferrosilicon|silicon,? metal|^silicon$|high.?purity quartz", "silicon"),
    (r"helium", "helium"),
    (r"uranium", "uranium"),
    (r"platinum|palladium|pgm", "pgms"),
    (r"copper", "copper"),
    (r"iron ore|^iron and steel: *iron ore", "iron"),
]

UA = {"User-Agent": "substrata-research"}


def fetch(slug: str) -> tuple[str, str, bytes] | None:
    for y in YEARS:
        url = BASE.format(y=y, c=slug)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as res:
                return y, url, res.read()
        except urllib.error.HTTPError:
            continue
    return None


def sheet_rows(data: bytes, name_pattern: str) -> tuple[str, list[dict]]:
    z = zipfile.ZipFile(io.BytesIO(data))
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode(), re.S):
            shared.append(html.unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))))
    wb = z.read("xl/workbook.xml").decode()
    rels = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', z.read("xl/_rels/workbook.xml.rels").decode()))
    sheets = re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wb)
    match = [(n, r) for n, r in sheets if re.fullmatch(name_pattern, n.strip(), re.I)]
    if not match:
        raise ValueError(f"no sheet like {name_pattern!r} in {[n for n, _ in sheets]}")
    name, rid = match[0]
    target = rels[rid].lstrip("/")
    target = target if target.startswith("xl/") else "xl/" + target
    rows = []
    for r in re.findall(r"<row [^>]*>(.*?)</row>", z.read(target).decode(), re.S):
        cells = {}
        for col, attrs, body in re.findall(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', r, re.S):
            v = re.search(r"<v>(.*?)</v>", body or "", re.S)
            t = re.search(r"<t[^>]*>(.*?)</t>", body or "", re.S)
            if 't="s"' in attrs and v:
                val = shared[int(v.group(1))]
            elif t:
                val = html.unescape(t.group(1))
            elif v:
                val = v.group(1)
            else:
                continue
            val = re.sub(r"\s+", " ", val).strip()
            if val:
                cells[col] = val
        rows.append(cells)
    return name, rows


def columns(rows: list[dict]) -> tuple[str, str, str, str] | None:
    """The header may wrap over two rows ("Facilities, major operating companies," / "and major equity owners")."""
    for i, r in enumerate(rows):
        com = next((k for k, v in r.items() if v.lower() == "commodity"), None)
        if not com:
            continue
        above = rows[i - 1] if i else {}
        head = {k: f"{above.get(k, '')} {r.get(k, '')}".lower() for k in set(r) | set(above)}
        comp = next((k for k, v in head.items() if "compan" in v or "owner" in v), None)
        loc = next((k for k, v in head.items() if "location" in v), None)
        cap = next((k for k, v in head.items() if "capacity" in v), None)
        if comp and loc:
            return com, comp, loc, cap or ""
    return None


def parse(rows: list[dict]) -> tuple[str, list[dict]]:
    cols = columns(rows)
    if cols is None:
        raise ValueError("no Commodity header row")
    c_com, c_comp, c_loc, c_cap = cols
    unit = next((r["A"] for r in rows if r.get("A", "").startswith("(") and "unless" in r["A"]), "")
    out: list[dict] = []
    group = ""
    last_commodity = ""
    last_company = ""
    for r in rows:
        a = r.get(c_com, "")
        if a.startswith(("TABLE", "See footnotes", "(")) or a == "Commodity" or re.fullmatch(r"[A-Z ,:—-]+", a or "x"):
            continue
        if re.match(r"^(e|r|W|NA|Do\.|do\.|—)?\s*(Estimated|Revised|Withheld|Not available|Source|Ditto|\d)", a) and not r.get(c_comp):
            continue
        if a.endswith(":") or (a.endswith("—Continued") and not r.get(c_comp)):
            group = a.replace("—Continued", "").rstrip(":")
            continue
        if re.search(r"major operating compan|equity owners|location of main", r.get(c_comp, "") + r.get(c_loc, ""), re.I):
            continue  # a header repeated on a continuation page
        if a and r.get(c_comp):
            commodity = last_commodity if a.lower() == "do." else a.replace("—Continued", "").strip()
            company = last_company if r[c_comp].lower() == "do." else r[c_comp]
            location = r.get(c_loc, "")
            if location.lower() == "do." and out:
                location = out[-1]["location"]
            out.append({"group": group, "commodity": commodity, "companies": company, "location": location, "capacity": r.get(c_cap, "")})
            last_commodity, last_company = commodity, company
        elif out and not a and r.get(c_comp) and c_cap and r.get(c_cap):
            # No commodity cell but its own capacity: another company on the same commodity.
            company = last_company if r[c_comp].lower() == "do." else r[c_comp]
            location = r.get(c_loc, "")
            if location.lower() == "do.":
                location = out[-1]["location"]
            out.append({"group": group, "commodity": last_commodity, "companies": company, "location": location, "capacity": r[c_cap]})
            last_company = company
        elif out and not a and (r.get(c_comp) or r.get(c_loc)):
            if r.get(c_comp):
                out[-1]["companies"] += " " + r[c_comp]
                last_company = out[-1]["companies"]
            if r.get(c_loc):
                out[-1]["location"] = (out[-1]["location"] + " " + r[c_loc]).strip()
        elif a and not r.get(c_comp) and not a.startswith(("e", "r")):
            group = a.rstrip(":")
    for row in out:
        if "STRUCTURE OF THE" in row["group"].upper():
            row["group"] = ""  # the table title, not a commodity heading
        row["capacity"] = row["capacity"].rstrip(".")
        row["companies"] = re.sub(r"\s+", " ", row["companies"]).strip()
        row["location"] = re.sub(r"\s+", " ", row["location"]).strip()
    return unit, out


GENERIC = re.compile(
    r"^(mine|metal|refin|smelt|concentrat|ore\b|oxide|primary|secondary|cathode|matte|blister|anode|plant|"
    r"compound|powder|carbonate|hydroxide|chemical|sulfate|mixed|intermediate|crude|unwrought|content|do\.)",
    re.I,
)


def match(text: str) -> list[str]:
    """Every resource the line names: "Copper and cobalt" is both."""
    found = [resource for pattern, resource in RESOURCE if re.search(pattern, text.lower())]
    return list(dict.fromkeys(found))


def resource_of(group: str, commodity: str) -> list[str]:
    """The commodity line decides; the group heading only names a generic line ("Mine", "Metal")."""
    own = match(commodity)
    if own:
        return own
    return match(group) if GENERIC.match(commodity) else []


def main() -> None:
    chapters, gaps = [], []
    for slug, iso2 in COUNTRIES.items():
        got = fetch(slug)
        if got is None:
            gaps.append(f"{slug}: no Minerals Yearbook country workbook for {', '.join(YEARS)}")
            continue
        year, url, data = got
        try:
            sheet, rows = sheet_rows(data, r"table ?2")
            unit, parsed = parse(rows)
        except ValueError as err:
            gaps.append(f"{slug} {year}: {err}")
            continue
        facilities = []
        for row in parsed:
            for resource in resource_of(row["group"], row["commodity"]):
                facilities.append({"resource": resource, **row})
        chapters.append(
            {
                "iso2": iso2,
                "slug": slug,
                "year": year,
                "url": url,
                "pdf": url.replace(".xlsx", ".pdf"),
                "table": f"Table 2. Structure of the mineral industry ({sheet.strip()})",
                "unit": unit.strip("()"),
                "facilities": facilities,
            }
        )
        print(f"{slug} {year}: {len(facilities)} rows on tracked resources")
    doc = {
        "source": "USGS Minerals Yearbook, volume III (Area Reports: International), country chapters",
        "licence": "US Government work, public domain",
        "retrieved": date.today().isoformat(),
        "note": "Companies, facilities and capacities as USGS prints them for the chapter year. Capacity is in the table's unit unless the commodity line names another.",
        "gaps": gaps,
        "countries": chapters,
    }
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(chapters)} countries, {sum(len(c['facilities']) for c in chapters)} rows; gaps: {len(gaps)}")


if __name__ == "__main__":
    main()
