#!/usr/bin/env python3
"""
Country-level sanctions regimes, from primary sources, dated and linked.

Writes research/sanctions.json:
- EU: every regime on the EU Sanctions Map (sanctionsmap.eu, the Council's
  own register), with who adopted it (EU, UN, both), when it was last
  amended, its legal acts (EUR-Lex / UN links), and each measure's type and
  text. Measures are what is sanctioned (an import ban on listed goods, an
  asset freeze on listed persons), which is never "the country" as a whole.
- US: OFAC's program list, with the program page for each country program.

    python3 scripts/research/sanctions.py

No key needed. The UK list is a gap: gov.uk publishes regimes as prose pages
without a machine-readable index of measures per regime.
"""
import html
import json
from zoneinfo import ZoneInfo
import re
import sys
import time
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "sanctions.json"
EU_API = "https://www.sanctionsmap.eu/api/v1/regime"
EU_MAP = "https://www.sanctionsmap.eu/#/main/details/{id}/"
BRUSSELS = ZoneInfo("Europe/Brussels")
OFAC_LIST = "https://ofac.treasury.gov/sanctions-programs-and-country-information"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) substrata-research"}

# OFAC program slug -> ISO2 of the country it is about. Thematic programs
# (counter-terrorism, cyber, Magnitsky…) are not country programs and are left out.
OFAC_COUNTRY = {
    "afghanistan-related-sanctions": "af",
    "belarus-sanctions": "by",
    "burma": "mm",
    "central-african-republic-sanctions": "cf",
    "chinese-military-companies-sanctions": "cn",
    "cuba-sanctions": "cu",
    "democratic-republic-of-the-congo-related-sanctions": "cd",
    "hong-kong-related-sanctions": "cn",
    "iran-sanctions": "ir",
    "iraq-related-sanctions": "iq",
    "lebanon-related-sanctions": "lb",
    "libya-sanctions": "ly",
    "mali-related-sanctions": "ml",
    "nicaragua-related-sanctions": "ni",
    "north-korea-sanctions": "kp",
    "paarss": "sy",
    "russian-harmful-foreign-activities-sanctions": "ru",
    "somalia-sanctions": "so",
    "south-sudan-related-sanctions": "ss",
    "sudan-and-darfur-sanctions": "sd",
    "ukraine-russia-related-sanctions": "ru",
    "venezuela-related-sanctions": "ve",
    "yemen-related-sanctions": "ye",
}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read()


def text(value: str | None) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def eu_regimes() -> list[dict]:
    index = json.loads(get(EU_API))["data"]
    out = []
    for row in index:
        time.sleep(0.2)
        detail = json.loads(get(f"{EU_API}/{row['id']}"))["data"]
        country = detail.get("country")
        country = country.get("data") if isinstance(country, dict) else None
        if not country or not country.get("code"):
            continue  # thematic regimes (terrorism, cyber, human rights) have no country
        amended = detail.get("amendment")
        out.append(
            {
                "id": detail["id"],
                "iso2": country["code"].lower(),
                "adoptedBy": detail["adopted_by"]["data"]["title"],
                "title": detail["specification"].strip(),
                # The map stamps an amendment at midnight Brussels time; read in UTC it lands a day early.
                "amended": datetime.fromtimestamp(amended, BRUSSELS).date().isoformat() if amended else None,
                "url": EU_MAP.format(id=detail["id"]),
                "legalActs": [
                    {"title": a["title"], "number": a.get("number"), "url": a.get("url")}
                    for a in detail.get("legal_acts", {}).get("data", [])
                ],
                "measures": [
                    {"type": m["type"]["data"]["title"], "text": text(m.get("description"))}
                    for m in detail.get("measures", {}).get("data", [])
                    if not m.get("suspend")
                ],
            }
        )
    return out


def ofac_programs() -> list[dict]:
    page = get(OFAC_LIST).decode("utf-8")
    found = re.findall(r'href="/sanctions-programs-and-country-information/([a-z0-9-]+)"[^>]*>([^<]+)<', page)
    out, seen = [], set()
    for slug, title in found:
        # The page links each programme twice; the first is a menu link with no text.
        if slug in OFAC_COUNTRY and slug not in seen and title.strip():
            seen.add(slug)
            out.append(
                {
                    "iso2": OFAC_COUNTRY[slug],
                    "title": html.unescape(title).strip(),
                    "url": f"{OFAC_LIST}/{slug}",
                }
            )
    missing = set(OFAC_COUNTRY) - seen
    if missing:
        raise SystemExit(f"OFAC list no longer has {sorted(missing)} — re-read {OFAC_LIST}")
    return out


def main() -> None:
    doc = {
        "retrieved": date.today().isoformat(),
        "eu": {"source": "EU Sanctions Map", "api": EU_API, "regimes": eu_regimes()},
        "us": {"source": "OFAC, Sanctions Programs and Country Information", "url": OFAC_LIST, "programs": ofac_programs()},
        "gaps": [
            "UK: gov.uk publishes each regime as prose, with no machine-readable list of measures per regime; not read.",
        ],
    }
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(doc['eu']['regimes'])} EU regimes, {len(doc['us']['programs'])} OFAC programs")


if __name__ == "__main__":
    main()
