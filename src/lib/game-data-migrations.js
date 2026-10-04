const isStorageRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const VANILLA_HOLO_REVISION = 'vanilla-0.10.31.24710+holo-beacon-0.10.34';
export const LEGACY_VANILLA_RECIPE_COUNT = 238;

/**
 * A deliberately narrow append-only migration, not a generic length repair.
 * The original 238 recipes (and every existing per-item choice) are unchanged.
 * The prefix's exact data/order is pinned by game-data-version.test.jsx.
 */
export function migrateSchemeForGame(saved, game) {
    if (game.game_name !== 'Vanilla' || game.data_revision !== VANILLA_HOLO_REVISION
        || game.recipe_data.length !== LEGACY_VANILLA_RECIPE_COUNT + 1
        || game.recipe_ids?.[LEGACY_VANILLA_RECIPE_COUNT] !== 161
        || !isStorageRecord(saved) || !isStorageRecord(saved.item_recipe_choices)
        || !Array.isArray(saved.scheme_for_recipe)
        || saved.scheme_for_recipe.length !== LEGACY_VANILLA_RECIPE_COUNT
        || !isStorageRecord(saved.cost_weight)
        || !isStorageRecord(saved.cost_weight['物品额外成本'])
        || Object.hasOwn(saved.item_recipe_choices, '全息信标')
        || Object.hasOwn(saved.cost_weight['物品额外成本'], '全息信标')) return saved;

    const migrated = structuredClone(saved);
    migrated.scheme_for_recipe.push({'建筑': 0, '增产点数': 0, '增产模式': 0});
    migrated.item_recipe_choices['全息信标'] = 1;
    migrated.cost_weight['物品额外成本']['全息信标'] = {
        '成本': 0, '启用': 0, '与其它成本累计': 0, '溢出时处理成本': 0,
    };
    return migrated;
}

/** Only the old Vanilla shape and its known appended successor need archival. */
export function isReplacedLegacyVanillaScheme(before, after) {
    return isStorageRecord(before) && isStorageRecord(after)
        && Array.isArray(before.scheme_for_recipe) && Array.isArray(after.scheme_for_recipe)
        && before.scheme_for_recipe.length === LEGACY_VANILLA_RECIPE_COUNT
        && after.scheme_for_recipe.length === LEGACY_VANILLA_RECIPE_COUNT + 1
        && isStorageRecord(before.item_recipe_choices) && isStorageRecord(after.item_recipe_choices)
        && !Object.hasOwn(before.item_recipe_choices, '全息信标')
        && after.item_recipe_choices['全息信标'] === 1;
}
