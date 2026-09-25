#!/usr/bin/env python3
"""
Export restrictions per country and resource, from the OECD Inventory of Export
Restrictions on Critical Raw Materials (dataflow DF_QDD_TAD_EXP_RESTRIC,
OECD.TAD.ADM), latest data year only.

Writes research/oecd-export-restrictions.json: one row per (country, resource,
measure type, legal document, value), with the HS lines it covers, when it was
introduced and ends, its stated purpose, and the link to the legal text the
OECD recorded. Nothing is summarised or scored: a row is a recorded measure.

    python3 scripts/research/oecd-export-restrictions.py

OECD data are licensed CC BY 4.0. The SDMX API needs no key.

What this cannot say: a country/resource with no row is "not recorded in the
inventory", not "unrestricted". The inventory covers ~80 exporting countries.
"""
import csv
import io
import json
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "oecd-export-restrictions.json"
FLOW = "OECD.TAD.ADM,DSD_QDD_TAD_EXP_RESTRIC@DF_QDD_TAD_EXP_RESTRIC,3.0"
YEAR = 2024
API = (
    f"https://sdmx.oecd.org/public/rest/data/{FLOW}/all?startPeriod={YEAR}&endPeriod={YEAR}"
    "&dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
)
EXPLORER = "https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_QDD_TAD_EXP_RESTRIC%40DF_QDD_TAD_EXP_RESTRIC&df[ag]=OECD.TAD.ADM"

# HS6 line -> (Substrata resource, form). Only raw and primary forms: ore,
# intermediate, chemical, unwrought metal, scrap. Semi-manufactures (wire,
# foil, bars) are left out — they are industrial policy on products, not on
# the resource.
HS: dict[str, tuple[str, str]] = {
    "282520": ("lithium", "chemical"),
    "283691": ("lithium", "chemical"),
    "260300": ("copper", "ore"),
    "740100": ("copper", "intermediate"),
    "740200": ("copper", "intermediate"),
    "740311": ("copper", "metal"),
    "740312": ("copper", "metal"),
    "740313": ("copper", "metal"),
    "740319": ("copper", "metal"),
    "740400": ("copper", "scrap"),
    "260500": ("cobalt", "ore"),
    "282200": ("cobalt", "chemical"),
    "810520": ("cobalt", "intermediate"),
    "810530": ("cobalt", "scrap"),
    "260400": ("nickel", "ore"),
    "750110": ("nickel", "intermediate"),
    "750120": ("nickel", "intermediate"),
    "750210": ("nickel", "metal"),
    "750220": ("nickel", "metal"),
    "750300": ("nickel", "scrap"),
    "282540": ("nickel", "chemical"),
    "283324": ("nickel", "chemical"),
    "280530": ("rare-earths", "metal"),
    "284610": ("rare-earths", "chemical"),
    "284690": ("rare-earths", "chemical"),
    "250410": ("graphite", "ore"),
    "250490": ("graphite", "ore"),
    "260111": ("iron", "ore"),
    "260112": ("iron", "ore"),
    "260120": ("iron", "ore"),
    "260600": ("bauxite", "ore"),
    "281820": ("bauxite", "chemical"),
    "760110": ("bauxite", "metal"),
    "760120": ("bauxite", "metal"),
    "760200": ("bauxite", "scrap"),
    "260900": ("tin", "ore"),
    "800110": ("tin", "metal"),
    "800120": ("tin", "metal"),
    "800200": ("tin", "scrap"),
    "711011": ("pgms", "metal"),
    "711019": ("pgms", "metal"),
    "711021": ("pgms", "metal"),
    "711029": ("pgms", "metal"),
    "711031": ("pgms", "metal"),
    "711039": ("pgms", "metal"),
    "711041": ("pgms", "metal"),
    "711049": ("pgms", "metal"),
    "711292": ("pgms", "scrap"),
    "261100": ("tungsten", "ore"),
    "284180": ("tungsten", "chemical"),
    "810110": ("tungsten", "metal"),
    "810194": ("tungsten", "metal"),
    "810197": ("tungsten", "scrap"),
    "261710": ("antimony", "ore"),
    "282580": ("antimony", "chemical"),
    "811010": ("antimony", "metal"),
    "811020": ("antimony", "scrap"),
    "280461": ("silicon", "metal"),
    "280469": ("silicon", "metal"),
    "720221": ("silicon", "ferroalloy"),
    "720229": ("silicon", "ferroalloy"),
    "250510": ("quartz", "ore"),
    "261690": ("gold", "ore"),
    "710811": ("gold", "metal"),
    "710812": ("gold", "metal"),
    "711291": ("gold", "scrap"),
    "261610": ("silver", "ore"),
    "710610": ("silver", "metal"),
    "710691": ("silver", "metal"),
    "711299": ("silver", "scrap"),
    "710210": ("diamonds", "rough"),
    "710221": ("diamonds", "rough"),
    "710229": ("diamonds", "worked"),
    "251010": ("phosphates", "ore"),
    "251020": ("phosphates", "ore"),
    "252810": ("boron", "ore"),
    "252890": ("boron", "ore"),
    "281000": ("boron", "chemical"),
    "270112": ("coal", "ore"),
    # One HS line for gallium, germanium, indium, niobium, rhenium, hafnium and
    # vanadium metal: kept under gallium, marked as shared (see SHARED_LINE).
    "811292": ("gallium", "metal"),
}
# HS lines that also cover other metals: the row is kept and says so.
SHARED_LINE = {"811292": "hafnium, niobium, rhenium, gallium, indium, vanadium and germanium"}

ISO3 = {
    "AGO": "ao", "ARE": "ae", "ARG": "ar", "AUS": "au", "AUT": "at", "BDI": "bi", "BEL": "be", "BGR": "bg",
    "BLR": "by", "BOL": "bo", "BRA": "br", "BWA": "bw", "CAN": "ca", "CHL": "cl", "CHN": "cn", "COD": "cd",
    "COL": "co", "CZE": "cz", "DEU": "de", "DNK": "dk", "EGY": "eg", "ESP": "es", "ETH": "et", "FIN": "fi",
    "FRA": "fr", "GAB": "ga", "GBR": "gb", "GHA": "gh", "GIN": "gn", "GRC": "gr", "GTM": "gt", "HUN": "hu",
    "IDN": "id", "IND": "in", "IRL": "ie", "ISR": "il", "ITA": "it", "JAM": "jm", "JOR": "jo", "JPN": "jp",
    "KAZ": "kz", "KEN": "ke", "KGZ": "kg", "KOR": "kr", "LAO": "la", "MAR": "ma", "MDG": "mg", "MEX": "mx",
    "MMR": "mm", "MNG": "mn", "MYS": "my", "NAM": "na", "NCL": "nc", "NGA": "ng", "NLD": "nl", "NOR": "no",
    "OMN": "om", "PER": "pe", "PHL": "ph", "POL": "pl", "PRT": "pt", "ROU": "ro", "RUS": "ru", "RWA": "rw",
    "SAU": "sa", "SEN": "sn", "SLE": "sl", "SVK": "sk", "SWE": "se", "THA": "th", "TJK": "tj", "TUN": "tn",
    "TUR": "tr", "UKR": "ua", "USA": "us", "UZB": "uz", "VNM": "vn", "ZAF": "za", "ZMB": "zm", "ZWE": "zw",
}


def day(text: str) -> str | None:
    """OECD dates are dd/mm/yyyy, or "nd" for none."""
    m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", (text or "").strip())
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def clean(text: str | None) -> str | None:
    # A few OECD strings carry a mis-decoded apostrophe ("Peoplei\ufffd\u20ac\u2122s").
    text = re.sub("i?\ufffd\u20ac\u2122", "\u2019", text or "")
    # French legal titles arrive with "é" as "i\ufffd©" (UTF-8 C3 A9, the C3 lost): restore it.
    text = re.sub("([Nn])i\ufffd ", "\\1\u00b0 ", text or "")  # "n°" lost its C2 the same way
    text = re.sub("i\ufffd([\u00a0-\u00bf])", lambda m: bytes([0xC3, ord(m.group(1))]).decode("utf-8"), text)
    text = text.replace("\xa0", " ").strip().rstrip(";").strip()
    return text if text and text.lower() not in ("n", "nd", "na") else None


def main() -> None:
    req = urllib.request.Request(API, headers={"User-Agent": "substrata-research"})
    with urllib.request.urlopen(req, timeout=300) as res:
        text = res.read().decode("utf-8")
    rows = csv.DictReader(io.StringIO(text))
    measures: dict[tuple, dict] = defaultdict(dict)
    labels: dict[str, str] = {}
    for row in rows:
        if row["TIME_PERIOD"] != str(YEAR):
            continue
        key = (row["REF_AREA"], row["COMMODITY"], row["POLICY_TYPE"], row["POLICY_VARIATION"])
        measures[key][row["POLICY_DESCRIPTION"]] = row["OBS_VALUE"]
        measures[key]["_type"] = row["Policy type"]
        labels[row["COMMODITY"]] = row["Commodity"]

    grouped: dict[tuple, dict] = {}
    unmapped_countries = set()
    for (iso3, commodity, ptype, variation), attrs in measures.items():
        hs = commodity.removeprefix("HS07_")
        if hs not in HS or ptype == "NO_RESTRICTION":
            continue
        resource, form = HS[hs]
        iso2 = ISO3.get(iso3)
        if iso2 is None:
            unmapped_countries.add(iso3)
            continue
        link = clean(attrs.get("LINK"))
        if link and not link.startswith("http"):
            link = "https://" + link
        value = clean(attrs.get("VAL"))
        gkey = (iso2, resource, ptype, link, value, clean(attrs.get("NOD")), day(attrs.get("DATI", "")))
        g = grouped.setdefault(
            gkey,
            {
                "iso2": iso2,
                "resource": resource,
                "type": ptype,
                "typeLabel": attrs["_type"],
                "value": value,
                "valueUnit": clean(attrs.get("VAL_UNIT")),
                "condition": clean(attrs.get("VAL_CONDITION")),
                "introduced": day(attrs.get("DATI", "")),
                "ends": day(attrs.get("END", "")),
                "temporary": (attrs.get("TEMP") or "").strip().lower() == "yes",
                "purpose": clean(attrs.get("POM")),
                "document": clean(attrs.get("NOD")),
                "legalBasis": clean(attrs.get("LEG")),
                "link": link,
                "agency": clean(attrs.get("AGEN")),
                "note": clean(attrs.get("ADD")),
                "lines": [],
            },
        )
        line = {"hs": hs, "label": labels[commodity], "form": form}
        if clean(attrs.get("ORIG_LEG_PROD")):
            line["asLegislated"] = clean(attrs.get("ORIG_LEG_PROD"))
        if hs in SHARED_LINE:
            line["sharedWith"] = SHARED_LINE[hs]
        if line not in g["lines"]:
            g["lines"].append(line)
    if unmapped_countries:
        raise SystemExit(f"no ISO2 for {sorted(unmapped_countries)} — add them to ISO3")

    out = sorted(grouped.values(), key=lambda m: (m["iso2"], m["resource"], m["type"], m["introduced"] or ""))
    for m in out:
        m["lines"].sort(key=lambda l: l["hs"])
    doc = {
        "source": "OECD Inventory of Export Restrictions on Critical Raw Materials",
        "dataflow": FLOW,
        "dataYear": YEAR,
        "api": API,
        "explorer": EXPLORER,
        "licence": "CC BY 4.0 (OECD)",
        "retrieved": date.today().isoformat(),
        "scope": "About 80 exporting countries. A country or resource with no row is not recorded in the inventory, which is not the same as unrestricted.",
        "measures": out,
    }
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} measures, {len({(m['iso2'], m['resource']) for m in out})} country-resource pairs")


if __name__ == "__main__":
    main()
