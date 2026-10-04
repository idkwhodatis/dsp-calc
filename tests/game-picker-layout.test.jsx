import '@testing-library/jest-dom/vitest';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {buildGamePickerLayout, decodeGameGridIndex} from '../src/lib/game-picker-layout.js';
import {get_game_data, MoreMegaStructureGUID, TheyComeFromVoidGUID, GenesisBookGUID, FractionateEverythingGUID} from '../src/GameData.jsx';
import {GameInfo} from '../src/global_state.jsx';
import {ItemSelect} from '../src/item_select.jsx';
import {CompactModeContext, GameInfoContext, GlobalStateContext} from '../src/contexts.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

const datasets = import.meta.glob('../data/*.json', {import: 'default', eager: true});
const modGuids = {MoreMegaStructure: MoreMegaStructureGUID, TheyComeFromVoid: TheyComeFromVoidGUID,
    GenesisBook: GenesisBookGUID, FractionateEverything: FractionateEverythingGUID};
const cases = Object.entries(datasets).map(([path, data]) => ({
    name: path.split('/').pop().replace('.json', ''), data,
    mods: path.split('/').pop().replace('.json', '').split('_').map(name => modGuids[name]).filter(Boolean),
}));

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('native game picker coordinates', () => {
    it('decodes native pages rather than the old flattened, normalized icon grid', () => {
        expect(decodeGameGridIndex(1201)).toEqual({page: 1, row: 2, col: 1});
        expect(decodeGameGridIndex(2201)).toEqual({page: 2, row: 2, col: 1});
        expect(decodeGameGridIndex(6716)).toEqual({page: 6, row: 7, col: 16});
        for (const invalid of [-1, 0, 201, 1000, 1001, 1100, 1.5, NaN, Infinity, '1201']) {
            expect(decodeGameGridIndex(invalid)).toBeNull();
        }
    });

    it.each(cases)('retains every target and exact page geometry in $name', ({data, mods}) => {
        const info = new GameInfo(get_game_data(mods));
        const layout = buildGamePickerLayout(info);
        const rawTargets = new Set(data.recipes.flatMap(recipe => recipe.Results));
        const expectedNames = data.items.filter(item => rawTargets.has(item.ID)).map(item => item.Name);
        expect(layout.names.slice().sort()).toEqual(expectedNames.slice().sort());
        expect(new Set(layout.names).size).toBe(layout.names.length);
        expect(layout.names.slice().sort()).toEqual(info.all_target_items.slice().sort());
        expect(layout.pages.slice(0, 2).map(page => page.label)).toEqual(['物品', '建筑']);
        expect(layout.columns).toBe(Math.max(...data.items.map(item => decodeGameGridIndex(item.GridIndex)?.col ?? 0)));
        for (const raw of data.items) {
            if (!rawTargets.has(raw.ID)) continue;
            const position = decodeGameGridIndex(raw.GridIndex);
            const page = layout.pages.find(page => page.entries.some(entry => entry.item === raw.Name));
            expect(page, raw.Name).toBeDefined();
            if (!position) {
                expect(page.id).toBe('other');
                continue;
            }
            expect(page.id, raw.Name).toBe(String(position.page));
            expect(page.entries.find(entry => entry.item === raw.Name)).toMatchObject(position);
        }
        for (const page of layout.pages.filter(page => page.id !== 'other')) {
            const rawPage = data.items.map(item => decodeGameGridIndex(item.GridIndex)).filter(position => String(position?.page) === page.id);
            expect(page.rows).toBe(Math.max(0, ...rawPage.map(position => position.row)));
            expect(page.cells).toHaveLength(page.rows * layout.columns);
            expect(page.cells.filter(cell => cell.entry)).toHaveLength(page.entries.length);
            expect(new Set(page.entries.map(entry => `${entry.row}:${entry.col}`)).size).toBe(page.entries.length);
        }
    });

    it('keeps vanilla 8 item rows and 5 building rows without moving category exceptions', () => {
        const layout = buildGamePickerLayout(new GameInfo(get_game_data([])));
        const [items, buildings] = layout.pages;
        expect(layout.columns).toBe(14);
        expect(items.rows).toBe(8);
        expect(buildings.rows).toBe(5);
        expect(items.entries.find(entry => entry.item === '铁块')).toMatchObject({row: 2, col: 1});
        expect(items.entries.find(entry => entry.item === '地基')).toMatchObject({row: 7, col: 6});
        expect(items.entries.find(entry => entry.item === '物流运输机')).toMatchObject({row: 7, col: 2});
        expect(items.entries.find(entry => entry.item === '宇宙矩阵')).toMatchObject({row: 8, col: 6});
        expect(buildings.entries.find(entry => entry.item === '蓄电器（满）')).toMatchObject({row: 1, col: 11});
        expect(buildings.entries.find(entry => entry.item === '传送带')).toMatchObject({row: 2, col: 1});
        expect(buildings.entries.find(entry => entry.item === '高斯机枪塔')).toMatchObject({row: 5, col: 1});
    });

    it('preserves whole blank rows and mixed native mod pages rather than guessing building categories', () => {
        const layout = buildGamePickerLayout(new GameInfo(get_game_data([GenesisBookGUID])));
        const nuclear = layout.pages.find(page => page.id === '3');
        const combat = layout.pages.find(page => page.id === '5');
        expect(layout.columns).toBe(17);
        expect(layout.pages[0].rows).toBe(7);
        expect(nuclear.rows).toBe(7);
        for (const row of [1, 2, 5, 6]) {
            const cells = nuclear.cells.filter(cell => cell.row === row);
            expect(cells).toHaveLength(17);
            expect(cells.every(cell => !cell.entry)).toBe(true);
        }
        expect(nuclear.entries.find(entry => entry.item === '液氢燃料棒')).toMatchObject({row: 7, col: 2});
        expect(combat.entries.some(entry => entry.item === '高斯机枪塔')).toBe(true);
        expect(combat.entries.some(entry => entry.item === '机枪弹箱')).toBe(true);
        expect(layout.pages[1].entries.some(entry => entry.item === '高斯机枪塔')).toBe(false);
    });

    it('retains invalid, missing and colliding targets once in a neutral fallback', () => {
        const info = {
            all_target_items: ['铁块', '铜块', '缺少格位', '负值', '无效列', '无效行', '传送带', '铁块'],
            game_data: {item_grid: {'铁块': 1201, '铜块': 1201, '负值': -1, '无效列': 1100, '无效行': 1001, '传送带': 2201, '非目标': 1805}},
            icon_grid: {nrow: 100, ncol: 100, icons: [{item: '铁块', row: 99, col: 99}]},
        };
        const before = structuredClone(info);
        const layout = buildGamePickerLayout(info);
        expect(layout.columns).toBe(5);
        expect(layout.pages[0].rows).toBe(8);
        expect(layout.pages[0].entries).toEqual([{item: '铁块', page: 1, row: 2, col: 1}]);
        expect(layout.pages.find(page => page.id === 'other').entries.map(entry => entry.item)).toEqual(['铜块', '缺少格位', '负值', '无效列', '无效行']);
        expect(layout.names.slice().sort()).toEqual([...new Set(info.all_target_items)].sort());
        expect(info).toEqual(before);
    });

    it('supports old normalized grid consumers without guessing page boundaries', () => {
        const layout = buildGamePickerLayout({all_target_items: ['铁块', '氢'], icon_grid: {
            ncol: 5, nrow: 15, icons: [{item: '铁块', row: 12, col: 4}, {item: '铁块', row: 13, col: 4}],
        }});
        expect(layout.pages[0]).toMatchObject({rows: 15, columns: 5});
        expect(layout.pages[0].entries).toEqual([{item: '铁块', page: 1, row: 12, col: 4}]);
        expect(layout.pages.find(page => page.id === 'other').entries).toEqual([{item: '氢'}]);
    });
});

const smallInfo = {
    all_target_items: ['铁块', '传送带', '氢', '机枪弹箱'],
    game_data: {item_grid: {'铁块': 1201, '传送带': 2201, '氢': -1, '机枪弹箱': 3304, '空位边界': 1805}},
};

async function openPicker({item, info = smallInfo, onSelect = vi.fn()} = {}) {
    const user = userEvent.setup();
    render(<CompactModeContext.Provider value="full"><GameInfoContext.Provider value={info}>
        <GlobalStateContext.Provider value={{game_data: {mods: []}}}><TooltipProvider delayDuration={0}>
            <ItemSelect text="添加需求物品" item={item} set_item={onSelect}/>
        </TooltipProvider></GlobalStateContext.Provider>
    </GameInfoContext.Provider></CompactModeContext.Provider>);
    await user.click(screen.getByRole('button', {name: /^添加需求物品/}));
    return {user, onSelect, dialog: screen.getByRole('dialog', {name: '选择物品'})};
}

describe('game picker tabs and search state', () => {
    it('uses accessible shadcn tabs with arrow, Home and End keyboard navigation', async () => {
        const {user, dialog} = await openPicker();
        const items = within(dialog).getByRole('tab', {name: '物品', exact: true});
        const buildings = within(dialog).getByRole('tab', {name: '建筑', exact: true});
        const other = within(dialog).getByRole('tab', {name: '其它', exact: true});
        expect(within(dialog).getByRole('tablist', {name: '游戏物品分页'})).toHaveAttribute('data-slot', 'tabs-list');
        expect(items).toHaveAttribute('aria-selected', 'true');
        await user.click(items);
        await user.keyboard('{ArrowRight}');
        await waitFor(() => expect(buildings).toHaveAttribute('aria-selected', 'true'));
        expect(buildings).toHaveFocus();
        expect(within(dialog).getByRole('tabpanel', {name: '建筑'})).toBeInTheDocument();
        expect(within(dialog).getByRole('button', {name: '选择传送带'})).toHaveStyle({gridColumn: '1', gridRow: '2'});
        expect(within(dialog).queryByRole('button', {name: '选择铁块'})).not.toBeInTheDocument();
        await user.keyboard('{End}');
        await waitFor(() => expect(other).toHaveAttribute('aria-selected', 'true'));
        expect(within(dialog).getByRole('button', {name: '选择氢'})).toBeInTheDocument();
        await user.keyboard('{Home}');
        await waitFor(() => expect(items).toHaveAttribute('aria-selected', 'true'));
    });

    it('searches every native and fallback page then restores the current fixed tab on clear', async () => {
        const {user, dialog} = await openPicker();
        const buildings = within(dialog).getByRole('tab', {name: '建筑', exact: true});
        await user.click(buildings);
        const search = within(dialog).getByRole('searchbox');
        for (const [query, target] of [['tiekuai', '铁块'], ['qing', '氢'], ['jqdx', '机枪弹箱']]) {
            await user.type(search, query);
            expect(within(dialog).getByRole('button', {name: `选择${target}`})).toHaveTextContent(target);
            expect(within(dialog).getByRole('tabpanel', {name: '所有分页搜索结果'})).toBeInTheDocument();
            expect(buildings).toHaveAttribute('aria-selected', 'true');
            await user.click(within(dialog).getByRole('button', {name: '清除搜索'}));
            expect(search).toHaveFocus();
            expect(within(dialog).getByRole('group', {name: '建筑固定位置网格'})).toBeInTheDocument();
            expect(within(dialog).getByRole('button', {name: '选择传送带'})).toHaveStyle({gridColumn: '1', gridRow: '2'});
        }
        await user.type(search, '铁块');
        await user.click(within(dialog).getByRole('tab', {name: '模组 3'}));
        expect(search).toHaveValue('');
        expect(within(dialog).getByRole('button', {name: '选择机枪弹箱'})).toHaveStyle({gridColumn: '4', gridRow: '3'});
    });

    it('opens on the selected item’s native page and preserves tabs through dismissed searches', async () => {
        const {user, dialog} = await openPicker({item: '传送带'});
        expect(within(dialog).getByRole('tab', {name: '建筑', exact: true})).toHaveAttribute('aria-selected', 'true');
        expect(within(dialog).getByRole('button', {name: '选择传送带'})).toHaveAttribute('aria-pressed', 'true');
        await user.type(within(dialog).getByRole('searchbox'), 'tk');
        await user.keyboard('{Escape}');
        const trigger = screen.getByRole('button', {name: '添加需求物品：传送带'});
        expect(trigger).toHaveFocus();
        await user.click(trigger);
        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(screen.getByRole('tab', {name: '建筑', exact: true})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', {name: '选择传送带'})).toHaveStyle({gridColumn: '1', gridRow: '2'});
    });

    it('does not select or close during IME composition, including legacy 229 key events', async () => {
        const {dialog, onSelect} = await openPicker();
        const search = within(dialog).getByRole('searchbox');
        fireEvent.compositionStart(search);
        fireEvent.change(search, {target: {value: '铁块'}});
        fireEvent.keyDown(search, {key: 'Enter'});
        expect(onSelect).not.toHaveBeenCalled();
        fireEvent.compositionEnd(search);
        fireEvent.keyDown(search, {key: 'Enter', keyCode: 229});
        expect(onSelect).not.toHaveBeenCalled();
        fireEvent.keyDown(search, {key: 'Enter'});
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('铁块');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
