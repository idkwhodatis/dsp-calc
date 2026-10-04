# Verified Holo Beacon increment

This is a narrow vanilla-only addition to the existing **0.10.31.24710** dataset. It does **not** claim complete 0.10.34 or 0.10.35 support. Mod combination files remain unchanged.

## Source

The original export-tool author's maintained calculator fork contains a vanilla game export with Holo Beacon:

- [Pinned vanilla export](https://github.com/MengLeiFudge/dsp-calc/blob/87793666d0ed8210793a6380d95f767e73f8c624/src/engine/data/raw/Vanilla.json)
- [Data update commit, 2026-06-08](https://github.com/MengLeiFudge/dsp-calc/commit/d1b27ca0c16eeaa7b9da705e6d7c69e4f894f18e)
- [Original lighthouse icon](https://raw.githubusercontent.com/MengLeiFudge/dsp-calc/87793666d0ed8210793a6380d95f767e73f8c624/src/ui/components/icons/assets/Vanilla/lighthouse.png)
- [Independent recipe agreement in FactorioLab](https://github.com/factoriolab/factoriolab/blob/08ff58b11de5b619b9bf088cf81171ca418721da/public/data/dsp/data.json)

The original 80×80 game icon is copied without modification (SHA-256 `8f2c10f778922fcedac541f2310f2677d6aa82bfdaf2d996234bd3ebdf389f68`). Existing game-asset ownership and project license notices continue to apply.

## Applied data

- Item **2401**, 全息信标, Type **7**, GridIndex **2410**, icon **lighthouse**
- Recipe **161**, Type **4**, factories **2303 / 2304 / 2305 / 2318**
- **3 iron ingots + 4 prisms + 2 plasma exciters + 2 circuit boards → 1 Holo Beacon**
- **240 ticks / 4 seconds**, no coproducts, Proliferator **3** (extra output and acceleration)
- EM-Rail Ejector **2311** moves from grid **2410** to **2411**
- Vertical Launching Silo **2312** moves from grid **2411** to **2412**

No other item, recipe, factory rate, synthetic harvesting recipe, or mod data was imported. The exporter fork has a different engine contract, including zero-time fractionation and synthetic recipes without IDs, so copying its entire file would be unsafe.

## Save compatibility

Recipe 161 is appended at index **238**. All original 238 recipe entries, ordinals, per-item choices and factory-group ordering are retained. `tests/game-data-version.test.jsx` pins the original recipe-prefix SHA-256 and verifies existing per-item indices.

The migration recognizes only the old 238-recipe Vanilla scheme and this exact new data revision. It adds only the Beacon recipe configuration, choice and item-cost defaults. Existing automatic strategies, named strategies, complete plans and source recipe references retain their settings. Unknown sizes/profiles are not guessed into compatibility.

Before an old automatic save is replaced, or an explicit save overwrites an old named strategy/complete plan, the exact original localStorage string is archived under `game_data_migration_backups`. Named entries are not rewritten or archived on load, so backup storage limits do not block a safe load. Archival failure leaves the original persisted data intact and blocks only the pending overwrite. Repeated identical archives are deduplicated. Explicit reset clears these archives together with the other calculator saves.

## Remaining 0.10.35 work

Official announcements confirm the addition of Dark Fog Lens. Its original vanilla grid and ray-receiver numerical behavior still require direct current-build verification; no speculative lens recipe or receiving mode is included in this increment. The UI reports the base version and this limited addition explicitly.
