# Coproduct accounting: general rules and verified scope

The ordinary recipe engine already handles multiple outputs generically. The hydrogen/deuterium orbital change adds a narrowly identified physical process that the imported data represented as separate single-output acquisition recipes; it does not replace the general recipe balance.

## Ordinary manufacturing

For every physical source, the calculation credits its target output and net coproducts, subtracts its inputs, and supplies only the remaining demand automatically. Self-recycling inputs are netted before coproduct normalization. The source owns its factories and power once; the recipient's read-only linked coproduct row does not create another factory.

These unboosted vanilla cases each run 60 recipe cycles per minute:

| Process | Net outputs per minute | External input per minute | Process factories |
| --- | --- | --- | --- |
| Fire-ice graphene | 120 graphene + 60 hydrogen | 120 fire ice | 2 chemical plants |
| Plasma refining | 120 refined oil + 60 hydrogen | 120 crude oil | 4 refineries |
| X-ray cracking | 60 hydrogen + 60 energetic graphite | 60 refined oil | 4 refineries |
| Photon conversion | 120 antimatter + 120 hydrogen | 120 critical photons | 2 particle colliders |

X-ray cracking's hydrogen figure is **net**: the gross hydrogen output also includes hydrogen recirculated into that same process. Factories in the table describe the audited process, excluding upstream production.

The regression tests exercise automatic-only plans, zero allocations, manual allocation against either output, multiple lines, changed building/proliferator settings, and excess supply. A partial manual source and the automatic remainder retain the required total physical execution. Extra supply appears as surplus rather than being added to true gross demand.

## Physical identity matters

A coproduct link points to its actual producing source. Two explicit manual lines retain their distinct source IDs and represent two independent production runs, even if the recipe or output rates match. Their inputs, capacity and power are additive. Their factories are rounded per independent line; equal outputs alone do not justify merging partially loaded buildings.

To use hydrogen already produced by a graphene line, that line's hydrogen is credited automatically. Adding a second independent hydrogen-producing line intentionally adds production; it does not identify the first line a second time.

Automatic representations of an equivalent recipe can be attributed to one product only when recipe identity, settings, physical flows, energy and cost agree. Different manufacturing recipes or equipment/proliferator configurations are not merged by matching product names.

## Imported mod recipes

The same balance applies to explicit multi-output recipes in the supported datasets. The audit covers Genesis chemistry and refining, its modded building speeds, MoreMegaStructure station/vessel production, and TheyComeFromVoid blue-buff input returns. Returned inputs and self-recycling outputs are netted once. Tests cover the bundled combinations rather than assuming vanilla rates for mod factories.

## Acquisition boundary

The source datasets contain no explicit multi-output raw-acquisition recipes. Orbital hydrogen, deuterium and fire ice are separate synthetic entries; Genesis giant and atmospheric gases are also split. Those entries do not identify a planet, its composition, or an existing fleet.

The known native H/D pair therefore has its own explicit global gas-giant profile, described in [shared orbital collectors](shared-orbital-collectors.md). Ice-giant hydrogen/fire-ice and mod acquisition sources are **not automatically pooled**. A further shared-planet model would need explicit planet/profile provenance; matching factory names or rates is insufficient. Independent planets must remain independent.

## Logistics scope

Each product's aggregate known supply enters its transport estimate once, including any surplus that is physically produced. A linked coproduct does not add another manufacturing building. Coproduct sorter interfaces are currently marked unassessed, and unknown stacking stays at one cargo layer. This conservative logistics limitation is separate from the material and factory accounting; the UI does not claim an unverified full-load sorter or pile-sorter capacity for the linked row.

## Regression files

- `tests/multi-output-physical-audit.test.js`: vanilla physical execution and independent-source identity
- `tests/mod-coproduct-audit.test.js`: supported mod chemistry, recycling and acquisition boundaries
- `tests/coproduct-logistics-audit.test.js`: gross demand, source links, physical supply and conservative logistics
- `tests/shared-orbital-collectors.test.js`: the explicit native H/D process
