#!/usr/bin/env python3
"""
Where each producer is: the free-text facility locations in
research/usgs-producers.json ("Shanxi, Yangquan, Pingan", "Ravensthorpe, WA",
"Oyu Tolgoi Mine, Omnogovi [South Gobi] Aymag") placed on the globe.

Writes research/producer-places.json: one row per (country, location) with the
point, how precise it is, and the GeoNames entry it came from (id, name,
feature code), so anyone can check a dot against its source.

    python3 scripts/research/geocode-producers.py

Source: GeoNames country dumps (https://download.geonames.org/export/dump/,
CC BY 4.0), downloaded once into .cache/geonames/ and matched offline. A run
takes seconds and asks no server anything per facility.

Precision is stated, never upgraded:
  site    the mine, plant or industrial area itself is a GeoNames entry
  town    a populated place or a district (ADM2 and finer)
  region  only the province or state (ADM1)
A location that resolves to nothing finer than the country is left out: a dot
in the middle of Chile says nothing the country shading does not.

A match must agree with the rest of the string. For "Shanxi, Yangquan, Pingan"
a Pingan has to sit in Shanxi, or near a Yangquan, or it is refused rather
than plotted; a Santa Cruz in Bolivia never stands in for one in Sonora.
"""
import json
import math
import re
import sys
import unicodedata
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "research" / "usgs-producers.json"
OUT = ROOT / "research" / "producer-places.json"
CACHE = ROOT / ".cache" / "geonames"
DUMP = "https://download.geonames.org/export/dump/{}.zip"

# USGS abbreviates sub-national units; GeoNames carries the name.
ABBREV = {
    "au": {"WA": "Western Australia", "QLD": "Queensland", "Qld": "Queensland", "NSW": "New South Wales",
           "TAS": "Tasmania", "Tas": "Tasmania", "SA": "South Australia", "NT": "Northern Territory",
           "VIC": "Victoria", "Vic": "Victoria"},
    "mx": {"Son.": "Sonora", "Chih.": "Chihuahua", "Zac.": "Zacatecas", "Dgo.": "Durango",
           "Coah.": "Coahuila", "S.L.P.": "San Luis Potosi", "Gro.": "Guerrero", "Sin.": "Sinaloa",
           "Mich.": "Michoacan", "Jal.": "Jalisco", "Hgo.": "Hidalgo", "Gto.": "Guanajuato",
           "B.C.S.": "Baja California Sur", "Col.": "Colima", "Oax.": "Oaxaca"},
    "ca": {"Que.": "Quebec", "Ont.": "Ontario", "Man.": "Manitoba", "B.C.": "British Columbia",
           "N.L.": "Newfoundland and Labrador", "Sask.": "Saskatchewan", "Alta.": "Alberta"},
}

# Words that describe a facility or an administrative level, not a place name.
NOISE = re.compile(
    r"\b(mines?|mining|plants?|smelters?|refiner(y|ies)|projects?|deposits?|operations?|complex|"
    r"concentrators?|facilit(y|ies)|works|division|the|of|in|area|district|region|province|state|"
    r"prefecture|county|aymag|oblast|krai|kray|department|municipality|regency|governorate|"
    r"copper|nickel|cobalt|tin|lithium|iron|ore|gold|silver|aluminum|alumina|bauxite|zinc|lead|"
    r"graphite|tungsten|antimony|gallium|germanium|uranium|helium|chromite|ferronickel|rare|earths?|"
    r"silicon|ferrosilicon|steel|pellets?|solvent|extraction|electrowinning|sx|ew|hydrometallurgical|"
    r"processing|cathodes?|metals?|precious|primary|secondary|new|about|approximately|some|town|city|"
    r"onshore|offshore|underground|open|pit|"
    r"multiple|various|several|other|undisclosed|unknown|\d+\s*(km|kilometers?|miles?)\s+"
    r"(north|south|east|west|northeast|northwest|southeast|southwest)\s+of|north|south|east|west)\b",
    re.I,
)

SITE_CODES = {"MN", "MNAU", "MNC", "MNCR", "MNCU", "MNFE", "MNN", "MNQ", "MNQR", "MFG", "ML",
              "OILR", "PS", "MNA", "INDS", "PO", "SMLT"}
RANK = {"site": 0, "town": 1, "region": 2}
OFFSET = re.compile(r"(\d+)\s*(?:km|kilometers?)\s+(north|south|east|west|northeast|northwest|"
                    r"southeast|southwest)\s+of\b", re.I)
BEARING = {"north": 0, "northeast": 45, "east": 90, "southeast": 135, "south": 180,
           "southwest": 225, "west": 270, "northwest": 315}
FACILITY_WORD = re.compile(r"\b(mines?|plants?|smelters?|refiner(y|ies)|deposits?|projects?|works|"
                           r"complex|concentrators?|operations?)\b", re.I)
ADMIN_WORD = re.compile(r"\b(province|region|state|department|prefecture|county|aymag|oblast|krai|"
                        r"kray|district|governorate|regency)\b", re.I)


def admin1_names() -> dict[str, str]:
    """GeoNames' own English name for each first-level division ("CN.04" -> "Jiangsu")."""
    path = CACHE / "admin1CodesASCII.txt"
    if not path.exists():
        urllib.request.urlretrieve("https://download.geonames.org/export/dump/admin1CodesASCII.txt", path)
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        c = line.split("\t")
        if len(c) >= 3:
            out[c[0]] = c[2]
    return out


def displaced(lat: float, lon: float, dist_km: float, bearing: float) -> tuple[float, float]:
    """The point dist_km from (lat, lon) along a bearing, on a sphere."""
    d = dist_km / 6371
    b = math.radians(bearing)
    p1, l1 = math.radians(lat), math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1), math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), (math.degrees(l2) + 540) % 360 - 180
AGREE_KM = 150


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", s)).strip()


def km(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(h)))


def precision_of(fclass: str, fcode: str) -> str | None:
    if fcode in SITE_CODES:
        return "site"
    if fclass == "P":
        return "town"
    if fclass == "A":
        if fcode == "ADM1":
            return "region"
        if fcode in {"ADM2", "ADM3", "ADM4", "ADM5", "ADMD"}:
            return "town"
    return None


class Country:
    """One GeoNames dump, indexed by folded name and alternate name."""

    def __init__(self, iso2: str):
        path = CACHE / f"{iso2.upper()}.txt"
        if not path.exists():
            CACHE.mkdir(parents=True, exist_ok=True)
            z = CACHE / f"{iso2.upper()}.zip"
            urllib.request.urlretrieve(DUMP.format(iso2.upper()), z)
            with zipfile.ZipFile(z) as zf:
                zf.extract(f"{iso2.upper()}.txt", CACHE)
            z.unlink()
        self.by_name: dict[str, list[dict]] = {}
        self.admin1: dict[str, set[str]] = {}
        self.admin2: dict[str, set[str]] = {}
        with path.open(encoding="utf-8") as fh:
            for line in fh:
                c = line.rstrip("\n").split("\t")
                if len(c) < 15:
                    continue
                p = precision_of(c[6], c[7])
                if not p:
                    continue
                row = {"id": int(c[0]), "name": c[1], "lat": float(c[4]), "lon": float(c[5]),
                       "fcode": c[7], "precision": p, "a1": c[10], "a2": c[11],
                       "pop": int(c[14] or 0)}
                names = {fold(c[1]), fold(c[2])}
                names.update(fold(n) for n in c[3].split(",") if n and n.isascii())
                names.discard("")
                for n in names:
                    self.by_name.setdefault(n, []).append(row)
                if c[7] == "ADM1":
                    self.admin1.setdefault(c[10], set()).update(names)
                elif c[7] == "ADM2":
                    self.admin2.setdefault(f"{c[10]}.{c[11]}", set()).update(names)

    def lookup(self, text: str) -> list[dict]:
        return self.by_name.get(fold(text), [])

    def context(self, row: dict) -> set[str]:
        """Words naming the entry's province and district."""
        words: set[str] = set()
        for n in self.admin1.get(row["a1"], set()) | self.admin2.get(f"{row['a1']}.{row['a2']}", set()):
            words.update(w for w in n.split() if len(w) > 3)
        return words


def clean(location: str, iso2: str) -> list[str]:
    """The location as segments, footnote marks and brackets removed."""
    s = re.sub(r"\[[^\]]*\]", " ", location)
    s = re.sub(r"(?<=[A-Za-z]),?\d+(?=[ ,]|$)", "", s)  # "Mine,1 near" / "SX–EW2" footnotes
    s = re.sub(r"\([^)]*\)", " ", s)
    for short, full in ABBREV.get(iso2, {}).items():
        s = re.sub(rf"(?<![A-Za-z]){re.escape(short)}(?![A-Za-z])", full, s)
    parts = re.split(r",|;| and | near | at | in | outside | between ", s, flags=re.I)
    return [p.strip(" .;") for p in parts if p.strip(" .;")]


def names_in(part: str) -> list[str]:
    """What a segment might be called in GeoNames, most literal first."""
    seen: list[str] = []
    for w in NOISE.sub(" ", part).split():
        if w.lower() not in (x.lower() for x in seen):
            seen.append(w)
    bare = " ".join(seen).strip(" -")
    out = [part, bare]
    words = bare.split()
    # "Xinjiang Uyghur" -> "Xinjiang": a shorter head, only ever as a province.
    for k in range(len(words) - 1, 0, -1):
        head = " ".join(words[:k])
        if len(head) >= 5:
            out.append(head)
    return [n for i, n in enumerate(out) if len(fold(n)) > 2 and fold(n) not in map(fold, out[:i])]


def constraints(hits: list[dict], part: str) -> tuple[set[str], set[str]]:
    """The divisions a segment names: every first-level one it matches, and
    second-level ones only when the segment says it is one ("Zambales Province")."""
    a1 = {h["a1"] for h in hits if h["fcode"] == "ADM1"}
    a2 = {f"{h['a1']}.{h['a2']}" for h in hits if h["fcode"] == "ADM2"} if ADMIN_WORD.search(part) else set()
    return a1, a2


def agrees(row: dict, limits: list[tuple[set[str], set[str]]], near: list[dict]) -> bool:
    """Inside every division the rest of the string names; failing any named
    division, near a place it names."""
    for a1, a2 in limits:
        inside = row["a1"] in a1 or f"{row['a1']}.{row['a2']}" in a2
        if row["fcode"] == "ADM1" and a2:
            inside = inside or row["a1"] in {x.split(".")[0] for x in a2}
        if not inside:
            return False
    if limits or not near:
        return True
    return any(km((row["lat"], row["lon"]), (n["lat"], n["lon"])) < AGREE_KM for n in near)


def ambiguous(top: dict, ok: list[dict]) -> bool:
    """A bare name with namesakes far apart and no clear main town: no point.
    "Kinke" alone could be either of two villages 1,000 km apart."""
    rivals = [h for h in ok[1:] if h["precision"] == top["precision"]
              and km((top["lat"], top["lon"]), (h["lat"], h["lon"])) > 50]
    if not rivals:
        return False
    runner = max(h["pop"] for h in rivals)
    return not (top["pop"] >= 10_000 and top["pop"] >= 5 * runner)


def place(country: Country, iso2: str, location: str) -> dict | None:
    parts = clean(location, iso2)
    hits_by_part = []
    for i, part in enumerate(parts):
        hits = []
        for j, name in enumerate(names_in(part)):
            for row in country.lookup(name):
                # A shortened name may only stand for a province.
                if j >= 2 and row["precision"] != "region":
                    continue
                hits.append(row)
        # A mine entry is the facility only when the segment names one; "near
        # Lubumbashi" matching a mine called Lubumbashi is the town.
        if not FACILITY_WORD.search(part):
            towns = [h for h in hits if h["precision"] != "site"]
            hits = towns or [{**h, "precision": "town"} for h in hits]
        # A segment that names a province is the province, not a village that
        # shares the name ("Shanxi, Taiyuan" is not a Shanxi hamlet in Jiangxi).
        if (
            any(h["fcode"] == "ADM1" for h in hits)
            and not re.search(r"\b(town|city)\b", part, re.I)
            and not OFFSET.search(part)
        ):
            hits = [h for h in hits if h["fcode"] == "ADM1"]
        # One that says it is a division and is not one GeoNames knows ("Abay
        # Province", created 2022) names nothing we can place.
        elif ADMIN_WORD.search(part):
            hits = [h for h in hits if h["fcode"].startswith("ADM")]
        hits_by_part.append(hits)
    best = None
    for i, hits in enumerate(hits_by_part):
        limits = [constraints(hs, parts[j]) for j, hs in enumerate(hits_by_part) if j != i and hs]
        limits = [lim for lim in limits if lim[0] or lim[1]]
        near = [h for j, hs in enumerate(hits_by_part) if j != i for h in hs if h["fcode"] not in ("ADM1", "ADM2")]
        ok = [h for h in hits if agrees(h, limits, near)]
        if not ok:
            continue
        ok.sort(key=lambda h: (RANK[h["precision"]], -h["pop"]))
        top = ok[0]
        if not limits and not near and ambiguous(top, ok):
            continue
        key = (RANK[top["precision"]], i)
        if best is None or key < best[0]:
            best = (key, top, i)
    if not best:
        return None
    _, row, i = best
    lat, lon, prec = row["lat"], row["lon"], row["precision"]
    off = OFFSET.search(parts[i])
    note = ""
    if off and prec == "region":
        return None  # a province and a distance from somewhere in it is no point at all
    if off:
        # "100 km north of Ravensthorpe" is not at Ravensthorpe.
        lat, lon = displaced(lat, lon, float(off.group(1)), BEARING[off.group(2).lower()])
        prec = "town"
        note = f"{off.group(1)} km {off.group(2).lower()} of "
    a1 = ADMIN1.get(f"{iso2.upper()}.{row['a1']}", "")
    name = note + row["name"]
    return {"lat": round(lat, 4), "lon": round(lon, 4), "precision": prec,
            "geonameid": row["id"], "feature": row["fcode"],
            "matched": name if not a1 or a1 == row["name"] else f"{name}, {a1}"}


ADMIN1: dict[str, str] = {}


def main() -> None:
    ADMIN1.update(admin1_names())
    src = json.loads(SRC.read_text())
    places, unresolved = [], []
    total = 0
    for chapter in src["countries"]:
        iso2 = chapter["iso2"]
        locations = list(dict.fromkeys(f["location"] for f in chapter["facilities"] if f["location"].strip()))
        if not locations:
            continue
        country = Country(iso2)
        for loc in locations:
            total += 1
            row = place(country, iso2, loc)
            if row:
                places.append({"iso2": iso2, "location": loc, **row})
            else:
                unresolved.append({"iso2": iso2, "location": loc})
        print(f"{iso2}: {sum(1 for p in places if p['iso2'] == iso2)}/{len(locations)}", flush=True)
    by = {k: sum(1 for p in places if p["precision"] == k) for k in RANK}
    OUT.write_text(json.dumps({
        "source": "GeoNames country dumps (geonames.org), matched offline to each facility location "
                  "in research/usgs-producers.json",
        "licence": "GeoNames, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
        "retrieved": date.today().isoformat(),
        "note": "Precision is the finest place GeoNames could confirm: site (the mine, plant or "
                "industrial area), town (populated place or district), region (province or state "
                "only). Country-only matches are left out.",
        "counts": {"locations": total, "placed": len(places), **by, "unresolved": len(unresolved)},
        "places": places,
        "unresolved": unresolved,
    }, ensure_ascii=False, indent=1) + "\n")
    print(f"placed {len(places)}/{total}: {by}; unresolved {len(unresolved)}")


if __name__ == "__main__":
    main()
