"""
Which USGS MCS chapters Substrata reads, and what each table column means.

A column is described by hand because the chapters are not uniform: copper has
mine AND refinery production, bauxite carries alumina beside it, iron ore gives
usable ore and iron content, PGMs split palladium from platinum. Each entry
names header words the parser must find, so a table that changes shape in the
next edition fails loudly instead of shifting every number one column left.

`resource` is the Substrata ResourceId (config/substrata-resources.ts).
"""
import re
from pathlib import Path

EDITION = "Mineral Commodity Summaries 2026 (February 2026)"
EDITION_YEAR = 2026
DATA_YEARS = (2024, 2025)


def prod(stage: str, year: int, product: str | None = None, estimated: bool = False, unit: str | None = None):
    key = f"{stage}{'-' + product.replace(' ', '-') if product else ''}:{year}"
    col = {"key": key, "measure": "production", "stage": stage, "year": year}
    if product:
        col["product"] = product
    if estimated or year == DATA_YEARS[1]:
        # USGS marks the latest year "e" in the header: every value in it is an estimate.
        col["estimated"] = estimated or True
    if unit:
        col["unit"] = unit
    return col


def reserves(product: str | None = None, unit: str | None = None, footnote: str | None = None):
    col = {"key": f"reserves{'-' + product.replace(' ', '-') if product else ''}", "measure": "reserves", "year": DATA_YEARS[1]}
    if product:
        col["product"] = product
    if unit:
        col["unit"] = unit
    if footnote:
        col["footnote"] = footnote
    return col


def capacity(year: int, stage: str = "plant"):
    return {"key": f"capacity:{year}", "measure": "capacity", "stage": stage, "year": year}


def mine_and_reserves(slug, commodity, resource, unit, unit_quote, heading="World Mine Production and Reserves", all_estimated=False, must=("Mine production", "2024", "Reserves")):
    return {
        "slug": slug,
        "commodity": commodity,
        "resource": resource,
        "heading": heading,
        "unit": unit,
        "unitQuote": unit_quote,
        "headerMustContain": list(must),
        "columns": [prod("mine", 2024, estimated=all_estimated), prod("mine", 2025, estimated=all_estimated), reserves()],
    }


CHAPTERS = [
    mine_and_reserves("lithium", "Lithium", "lithium", "t", "Data in metric tons, lithium content", all_estimated=True),
    {
        "slug": "copper",
        "commodity": "Copper",
        "resource": "copper",
        "heading": "World Mine and Refinery Production and Reserves",
        "unit": "kt",
        "unitQuote": "Data in thousand metric tons, copper content",
        "headerMustContain": ["Mine production", "Refinery production", "Reserves"],
        "columns": [prod("mine", 2024), prod("mine", 2025), prod("refinery", 2024), prod("refinery", 2025), reserves()],
    },
    mine_and_reserves("cobalt", "Cobalt", "cobalt", "t", "Data in metric tons, cobalt content", all_estimated=True),
    mine_and_reserves("nickel", "Nickel", "nickel", "t", "Data in metric tons, nickel content"),
    mine_and_reserves("rare-earths", "Rare earths", "rare-earths", "t", "Data in metric tons, rare-earth-oxide (REO) equivalent", all_estimated=True),
    mine_and_reserves("graphite", "Graphite (natural)", "graphite", "t", "Data in metric tons"),
    {
        "slug": "iron-ore",
        "commodity": "Iron ore",
        "resource": "iron",
        "heading": "World Mine Production and Reserves",
        "unit": "kt",
        "unitQuote": "Data in thousand metric tons, usable ore; reserves in million metric tons",
        "headerMustContain": ["Usable ore", "Iron content", "Crude ore"],
        "columns": [
            prod("mine", 2024, "usable ore"),
            prod("mine", 2025, "usable ore"),
            prod("mine", 2024, "iron content"),
            prod("mine", 2025, "iron content"),
            reserves("crude ore", unit="Mt"),
            reserves("iron content", unit="Mt"),
        ],
    },
    {
        "slug": "bauxite-alumina",
        "commodity": "Bauxite and alumina",
        "resource": "bauxite",
        # The mine is the resource; alumina refining is shown beside it.
        "primary": "mine-bauxite",
        "heading": "World Alumina Refinery and Bauxite Mine Production and Bauxite Reserves",
        "unit": "kt",
        "unitQuote": "Data in thousand metric dry tons",
        "headerMustContain": ["Alumina production", "Bauxite production", "Bauxite reserves"],
        "columns": [
            prod("refinery", 2024, "alumina"),
            prod("refinery", 2025, "alumina"),
            prod("mine", 2024, "bauxite"),
            prod("mine", 2025, "bauxite"),
            reserves("bauxite"),
        ],
    },
    mine_and_reserves("tin", "Tin", "tin", "t", "Data in metric tons, tin content"),
    {
        "slug": "platinum-group",
        "commodity": "Platinum-group metals",
        "resource": "pgms",
        # Platinum and palladium are separate series; neither is "PGMs". Platinum leads
        # because it is the one the hydrogen and catalyst chains name.
        "primary": "mine-platinum",
        "heading": "World Mine Production and Reserves",
        "unit": "kg",
        "unitQuote": "Data in kilograms, platinum-group-metal (PGM) content",
        "headerMustContain": ["Palladium", "Platinum", "PGM reserves"],
        "columns": [
            prod("mine", 2024, "palladium"),
            prod("mine", 2025, "palladium"),
            prod("mine", 2024, "platinum"),
            prod("mine", 2025, "platinum"),
            reserves("PGM"),
        ],
    },
    {
        "slug": "helium",
        "commodity": "Helium",
        "resource": "helium",
        "heading": "World Production and Reserves",
        "unit": "Mcm",
        "unitQuote": "Data in million cubic meters",
        "headerMustContain": ["Helium", "Production", "Reserves"],
        # The right half of the page is a separate rare-gases table.
        "xLimit": 280,
        "columns": [prod("plant", 2024), prod("plant", 2025), reserves()],
    },
    {
        "slug": "gallium",
        "commodity": "Gallium (low-purity, primary)",
        "resource": "gallium",
        "primary": "primary",
        "heading": "World Low-Purity Production and Production Capacity",
        "unit": "kg",
        "unitQuote": "Data in kilograms, gallium content",
        "headerMustContain": ["Primary production", "Production capacity"],
        "columns": [prod("primary", 2024), prod("primary", 2025), capacity(2025)],
    },
    mine_and_reserves("gold", "Gold", "gold", "t", "Data in metric tons, gold content"),
    mine_and_reserves("silver", "Silver", "silver", "t", "Data in metric tons, silver content"),
    mine_and_reserves(
        "diamond",
        "Diamond (natural industrial)",
        "diamonds",
        "Mct",
        "Data in million carats",
        heading="World Natural Industrial Diamond Mine Production and Reserves",
    ),
    mine_and_reserves("phosphate", "Phosphate rock", "phosphates", "kt", "Data in thousand metric tons, marketable phosphate rock", all_estimated=True),
    mine_and_reserves("tungsten", "Tungsten", "tungsten", "t", "Data in metric tons, tungsten content", all_estimated=True),
    mine_and_reserves("antimony", "Antimony", "antimony", "t", "Data in metric tons, antimony content"),
    {
        "slug": "silicon",
        "commodity": "Silicon (ferrosilicon and silicon metal)",
        "resource": "silicon",
        # Silicon metal is the polysilicon feed; ferrosilicon goes to steel.
        "primary": "plant-silicon-metal",
        "heading": "World Production",
        "unit": "kt",
        "unitQuote": "Data in thousand metric tons, silicon content",
        "headerMustContain": ["Ferrosilicon", "Silicon metal"],
        "columns": [
            prod("plant", 2024, "ferrosilicon", estimated=True),
            prod("plant", 2025, "ferrosilicon", estimated=True),
            prod("plant", 2024, "silicon metal", estimated=True),
            prod("plant", 2025, "silicon metal", estimated=True),
        ],
    },
]

_WORLD_PATHS = Path(__file__).resolve().parents[2] / "config" / "world-paths.ts"
COUNTRY_ISO2: dict[str, str] = {
    name: iso for iso, name in re.findall(r"iso2: '([a-z-]+)', name: '([^']+)'", _WORLD_PATHS.read_text())
}
# USGS spellings that differ from the map's.
COUNTRY_ISO2.update(
    {
        "United States": "us",
        "Burma": "mm",
        "Congo (Kinshasa)": "cd",
        "Congo (Brazzaville)": "cg",
        "Korea, North": "kp",
        "Korea, Republic of": "kr",
        "Russia": "ru",
        "Turkey": "tr",
        "Laos": "la",
        "New Caledonia": "nc",
        "Dominican Republic": "do",
        "Bosnia and Herzegovina": "ba",
        "Cote d'Ivoire": "ci",
        "Côte d’Ivoire": "ci",
        "Czechia": "cz",
        "Eswatini": "sz",
        "Taiwan": "tw",
        "United Kingdom": "gb",
        "Vietnam": "vn",
        "Iran": "ir",
        "Syria": "sy",
        "Tanzania": "tz",
        "Kyrgyzstan": "kg",
        "Macedonia": "mk",
        "North Macedonia": "mk",
        "Central African Republic": "cf",
        "Papua New Guinea": "pg",
        "Solomon Islands": "sb",
        "Equatorial Guinea": "gq",
        "South Sudan": "ss",
        "Bahrain": "bh",
        "Bhutan": "bt",
        "Singapore": "sg",
        "Malta": "mt",
        "Mauritius": "mu",
    }
)
