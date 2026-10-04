import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider} from '../src/contexts.jsx';
import {Result} from '../src/result.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function Overview({mode}) {
    const [needs, setNeeds] = useState({'铁块': 60});
    const [oreOpen, setOreOpen] = useState(false);
    const [buildingOpen, setBuildingOpen] = useState(false);
    return <TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}>
        <Result needs_list={needs} set_needs_list={setNeeds}
            show_ore_popup={oreOpen} set_show_ore_popup={setOreOpen}
            show_building_popup={buildingOpen} set_show_building_popup={setBuildingOpen}/>
    </CompactModeContext.Provider></ContextProvider></TooltipProvider>;
}

describe('compact production overview', () => {
    it('uses a laptop sidebar, bounded independent scrolling and dense table controls', () => {
        const {container} = render(<Overview mode="compact"/>);
        const result = screen.getByRole('region', {name: '生产总览'});
        expect(result).toHaveAttribute('data-density', 'compact');
        // These are the responsive layout contract; pixel layout is checked in-browser.
        expect(container.querySelector('.dsp-result-layout')).toHaveClass('lg:grid-cols-[minmax(0,1fr)_216px]', 'xl:grid-cols-[minmax(0,1fr)_240px]');
        const summary = screen.getByRole('complementary', {name: '生产统计'});
        expect(summary).toHaveClass('hidden', 'lg:grid', 'max-h-[70dvh]', 'overflow-y-auto');
        expect(within(summary).getByText('预估电力')).toBeInTheDocument();
        expect(within(summary).getByText('原矿输入总需求')).toBeInTheDocument();
        expect(within(summary).getByText('建筑统计')).toBeInTheDocument();
        const scroll = screen.getByRole('region', {name: '生产结果表，可横向滚动'});
        expect(scroll).toHaveAttribute('tabindex', '0');
        expect(scroll).toHaveClass('overflow-auto', 'max-h-[70dvh]');
        expect(scroll.querySelector('thead')).toHaveClass('sticky', 'top-0');
        const amount = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'});
        expect(amount).toHaveValue('60.00');
        expect(amount).toHaveClass('h-6', 'px-1');
        const row = amount.closest('tr');
        expect(row.querySelector('.dsp-item-name')).toHaveClass('sr-only');
        expect(row.querySelector('.dsp-item-name')).toHaveTextContent('铁块');
        expect(within(row).getAllByRole('cell')).toHaveLength(8);
        for (const cell of within(row).getAllByRole('cell')) expect(cell).toHaveClass('px-1.5', 'py-1');
        expect(within(row).getByRole('button', {name: '位面熔炉'})).toHaveClass('min-h-6', 'min-w-6');
    });

    it('retains visible item names and complete recipe details in the wide layout', () => {
        const {container} = render(<Overview mode="full"/>);
        const amount = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'});
        const row = amount.closest('tr');
        expect(row.querySelector('.dsp-item-name')).not.toHaveClass('sr-only');
        expect(within(row).getByRole('group', {name: '铁块配方'})).toBeInTheDocument();
        const recipe = container.querySelector('[title*="铁矿 × 1 → 铁块 × 1"]');
        expect(recipe).toBeInTheDocument();
        expect(recipe.getAttribute('title')).toContain('1s');
        expect(screen.getByRole('columnheader', {name: '工厂类型'})).toBeInTheDocument();
    });

    it('keeps mobile quantities editable and all summaries reachable in dismissible dialogs', async () => {
        const user = userEvent.setup();
        render(<Overview mode="mobile"/>);
        expect(screen.getByText('左右滑动表格，查看配方与生产设置')).toBeInTheDocument();
        expect(screen.getAllByRole('columnheader')).toHaveLength(8);
        const amount = screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'});
        await user.clear(amount);
        await user.type(amount, '120');
        await user.keyboard('{Enter}');
        expect(screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'})).toHaveValue('120.00');
        await user.click(screen.getByRole('button', {name: '建筑与需求', exact: true}));
        const buildingDialog = screen.getByRole('dialog', {name: '建筑与需求'});
        expect(within(buildingDialog).getByText('建筑统计')).toBeInTheDocument();
        expect(within(buildingDialog).getByText('预估电力')).toBeInTheDocument();
        expect(within(buildingDialog).getByText('原矿输入总需求')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '原矿与溢出', exact: true}));
        const oreDialog = screen.getByRole('dialog', {name: '原矿与多余产物'});
        expect(within(oreDialog).getByText('原矿化列表')).toBeInTheDocument();
        expect(within(oreDialog).getByText('多余产物')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'})).toHaveValue('120.00');
    });
});
