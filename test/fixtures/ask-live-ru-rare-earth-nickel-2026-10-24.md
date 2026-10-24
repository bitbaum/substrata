You are right: the `producers_in` rows do carry the `companies` cells, and those print owners/stakes (where USGS lists them). I summarized those out on the first pass. Rewriting below, quoting the printed cells and capacities verbatim, with links.

## What the sources say (USGS Minerals Yearbook, Russia chapter, 2022)

**Rare earths**
- `companies` cell as printed: **OAO Apatit**. `read_as` splits this to operator = OAO Apatit, owner = *not listed on the row* (the cell names only the operator).
- Location: Mines at Lovozerskoye deposit, Kola Peninsula.
- `capacity` as printed: **2700 metric tons**.
- Source: [USGS Minerals Yearbook 2022, Russia chapter](https://pubs.usgs.gov/myb/vol3/2022/myb3-2022-russia.pdf). Status: **Sourced** (primary statistical source). Note: capacity is capacity, not production; the row names no buyers.

**Nickel**
- `companies` cell as printed: **OAO Ufaleynickel (Koks Co. of Industrial Metallurgical Holding)**. `read_as` splits to operator = OAO Ufaleynickel, owner = **Koks Co. of Industrial Metallurgical Holding** (stated as the printed cell, no stake percentage given in the row).
  - Location: Mines in Chelyabinsk Oblast, Urals.
  - `capacity` as printed: **17000 metric tons** (ore, Ni content).
- `companies` cell as printed: **PAO GMK Norilskiy Nickel (Nornickel)**. `read_as` splits to operator = PAO GMK Norilskiy Nickel (Nornickel), owner = *not listed on the row* (the parenthetical "(Nornickel)" is USGS' trading/short name, not a separate owner stake).
  - Location: Mines in Murmansk Oblast (Kotselvaara-Kammikivi, Zapolyarnnoye, and Zhdanovskoye) and in Norilsk region.
  - `capacity` as printed: **300000 metric tons** (ore, Ni content).
- `companies` cell as printed: **ZAO NPK Geotechnologiya**. `read_as` splits to operator = ZAO NPK Geotechnologiya, owner = *not listed on the row*.
  - Location: Mine at Shanuch deposit, Kamchatka Kray.
  - `capacity` as printed: **null** — the row note says "USGS prints no capacity for this row (NA)." No number to copy.

All of the above: **Sourced**, USGS Minerals Yearbook 2022, Russia chapter: [link](https://pubs.usgs.gov/myb/vol3/2022/myb3-2022-russia.pdf).

## What is missing, and the single link that would settle it

The missing link is the **ownership stake for the parent entities**: the USGS row for Ufaleynickel names "Koks Co. of Industrial Metallurgical Holding" as owner but does not print a stake percentage, and for Apatit, Nornickel, and Geotechnologiya it prints no owner at all (only the operator). A company-registry or annual-report source that carries, for each facility, the operating entity plus its ultimate parent and the percentage stake held would settle that gap. (One such row per facility — operator, parent, stake %, as of the facility year.)

I should be clear about the `read_as` field again: when it lists an owner, that value comes directly from the printed `companies` cell (so "Koks Co. of Industrial Metallurgical Holding" is quoted as printed, not inferred). When it leaves owner null, that is because the printed cell only names the operator — it is a true absence in the row, not an unstated fact.

No web results `[W#]` were returned for this question, so there are no unchecked leads to list under that heading.