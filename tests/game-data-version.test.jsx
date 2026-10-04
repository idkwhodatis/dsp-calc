import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {useContext, useEffect} from 'react';
import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import vanilla from '../data/Vanilla.json';
import {default_game_data, get_game_data, get_mod_options, vanilla_data_description, vanilla_game_version} from '../src/GameData.jsx';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {ContextProvider, GlobalStateContext, NeedsListContext, PlanLoaderContext, StorageWarningContext} from '../src/contexts.jsx';
import {decodeSavedPlan} from '../src/lib/plan-state.js';
import {buildGamePickerLayout} from '../src/lib/game-picker-layout.js';
import {migrateSchemeForGame} from '../src/lib/game-data-migrations.js';
import {backupGameDataStorage, GAME_DATA_BACKUP_KEY, updateScopedStorage} from '../src/lib/storage.js';
import {baselineSettings, calculateScenario} from './helpers/solver-cases.js';

const baseCount = 238;
const api = {GameInfo, GlobalState, get_game_data, init_scheme_data};
const legacyGame = {...default_game_data, recipe_data: default_game_data.recipe_data.slice(0, baseCount),
    recipe_ids: default_game_data.recipe_ids.slice(0, baseCount)};
const readStore = key => JSON.parse(localStorage.getItem(key));
function oldScheme() {
    const scheme = init_scheme_data(legacyGame);
    scheme.item_recipe_choices['石墨烯'] = 2;
    scheme.scheme_for_recipe[0] = {建筑: 1, 增产模式: 2, 增产点数: 4};
    scheme.cost_weight['电力'] = 13;
    scheme.cost_weight['物品额外成本']['铁块'] = {成本: 12, 启用: 1, 与其它成本累计: 1, 溢出时处理成本: 45};
    return scheme;
}
function expectPreserved(migrated, original) {
    expect(migrated.scheme_for_recipe.slice(0, baseCount)).toEqual(original.scheme_for_recipe);
    for (const [item, choice] of Object.entries(original.item_recipe_choices)) expect(migrated.item_recipe_choices[item]).toBe(choice);
    const restored = structuredClone(migrated);
    restored.scheme_for_recipe.pop();
    delete restored.item_recipe_choices['全息信标'];
    delete restored.cost_weight['物品额外成本']['全息信标'];
    expect(restored).toEqual(original);
}
function Probe({observe}) {
    const state = useContext(GlobalStateContext);
    const needs = useContext(NeedsListContext);
    const load = useContext(PlanLoaderContext);
    const warning = useContext(StorageWarningContext);
    useEffect(() => observe({state, needs, load, warning}), [observe, state, needs, load, warning]);
    return null;
}
function mount() {
    let current;
    const result = render(<ContextProvider><Probe observe={value => { current = value; }}/></ContextProvider>);
    return {...result, current: () => current};
}
beforeEach(() => { localStorage.clear(); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('verified vanilla Holo Beacon data increment', () => {
    it('preserves all 238 original recipe values and ordering from commit d531233', () => {
        // SHA-256 of JSON.stringify(original recipes), computed from the pristine Git source.
        expect(createHash('sha256').update(JSON.stringify(vanilla.recipes.slice(0, baseCount))).digest('hex'))
            .toBe('c8143f0b621fd4d293afeef55d11d1ffd7b53c3ac156833de4ad9883eb454759');
        expect(vanilla.recipes).toHaveLength(239);
        expect(vanilla.items).toHaveLength(175);
        const legacyInfo = new GameInfo(legacyGame);
        const info = new GameInfo(default_game_data);
        for (const [item, recipes] of Object.entries(legacyInfo.item_data)) expect(info.item_data[item]).toEqual(recipes);
        expect(default_game_data.factory_data).toEqual(legacyGame.factory_data);
    });

    it('appends the pinned exporter recipe with correct quantities, ticks, factories and proliferation', () => {
        expect(vanilla.recipes[238]).toEqual({ID: 161, Type: 4, Factories: [2303, 2304, 2305, 2318], Name: '全息信标',
            Items: [1101, 1111, 1401, 1301], ItemCounts: [3, 4, 2, 2], Results: [2401], ResultCounts: [1],
            TimeSpend: 240, Proliferator: 3, IconName: 'lighthouse'});
        expect(default_game_data.recipe_data[238]).toMatchObject({原料: {铁块: 3, 棱镜: 4, 电浆激发器: 2, 电路板: 2},
            产物: {全息信标: 1}, 时间: 4, 增产: 3});
    });

    it.each([['制造台 Mk.I', 4 / 3], ['制造台 Mk.II', 1], ['制造台 Mk.III', 2 / 3], ['重组式制造台', 1 / 3]])('calculates 15/min with %s and correct full-load building count', (factory, count) => {
        const result = calculateScenario(api, {needs: {全息信标: 15}, factories: {全息信标: factory}});
        expect(result.production['全息信标']).toBe(15);
        expect(result.buildings['全息信标']).toBeCloseTo(count, 10);
    });

    it.each([[2, 0.8], [1, 0.5]])('uses mode %s without altering the verified recipe', (mode, count) => {
        const result = calculateScenario(api, {needs: {全息信标: 15}, factories: {全息信标: '制造台 Mk.II'},
            proliferation: {全息信标: {增产模式: mode, 增产点数: 4}}});
        expect(result.buildings['全息信标']).toBeCloseTo(count, 10);
        expect(default_game_data.recipe_data[238].原料).toEqual({铁块: 3, 棱镜: 4, 电浆激发器: 2, 电路板: 2});
    });

    it('places Beacon and both shifted buildings in distinct original game slots', () => {
        const layout = buildGamePickerLayout(new GameInfo(default_game_data));
        const buildings = layout.pages.find(page => page.id === '2');
        expect(buildings.slots.get('4:10').item).toBe('全息信标');
        expect(buildings.slots.get('4:11').item).toBe('电磁轨道弹射器');
        expect(buildings.slots.get('4:12').item).toBe('垂直发射井');
        expect(new Set(layout.names).size).toBe(layout.names.length);
        const icon = readFileSync('icon/Vanilla/lighthouse.png');
        expect(icon.readUInt32BE(16)).toBe(80);
        expect(icon.readUInt32BE(20)).toBe(80);
    });

    it('does not claim 0.10.35 support or add the item to old mod profiles', () => {
        expect(vanilla_game_version).toBe('0.10.31.24710');
        expect(vanilla_data_description).toContain('仅原版追加已核验的 v0.10.34 全息信标');
        expect(vanilla_data_description).toContain('尚未完整适配 v0.10.35');
        expect(vanilla.items.some(item => item.ID === 1211)).toBe(false);
        for (const {value} of get_mod_options()) {
            // Void's bundled profile includes MoreMegaStructure, as required by the selector.
            const mods = value === 'com.ckcz123.DSP_Battle' ? ['Gnimaerd.DSP.plugin.MoreMegaStructure', value] : [value];
            expect(new GameInfo(get_game_data(mods)).item_data['全息信标']).toBeUndefined();
        }
    });
});

describe('append-only strategy and plan migration', () => {
    it('adds only new defaults, preserves prior choices/costs, and is idempotent without mutating input', () => {
        const old = oldScheme();
        const before = structuredClone(old);
        const migrated = migrateSchemeForGame(old, default_game_data);
        expectPreserved(migrated, old);
        expect(old).toEqual(before);
        expect(migrated.scheme_for_recipe[238]).toEqual({建筑: 0, 增产点数: 0, 增产模式: 0});
        expect(migrated.item_recipe_choices['全息信标']).toBe(1);
        expect(migrateSchemeForGame(migrated, default_game_data)).toBe(migrated);
    });

    it('refuses unknown lengths, foreign scopes and changed append identities', () => {
        const old = oldScheme();
        for (const game of [{...default_game_data, game_name: 'GenesisBook'}, {...default_game_data, data_revision: 'future'},
            {...default_game_data, recipe_ids: [...default_game_data.recipe_ids.slice(0, 238), 999]}]) {
            expect(migrateSchemeForGame(old, game)).toBe(old);
        }
        old.scheme_for_recipe.pop();
        expect(() => decodeSavedPlan(old, 'scheme', new GameInfo(default_game_data))).toThrow('不匹配');
    });

    it('restores a legacy autosave, archives its exact raw bytes and preserves another game across reload', () => {
        const original = oldScheme();
        const raw = JSON.stringify({Vanilla: original, AnotherGame: {leave: 'alone'}}, null, 2);
        localStorage.setItem('auto_scheme', raw);
        let app = mount();
        expectPreserved(readStore('auto_scheme').Vanilla, original);
        expect(readStore(GAME_DATA_BACKUP_KEY).auto_scheme).toEqual([raw]);
        expect(readStore('auto_scheme').AnotherGame).toEqual({leave: 'alone'});
        app.unmount();
        app = mount();
        expectPreserved(readStore('auto_scheme').Vanilla, original);
        expect(readStore(GAME_DATA_BACKUP_KEY).auto_scheme).toEqual([raw]);
        expect(app.current().warning).toBe('');
    });

    it.each(['scheme', 'needs'])('restores an old named %s with sources and recoverable original content', kind => {
        const original = oldScheme();
        const sources = [{id: 'saved-source', target_item: '铁块', standalone: kind === 'scheme',
            ...(kind === 'needs' ? {scope: 'plan'} : {}), output_per_minute: 10,
            recipe_choice: 1, building: 0, proliferator_mode: 0, proliferator_points: 0}];
        const saved = kind === 'scheme' ? {...original, production_sources: sources} : {
            plan_version: 1, game_name: 'Vanilla', needs_list: {铁块: 60}, scheme_data: original,
            settings: {...baselineSettings, mineralize_list: {}, production_sources: sources},
        };
        const key = kind === 'scheme' ? 'scheme_data' : 'needs_list';
        const raw = JSON.stringify({Vanilla: {legacy: saved}}, null, 2);
        localStorage.setItem(key, raw);
        const app = mount();
        act(() => app.current().load(saved, kind));
        expectPreserved(readStore('auto_scheme').Vanilla, original);
        expect(app.current().state.settings.production_sources).toEqual(sources);
        if (kind === 'needs') {
            expect(app.current().needs).toEqual({铁块: 60});
            expect(readStore('auto_settings').production_sources).toEqual([]);
        }
        expect(localStorage.getItem(key)).toBe(raw);
        expect(localStorage.getItem(GAME_DATA_BACKUP_KEY)).toBeNull();
        act(() => app.current().load(saved, kind));
        expect(localStorage.getItem(GAME_DATA_BACKUP_KEY)).toBeNull();
        // Only an explicit overwrite now needs the recovery archive.
        const replacement = kind === 'scheme' ? {...app.current().state.scheme_data, production_sources: sources}
            : {...saved, scheme_data: app.current().state.scheme_data};
        updateScopedStorage(key, 'Vanilla', current => ({...current, legacy: replacement}));
        expect(readStore(GAME_DATA_BACKUP_KEY)[key]).toEqual([raw]);
        expect(readStore(key).Vanilla.legacy).toEqual(replacement);
    });

    it('rejects corrupt old plans before migration changes the active state or archives them', () => {
        const original = oldScheme();
        original.item_recipe_choices['铁块'] = 999;
        const app = mount();
        const before = localStorage.getItem('auto_scheme');
        expect(() => app.current().load(original, 'scheme')).toThrow('不匹配');
        expect(localStorage.getItem('auto_scheme')).toBe(before);
        expect(localStorage.getItem(GAME_DATA_BACKUP_KEY)).toBeNull();
    });

    it('does not overwrite a legacy autosave when its recovery archive cannot be written', () => {
        const raw = JSON.stringify({Vanilla: oldScheme()});
        localStorage.setItem('auto_scheme', raw);
        const set = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === GAME_DATA_BACKUP_KEY) throw new Error('quota');
            return set.call(this, key, value);
        });
        const app = mount();
        expect(localStorage.getItem('auto_scheme')).toBe(raw);
        expect(app.current().state.scheme_data.scheme_for_recipe).toHaveLength(239);
        expect(app.current().warning).toContain('原始保存数据未被修改');
    });

    it('loads an old preset without writing a backup, but refuses overwrite when archival fails', () => {
        const saved = oldScheme();
        const raw = JSON.stringify({Vanilla: {legacy: saved}});
        localStorage.setItem('scheme_data', raw);
        localStorage.setItem(GAME_DATA_BACKUP_KEY, '{unreadable');
        const app = mount();
        act(() => app.current().load(saved, 'scheme'));
        expectPreserved(app.current().state.scheme_data, saved);
        expect(localStorage.getItem('scheme_data')).toBe(raw);
        expect(() => updateScopedStorage('scheme_data', 'Vanilla', current =>
            ({...current, legacy: app.current().state.scheme_data}))).toThrow('备份无法读取');
        expect(localStorage.getItem('scheme_data')).toBe(raw);
        expect(localStorage.getItem(GAME_DATA_BACKUP_KEY)).toBe('{unreadable');
    });

    it('preserves unknown autosave revisions instead of automatically resetting their data', () => {
        const invalid = oldScheme();
        invalid.scheme_for_recipe.length = 20;
        const raw = JSON.stringify({Vanilla: invalid});
        localStorage.setItem('auto_scheme', raw);
        const app = mount();
        expect(localStorage.getItem('auto_scheme')).toBe(raw);
        expect(app.current().warning).toContain('原始保存数据未被修改');
    });

    it('retains multiple distinct raw archives without duplicating repeated snapshots', () => {
        for (const raw of ['{ "first": 1 }', '{ "first": 2 }', '{ "first": 1 }']) {
            localStorage.setItem('auto_scheme', raw);
            backupGameDataStorage('auto_scheme');
        }
        expect(readStore(GAME_DATA_BACKUP_KEY).auto_scheme).toEqual(['{ "first": 1 }', '{ "first": 2 }']);
    });
});
