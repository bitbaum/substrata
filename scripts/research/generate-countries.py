#!/usr/bin/env python3
"""Generate config/substrata-countries.ts from the map paths + region table."""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
paths = re.findall(
    r"iso2: '([^']*)', name: '([^']*)'",
    (ROOT / "config/world-paths.ts").read_text(),
)

REGION = {
    "dz": "North Africa", "eg": "North Africa", "ly": "North Africa", "ma": "North Africa",
    "sd": "North Africa", "tn": "North Africa", "eh": "North Africa",
    "bj": "West Africa", "bf": "West Africa", "cv": "West Africa", "ci": "West Africa",
    "gm": "West Africa", "gh": "West Africa", "gn": "West Africa", "gw": "West Africa",
    "lr": "West Africa", "ml": "West Africa", "mr": "West Africa", "ne": "West Africa",
    "ng": "West Africa", "sn": "West Africa", "sl": "West Africa", "tg": "West Africa",
    "bi": "East Africa", "dj": "East Africa", "er": "East Africa", "et": "East Africa",
    "ke": "East Africa", "mg": "East Africa", "mw": "East Africa", "mu": "East Africa",
    "mz": "East Africa", "rw": "East Africa", "so": "East Africa", "ss": "East Africa",
    "tz": "East Africa", "ug": "East Africa", "zm": "East Africa", "zw": "East Africa",
    "ao": "Central Africa", "cm": "Central Africa", "cf": "Central Africa", "td": "Central Africa",
    "cg": "Central Africa", "cd": "Central Africa", "gq": "Central Africa", "ga": "Central Africa",
    "st": "Central Africa",
    "bw": "Southern Africa", "ls": "Southern Africa", "na": "Southern Africa", "za": "Southern Africa",
    "sz": "Southern Africa",
    "ca": "North America", "gl": "North America", "mx": "North America", "us": "North America",
    "pr": "Caribbean", "cu": "Caribbean", "do": "Caribbean", "ht": "Caribbean", "jm": "Caribbean",
    "bs": "Caribbean", "tt": "Caribbean",
    "bz": "Central America", "cr": "Central America", "sv": "Central America", "gt": "Central America",
    "hn": "Central America", "ni": "Central America", "pa": "Central America",
    "ar": "South America", "bo": "South America", "br": "South America", "cl": "South America",
    "co": "South America", "ec": "South America", "fk": "South America", "gy": "South America",
    "py": "South America", "pe": "South America", "sr": "South America", "uy": "South America",
    "ve": "South America",
    "kz": "Central Asia", "kg": "Central Asia", "tj": "Central Asia", "tm": "Central Asia", "uz": "Central Asia",
    "cn": "East Asia", "jp": "East Asia", "kp": "East Asia", "kr": "East Asia", "mn": "East Asia", "tw": "East Asia",
    "af": "South Asia", "bd": "South Asia", "bt": "South Asia", "in": "South Asia", "ir": "South Asia",
    "lk": "South Asia", "np": "South Asia", "pk": "South Asia",
    "bn": "Southeast Asia", "kh": "Southeast Asia", "id": "Southeast Asia", "la": "Southeast Asia",
    "my": "Southeast Asia", "mm": "Southeast Asia", "ph": "Southeast Asia", "sg": "Southeast Asia",
    "th": "Southeast Asia", "tl": "Southeast Asia", "vn": "Southeast Asia",
    "am": "West Asia", "az": "West Asia", "bh": "West Asia", "cy": "West Asia", "ge": "West Asia",
    "iq": "West Asia", "il": "West Asia", "jo": "West Asia", "kw": "West Asia", "lb": "West Asia",
    "om": "West Asia", "ps": "West Asia", "qa": "West Asia", "sa": "West Asia", "sy": "West Asia",
    "tr": "West Asia", "ae": "West Asia", "ye": "West Asia",
    "by": "Eastern Europe", "bg": "Eastern Europe", "cz": "Eastern Europe", "hu": "Eastern Europe",
    "md": "Eastern Europe", "pl": "Eastern Europe", "ro": "Eastern Europe", "ru": "Eastern Europe",
    "sk": "Eastern Europe", "ua": "Eastern Europe",
    "dk": "Northern Europe", "ee": "Northern Europe", "fi": "Northern Europe", "is": "Northern Europe",
    "ie": "Northern Europe", "lv": "Northern Europe", "lt": "Northern Europe", "no": "Northern Europe",
    "se": "Northern Europe", "gb": "Northern Europe",
    "at": "Western Europe", "be": "Western Europe", "fr": "Western Europe", "de": "Western Europe",
    "li": "Western Europe", "lu": "Western Europe", "mc": "Western Europe", "nl": "Western Europe",
    "ch": "Western Europe",
    "al": "Southern Europe", "ba": "Southern Europe", "hr": "Southern Europe", "gr": "Southern Europe",
    "it": "Southern Europe", "mk": "Southern Europe", "mt": "Southern Europe", "me": "Southern Europe",
    "pt": "Southern Europe", "rs": "Southern Europe", "si": "Southern Europe", "es": "Southern Europe",
    "au": "Oceania", "fj": "Oceania", "nc": "Oceania", "nz": "Oceania", "pg": "Oceania",
    "sb": "Oceania", "vu": "Oceania",
    "aq": "Antarctica", "tf": "Antarctica",
}

EXTRA = {
    "co": (["coal", "oil", "nickel", "copper"], "Coal, oil and nickel. Andean copper on the same electrification curve as Chile and Peru."),
    "ve": (["oil", "natural-gas"], "One of the largest oil endowments on earth. Energy as a state, not just a well."),
    "ec": (["oil", "copper"], "Oil and a Pacific copper belt."),
    "gy": (["oil", "gold", "bauxite"], "New offshore oil and an older bauxite/gold base."),
    "sr": (["oil", "gold", "bauxite"], "Same Guiana shield as Guyana: oil arriving on an older minerals base."),
    "uy": (["hydropower"], "A small, high-skill grid. Interesting as a permission and power-system case, not as ore."),
    "ke": (["hydropower"], "East African industrial and geothermal power node. Materials mostly next door."),
    "tz": (["gold", "hydropower"], "Gold and a growing power system on the Indian Ocean logistics lane."),
    "et": (["hydropower", "gold"], "Hydropower at continental scale. The constraint is transmission and permission."),
    "ug": (["oil", "gold"], "Albertine oil and a landlocked industrial permission problem."),
    "rw": ([], "A dense state trying to be a services and assembly node. Gap: almost no mapped materials."),
    "gh": (["gold", "oil", "bauxite"], "Gold, oil, bauxite. A West African industrial base next to the Sahel uranium belt."),
    "ci": (["gold", "oil"], "The commercial capital of Francophone West Africa. Logistics more than ore."),
    "sn": (["phosphates", "oil"], "Phosphates and new offshore oil/gas."),
    "ml": (["gold", "lithium"], "Gold and lithium pegmatites. The resource is not yet a chemical plant."),
    "bf": (["gold"], "Gold. Sahel permission is the binding constraint as much as geology."),
    "td": (["oil"], "Landlocked oil. Energy that does not yet industrialise at home."),
    "sd": (["gold", "oil"], "Gold and oil. A Red Sea logistics and permission problem."),
    "ss": (["oil"], "Oil. The state is the constraint."),
    "so": ([], "Indian Ocean coastline. No mineral directory row; logistics and permission are the open questions."),
    "er": (["copper", "gold"], "Copper-gold. A Red Sea minerals node."),
    "dj": ([], "The port. China, the US and France all sit on this harbour for a reason."),
    "ly": (["oil", "natural-gas"], "Oil and gas. North African energy that Europe still feels."),
    "tn": (["phosphates", "oil"], "Phosphates and a Mediterranean industrial permission case."),
    "dz": (["oil", "natural-gas", "phosphates"], "Gas that Europe burns. Phosphates. A North African energy state."),
    "mr": (["iron", "gold"], "Iron ore to the Atlantic. One of West Africa's actual bulk-export geologies."),
    "bw": (["diamonds", "coal", "copper"], "Diamonds and coal. A southern African industrial state."),
    "zw": (["lithium", "gold", "pgms"], "Hard-rock lithium and gold. The resource is not the chemical."),
    "mz": (["natural-gas", "coal", "graphite"], "LNG and graphite. Energy and anodes."),
    "mg": (["nickel", "graphite", "rare-earths"], "Nickel, graphite, and a rare-earth project pipeline."),
    "ao": (["oil", "diamonds"], "Atlantic oil. An energy node, not yet a manufacturing one."),
    "cm": (["oil", "bauxite"], "Oil and a Central African logistics hinge."),
    "ga": (["oil", "manganese"], "Oil and manganese — steel's other rock."),
    "cg": (["oil"], "Oil on the Congo coast."),
    "cf": (["diamonds", "gold"], "Artisanal minerals. Permission and conflict, not a factory."),
    "gl": (["rare-earths", "uranium"], "Rare earths and uranium in the Arctic. The ice is the permission system."),
    "is": (["hydropower"], "Geothermal and hydro electrons that smelt aluminium. Energy as export."),
    "ie": (["natural-gas"], "A data-centre and pharma node. Power and permission, not mines."),
    "pt": (["lithium", "copper", "tungsten"], "European lithium and an older tungsten story."),
    "es": (["copper", "tungsten"], "Copper and a European industrial permission case."),
    "it": (["natural-gas"], "Manufacturing, machinery, and a gas-import energy system."),
    "gr": (["bauxite", "nickel"], "Bauxite and nickel. A Mediterranean materials node."),
    "pl": (["coal", "copper"], "Copper and coal. A European industrial permission problem."),
    "ro": (["natural-gas", "coal"], "Gas and a Black Sea industrial base."),
    "hu": (["bauxite"], "A European battery and auto assembly node more than a mine."),
    "cz": ([], "Machinery and a European industrial permission case. Gap: few mapped minerals."),
    "sk": ([], "Auto and machinery. Same story as Czechia."),
    "at": (["hydropower"], "Hydro, machinery, and a European industrial core."),
    "be": ([], "The port and the chemicals. Antwerp is a materials node with no mines."),
    "lu": ([], "Capital and steel history. Finance more than ore."),
    "dk": (["oil", "natural-gas"], "North Sea energy and a wind-industrial base."),
    "ee": (["oil"], "Oil shale and a Baltic digital/permission case."),
    "lv": ([], "Baltic logistics. Gap: no mineral directory row."),
    "lt": ([], "Baltic logistics and a small industrial base."),
    "by": (["potash"], "Potash. A landlocked industrial permission case."),
    "md": ([], "A landlocked European gap. No mineral directory row."),
    "ge": (["copper", "gold"], "Caucasus copper-gold and a Black Sea logistics hinge."),
    "am": (["copper", "gold", "molybdenum"], "Copper-molybdenum. A landlocked Caucasus minerals node."),
    "az": (["oil", "natural-gas"], "Caspian oil and gas."),
    "tm": (["natural-gas"], "Among the world's large gas endowments. A pipeline state."),
    "tj": (["hydropower", "gold"], "Hydro in the Pamirs. Energy as mountains."),
    "kg": (["gold"], "Gold. A Central Asian minerals node."),
    "af": (["copper", "lithium", "rare-earths"], "Copper, lithium, rare earths — mapped, barely industrialised."),
    "pk": (["coal", "natural-gas"], "Coal, gas, and a large industrial population. Permission and power."),
    "bd": (["natural-gas"], "Gas and a dense manufacturing labour force. Not a mine."),
    "np": (["hydropower"], "Himalayan hydro. Transmission is the wait."),
    "bt": (["hydropower"], "Hydro exported to India. Energy as a neighbour."),
    "lk": (["graphite"], "Natural graphite. Anodes."),
    "mm": (["rare-earths", "tin", "natural-gas"], "Rare earths, tin, gas. A Southeast Asian materials hinge."),
    "la": (["hydropower", "copper"], "Hydro and copper. A landlocked Mekong industrial case."),
    "kh": (["bauxite"], "A manufacturing absorber. Minerals thin; assembly is the story."),
    "bn": (["oil", "natural-gas"], "Oil and gas. A small energy state."),
    "tl": (["oil", "natural-gas"], "Timor Sea energy. A young state on a hydrocarbon basin."),
    "pg": (["copper", "gold", "natural-gas"], "Copper-gold and LNG. A Pacific materials node."),
    "fj": (["gold"], "Gold and a Pacific logistics node."),
    "nc": (["nickel"], "Nickel laterites. The same battery curve as Indonesia and the Philippines."),
    "sb": (["gold"], "Gold. A Pacific gap with a thin industrial base."),
    "vu": ([], "Pacific gap. No mineral directory row."),
    "kp": (["coal", "iron", "rare-earths"], "Coal, iron, rare earths — almost none of it in open trade."),
    "mn": (["copper", "coal", "gold"], "Copper that feeds Chinese refining. A mine next to the midstream."),
    "ir": (["oil", "natural-gas", "copper"], "Oil, gas, copper. Sanctions make this a permission map as well as a geology one."),
    "iq": (["oil", "natural-gas"], "Oil. A Mesopotamian energy state."),
    "sy": (["oil", "phosphates"], "Oil and phosphates. The state is the constraint."),
    "jo": (["phosphates"], "Phosphates. A logistics hinge next to the Red Sea."),
    "lb": ([], "A Mediterranean services node. Gap: no mineral directory row."),
    "ps": ([], "No mineral directory row. Permission is the entire story."),
    "ye": (["oil"], "Oil and a Bab el-Mandeb logistics chokepoint for everyone else's energy."),
    "om": (["oil", "natural-gas", "copper"], "Oil, gas, copper. A Gulf industrial permission case."),
    "kw": (["oil", "natural-gas"], "Oil. A Gulf capital and energy state."),
    "bh": (["oil"], "Oil and a Gulf finance/aluminium node."),
    "qa": (["natural-gas"], "LNG. Firm gas that other people's industry burns."),
    "ht": (["bauxite"], "Historic bauxite. Today a permission and logistics gap."),
    "do": (["gold", "nickel"], "Gold and nickel. A Caribbean minerals node."),
    "cu": (["nickel", "cobalt"], "Nickel-cobalt. A Caribbean battery-metals geology."),
    "jm": (["bauxite"], "Bauxite. Aluminium's older Caribbean chapter."),
    "tt": (["natural-gas", "oil"], "Gas and a Caribbean chemicals/LNG node."),
    "pa": ([], "The canal. Logistics for everyone else's copper and containers."),
    "cr": (["hydropower"], "Hydro and a high-skill manufacturing permission case."),
    "ni": (["gold"], "Gold. A Central American minerals gap."),
    "hn": (["gold", "silver"], "Gold and silver. Thin industrial base."),
    "sv": (["gold"], "A dense manufacturing labour force. Not a mine."),
    "gt": (["nickel"], "Nickel. A Central American minerals node."),
    "bz": ([], "A logistics gap. No mineral directory row."),
    "bs": ([], "A services and logistics node. No mineral directory row."),
    "pr": ([], "A US manufacturing and power-system case. No mineral directory row."),
    "fk": ([], "A South Atlantic gap. No mineral directory row."),
    "tf": ([], "Southern ocean. Not a research geography."),
    "aq": ([], "Ice. Not a research geography for this map."),
}

# manganese, potash, tungsten, molybdenum not in ResourceId — map to closest or skip
ALLOWED = {
    "uranium","lithium","copper","cobalt","nickel","rare-earths","graphite","iron",
    "bauxite","tin","pgms","helium","quartz","natural-gas","oil","hydropower",
    "phosphates","gallium","gold","coal","diamonds","neon","boron","silver",
}

ROLES = {
    "jp": ["manufacture", "research"],
    "kr": ["manufacture", "research"],
    "tw": ["manufacture", "research"],
    "nl": ["manufacture", "research"],
    "de": ["manufacture", "research", "energy"],
    "us": ["extract", "manufacture", "energy", "permission", "capital", "research"],
    "cn": ["extract", "refine", "manufacture", "energy", "permission"],
    "sg": ["logistics", "capital", "refine"],
    "ch": ["capital", "research", "manufacture"],
    "gb": ["capital", "research", "permission", "energy"],
    "fr": ["energy", "manufacture", "permission", "research"],
    "ae": ["capital", "energy", "logistics"],
    "sa": ["energy", "capital"],
    "qa": ["energy", "capital"],
    "pa": ["logistics"],
    "dj": ["logistics"],
    "be": ["logistics", "refine"],
    "lu": ["capital"],
}

lines = [
    "/**",
    " * Every landmass on the map. Generated from world-paths + UN-ish regions.",
    " * Re-run: python3 scripts/research/generate-countries.py",
    " * Resources still live in substrata-resources.ts and are joined at read time.",
    " */",
    "export type PathRole =",
    "  | 'extract'",
    "  | 'refine'",
    "  | 'manufacture'",
    "  | 'energy'",
    "  | 'capital'",
    "  | 'permission'",
    "  | 'logistics'",
    "  | 'research'",
    "  | 'gap';",
    "",
    "export type CountryIndex = {",
    "  iso2: string;",
    "  name: string;",
    "  region: string;",
    "  roles: readonly PathRole[];",
    "};",
    "",
    "export const COUNTRIES: readonly CountryIndex[] = [",
]

def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")

seen = set()
for iso, name in paths:
    key = iso or name.lower().replace(" ", "-")[:12]
    if key in seen:
        continue
    seen.add(key)
    region = REGION.get(iso, "Unassigned") if iso else "Unassigned"
    roles = list(ROLES.get(iso, []))
    extra = EXTRA.get(iso)
    if extra and extra[0]:
        if "extract" not in roles:
            roles.append("extract")
    if not roles:
        roles = ["gap"]
    iso_js = iso if iso else ""
    role_js = ", ".join(f"'{r}'" for r in roles)
    lines.append(
        f"  {{ iso2: '{iso_js}', name: '{esc(name)}', region: '{esc(region)}', roles: [{role_js}] }},"
    )

lines.append("];")
lines.append("")
lines.append("export function countryIndex(iso2: string): CountryIndex | null {")
lines.append("  const id = iso2.toLowerCase();")
lines.append("  return COUNTRIES.find((c) => c.iso2 === id) ?? null;")
lines.append("}")
lines.append("")

# extra endowments as a typed add-on merged by resourcesFor
lines.append("/** Extra directory rows generated with the country index. */")
lines.append("export const EXTRA_ENDOWMENTS: readonly {")
lines.append("  iso2: string;")
lines.append("  resources: readonly string[];")
lines.append("  why: string;")
lines.append("}[] = [")
for iso, (res, why) in sorted(EXTRA.items()):
    clean = [r for r in res if r in ALLOWED]
    res_js = ", ".join(f"'{r}'" for r in clean)
    lines.append(f"  {{ iso2: '{iso}', resources: [{res_js}], why: '{esc(why)}' }},")
lines.append("];")
lines.append("")

out = ROOT / "config/substrata-countries.ts"
out.write_text("\n".join(lines) + "\n")
print("wrote", out, "countries", len(seen), "extra", len(EXTRA))
