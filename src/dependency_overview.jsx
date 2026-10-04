import {useContext, useId, useState} from 'react';
import {CompactModeContext} from './contexts.jsx';
import {ItemIcon} from './icon.jsx';
import {Button} from './components/ui/button';

const MAX_VISIBLE_ROWS = 200;
const CELL_CLASS = 'px-2 py-3';

function formatRate(value, settings) {
    if (!Number.isFinite(value)) return '—';
    const precision = Number(settings.fixed_num);
    const digits = Number.isInteger(precision) ? Math.min(100, Math.max(0, precision)) : 2;
    return value.toFixed(digits);
}

function ItemCell({node, expanded, onToggle, iconSize}) {
    const depth = Math.max(0, Number(node.depth) || 0);
    const indent = Math.min(depth * 8, 40);
    return <td className={`dsp-dependency-item relative ${CELL_CLASS}`}>
        {depth > 0 && <span aria-hidden="true" className="dsp-dependency-guides pointer-events-none absolute inset-y-0 left-2"
            style={{width: indent, backgroundImage: 'repeating-linear-gradient(to right, transparent 0px, transparent 7px, var(--border) 7px, var(--border) 8px)'}}>
            <span className="absolute top-1/2 border-t border-border" style={{left: indent - 8, width: 8}}/>
        </span>}
        <div className="dsp-dependency-item-content relative flex w-max items-center gap-1.5" style={{paddingInlineStart: indent}}>
            {node.children?.length > 0 ? <Button type="button" variant="ghost" className="h-8 w-7 shrink-0 px-0 text-base"
                aria-label={`${expanded ? '收起' : '展开'}${node.item}的上游原料`} aria-expanded={expanded} onClick={onToggle}>
                <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            </Button> : <span aria-hidden="true" className="inline-block w-7 shrink-0"/>}
            <ItemIcon item={node.item} size={iconSize} tooltip={false}/>
            <span className="whitespace-nowrap text-base font-medium">{node.item}</span>
            <span className="sr-only">第 {depth + 1} 层</span>
        </div>
    </td>;
}

function GlobalLink({node, canonical, onShowGlobal}) {
    if (!canonical?.hasCanonicalRow || !onShowGlobal) return <span className="text-muted-foreground">—</span>;
    return <Button type="button" variant="link" className="h-auto min-h-8 px-0 py-1 text-base"
        aria-label={`查看${node.item}全局产线`} onClick={() => onShowGlobal(node.item)}>查看全局产线</Button>;
}

const REASONS = {
    cycle: '循环引用，查看全局供给',
    mineralized: '外部供给（原矿化）',
    raw: '原矿输入',
    'missing-supply': '缺少供给',
    'unknown-item': '未知物品',
    'invalid-source': '来源配置无效',
    'node-limit': '上游条目已达到显示上限',
    'depth-limit': '上游层级已达到显示上限',
    'invalid-flow': '本支用量无法可靠计算',
};
const BOUNDARIES = {
    'manual-supply': '现有产线供给',
    'byproduct-supply': '副产物供给',
    'external-supply': '外部供给',
    overproduction: '全局存在溢出',
    'missing-supply': '全局供给不足',
    'invalid-source': '来源配置无效',
};

function sourceLabel(source, canonical, sources) {
    if (source.kind === 'automatic') return '需求产线';
    const manualIds = (canonical.sourceIds || []).filter(id => sources[id]?.kind === 'manual');
    const ordinal = manualIds.indexOf(source.id) + 1;
    return ordinal > 0 ? `现有产线 ${ordinal}` : '全局供给';
}

function NodeNotes({node, canonical, viewModel, settings, unit}) {
    const source = viewModel.sources?.[node.sourceId];
    const sourceRows = canonical?.hasCanonicalGroup
        ? (canonical.sourceIds || []).map(id => viewModel.sources[id]).filter(Boolean) : [];
    const reason = node.reason === 'global-supply'
        ? `${node.boundaryReasons.map(value => BOUNDARIES[value]).filter(Boolean).join('、') || '多路供给'}；${node.scope === 'global' ? '引用全局供给，未指定来源分配' : '引用全局供给，未分配给本支'}`
        : REASONS[node.reason];
    return <div className="dsp-dependency-notes max-w-80 space-y-1 text-base text-muted-foreground">
        {node.scope === 'global' && <p>{node.kind === 'supply' ? '全局产出' : '全局投入'}{source && canonical?.hasCanonicalGroup ? ` · ${sourceLabel(source, canonical, viewModel.sources)}` : ''}</p>}
        {reason && <p>{reason}</p>}
        {node.shared && node.scope === 'branch' && node.reason !== 'cycle' && <p>共享物料，仅列本支需求</p>}
        {sourceRows.length > 0 && <p className="dsp-dependency-source-summary">全局：{sourceRows.map((line, index) => <span key={line.id}>
            {index > 0 && '；'}{sourceLabel(line, canonical, viewModel.sources)} {formatRate(line.outputRate, settings)} / {unit}
        </span>)}</p>}
        {canonical?.surplusRate > 0 && <p>全局溢出 {formatRate(canonical.surplusRate, settings)} / {unit}（非本支需求）</p>}
        {node.omittedInputs?.length > 0 && <p>未展开原料：{node.omittedInputs.map(input => input.item).join('、')}；可查看全局产线</p>}
        {!reason && !sourceRows.length && !node.shared && node.scope === 'branch' && <p>按本支需求展开</p>}
    </div>;
}

/** Only visits expanded occurrences; neither saved data nor the projection is changed. */
function visibleRows(roots, expanded) {
    const result = [];
    const stack = [...roots].reverse();
    while (stack.length) {
        const node = stack.pop();
        result.push(node);
        if (expanded.has(node.id)) {
            for (let index = (node.children?.length || 0) - 1; index >= 0; index--) stack.push(node.children[index]);
        }
    }
    return result;
}

function DependencyTable({roots, global, viewModel, settings, unit, expanded, onToggle, onShowGlobal, iconSize, tableId}) {
    const [page, setPage] = useState(0);
    const rows = visibleRows(roots, expanded);
    const pages = Math.max(1, Math.ceil(rows.length / MAX_VISIBLE_ROWS));
    const currentPage = Math.min(page, pages - 1);
    const shown = rows.slice(currentPage * MAX_VISIBLE_ROWS, (currentPage + 1) * MAX_VISIBLE_ROWS);
    const label = global ? '全局供给与投入' : '目标依赖';
    return <div className="dsp-dependency-table-card w-fit min-w-0 max-w-full overflow-hidden rounded-lg border">
        <div className="dsp-dependency-table-scroll max-h-[70dvh] max-w-full overflow-auto overscroll-x-contain focus-visible:outline-2"
            role="region" aria-label={`${label}表，可横向滚动`} tabIndex={0}>
            <table id={tableId} className="dsp-dependency-table w-auto border-collapse text-base [&_td]:align-middle">
                <caption className="sr-only">{global ? '全局产线与投入，已计入全局计算，不是新增需求' : '目标依赖只读视图，本支需求不是全局生产量'}</caption>
                <thead className="sticky top-0 z-10 border-b bg-muted shadow-[0_1px_0_var(--border)]">
                    <tr className="text-left whitespace-nowrap text-muted-foreground">
                        <th scope="col" className={`${CELL_CLASS} font-medium`}>物品</th>
                        <th scope="col" className={`${CELL_CLASS} text-right font-medium`}>{global ? '全局数量' : '本支需求'} / {unit}</th>
                        <th scope="col" className={`${CELL_CLASS} font-medium`}>说明 / 全局引用</th>
                        <th scope="col" className={`${CELL_CLASS} font-medium`}>全局产线</th>
                    </tr>
                </thead>
                <tbody>{shown.map(node => {
                    const canonical = viewModel.items?.[node.item];
                    const rateLabel = node.scope === 'global' ? node.kind === 'supply' ? '全局产出' : '全局投入' : '本支需求';
                    return <tr key={node.id} id={`${tableId}-${encodeURIComponent(node.id)}`} data-node-id={node.id} data-depth={node.depth}
                        data-scope={node.scope} className="dsp-dependency-row border-b last:border-0 hover:bg-muted/40">
                        <ItemCell node={node} expanded={expanded.has(node.id)} onToggle={() => onToggle(node.id)} iconSize={iconSize}/>
                        <td className={`${CELL_CLASS} text-right whitespace-nowrap tabular-nums`}>
                            <output aria-label={`${node.item}${rateLabel}`}>{formatRate(node.scope === 'global' ? node.globalRate : node.branchRate, settings)}</output>
                        </td>
                        <td className={CELL_CLASS}><NodeNotes node={node} canonical={canonical} viewModel={viewModel} settings={settings} unit={unit}/></td>
                        <td className={`${CELL_CLASS} whitespace-nowrap`}><GlobalLink node={node} canonical={canonical} onShowGlobal={onShowGlobal}/></td>
                    </tr>;
                })}</tbody>
            </table>
        </div>
        {pages > 1 && <nav className="flex items-center gap-3 border-t px-2 py-3 text-base" aria-label={`${label}分页`}>
            <Button type="button" variant="outline" className="px-2 text-base" disabled={currentPage === 0} aria-controls={tableId}
                onClick={() => setPage(currentPage - 1)}>上一页</Button>
            <span className="tabular-nums" aria-live="polite">第 {currentPage + 1} / {pages} 页 · 共 {rows.length} 行</span>
            <Button type="button" variant="outline" className="px-2 text-base" disabled={currentPage === pages - 1} aria-controls={tableId}
                onClick={() => setPage(currentPage + 1)}>下一页</Button>
        </nav>}
    </div>;
}

/** Compact, read-only navigation over the calculation's dependency projection. */
export function DependencyOverview({viewModel, settings, onShowGlobal}) {
    const compactMode = useContext(CompactModeContext);
    const prefix = useId();
    const [expanded, setExpanded] = useState(() => new Set((viewModel.roots || []).filter(root => root.children?.length).map(root => root.id)));
    const unit = settings.is_time_unit_minute ? 'min' : 's';
    const roots = viewModel.roots || [];
    const supplyRoots = viewModel.supplyRoots || [];
    function toggle(id) {
        setExpanded(previous => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }
    const props = {viewModel, settings, unit, expanded, onToggle: toggle, onShowGlobal, iconSize: compactMode === 'mobile' ? 24 : 40};
    return <section className="dsp-dependency-overview w-fit min-w-0 max-w-full flex-[0_1_auto] space-y-4 p-2 text-base" aria-label="依赖树只读视图">
        <p className="max-w-prose text-base text-muted-foreground">本支需求只表示当前分支的原料需求；共享物料可在不同分支出现，请勿相加作为全局生产量</p>
        {roots.length > 0 ? <DependencyTable {...props} roots={roots} tableId={`${prefix}-demand`}/>
            : <p className="rounded-lg border px-3 py-4 text-base text-muted-foreground">添加正数目标需求后可查看依赖树</p>}
        {supplyRoots.length > 0 && <section className="w-fit min-w-0 max-w-full space-y-2" aria-labelledby={`${prefix}-supply-heading`}>
            <h3 id={`${prefix}-supply-heading`} className="text-base font-semibold">全局供给与投入</h3>
            <p className="max-w-prose text-base text-muted-foreground">以下产线及其投入已计入全局总量，不是新增目标需求；不要与本支需求相加</p>
            <DependencyTable {...props} roots={supplyRoots} global tableId={`${prefix}-supply`}/>
        </section>}
        {viewModel.limits?.truncated && <p role="status" aria-label="依赖显示限制" className="max-w-prose text-base text-muted-foreground">部分上游已达到显示上限；省略处已标记，可通过全局产线查看实际供给</p>}
        {viewModel.warnings?.includes('legacy-source-details-unavailable') && <p role="status" className="max-w-prose text-base text-muted-foreground">旧版现有产线缺少投入明细，请到平铺视图检查全局供给</p>}
    </section>;
}
