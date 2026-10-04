import {useContext} from 'react';
import {GlobalStateContext} from './contexts.jsx';
import {ItemIcon} from './icon';
import {FactorySelect, ProModeSelect, ProNumSelect, RecipeSelect} from './result.jsx';
import {AutoSizedInput} from './ui_components/auto_sized_input.jsx';
import {Button} from './components/ui/button';
import {Badge} from './components/ui/badge';
import {cn} from './lib/utils';
import {toDisplayRate} from './production_sources.js';

/** Saved demand-bound allocations remain available without creating phantom rows. */
export function PausedProductionSources({sources, onEnable, onRemove}) {
    const {settings} = useContext(GlobalStateContext);
    if (!sources?.length) return null;
    const unit = settings.is_time_unit_minute ? 'min' : 's';
    return <details className="dsp-paused-sources rounded-lg border bg-muted/20 px-3 py-2 text-base">
        <summary className="cursor-pointer rounded-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
            已暂停{sources.length}条未被当前需求使用的来源
        </summary>
        <div className="mt-3 space-y-2">
            <p className="text-base text-muted-foreground">配方与分配产量已保留；再次需要该物品时自动恢复，也可作为独立产线启用</p>
            <ul className="space-y-2">
                {sources.map((source, index) => <li key={source.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border bg-background px-2 py-2"
                    aria-label={`已暂停来源 ${index + 1} ${source.target_item}`}>
                    <span className="inline-flex items-center gap-2"><ItemIcon item={source.target_item} size={24}/>
                        <span>{source.target_item} · {toDisplayRate(source.output_per_minute, settings).toFixed(settings.fixed_num)} / {unit}</span>
                    </span>
                    <span className="inline-flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="text-base" onClick={() => onEnable(source.id)}>作为独立产线启用</Button>
                        <Button type="button" variant="ghost" size="sm" className="text-base text-muted-foreground hover:text-destructive"
                            aria-label={`删除已暂停来源 ${index + 1} ${source.target_item}`} onClick={() => onRemove(source.id)}>删除</Button>
                    </span>
                </li>)}
            </ul>
        </div>
    </details>;
}

/** A production source owns its own recipe and equipment, but stays in its product group. */
export function ProductionSourceCard({item, source, automatic, ordinal, output, buildings, factory_name,
    recipe_choice, recipe_id, building, proliferator_mode, proliferator_points,
    onOutputChange, onRecipeChange, onFactoryChange, onModeChange, onPointsChange, onRemove,
    is_mineralized = false}) {
    const {settings, game_data, item_data} = useContext(GlobalStateContext);
    const knownItem = Object.hasOwn(item_data, item);
    const displayRecipeId = recipe_id ?? (knownItem ? item_data[item]?.[recipe_choice] ?? item_data[item]?.[1] : undefined);
    const validRecipe = Boolean(knownItem && game_data.recipe_data[displayRecipeId]);
    const fixed = settings.fixed_num;
    const unit = settings.is_time_unit_minute ? 'min' : 's';
    const label = automatic ? '需求产线' : `现有产线 ${ordinal}`;
    const name = `${item}${label}`;

    // Each field is a column in one source strip. Only recipes and error text may
    // wrap within their own field; additional sources stay beside this one.
    return <article className={cn('dsp-source-card dsp-source-strip grid w-max shrink-0 grid-cols-[repeat(8,max-content)] items-start gap-x-5 gap-y-3 rounded-lg border bg-background px-3 py-4 text-base', automatic && 'bg-muted/20')}
        aria-label={name} data-source-id={automatic ? `auto:${item}` : source.id} data-source-kind={automatic ? 'automatic' : 'manual'}>
        <div data-source-field="identity" className="space-y-1.5 whitespace-nowrap">
            <h3 className="font-medium">{label}</h3>
            <div className="flex min-h-12 items-center">
                <Badge variant={automatic ? 'secondary' : 'outline'} className="px-1.5 py-0.5 text-base font-normal">{automatic ? '补足剩余' : '独立分配'}</Badge>
            </div>
        </div>
        <div data-source-field="output" className="space-y-1.5 whitespace-nowrap">
            <p className="text-base text-muted-foreground">{automatic ? '自动承担' : '分配产量'}</p>
            <div className="flex min-h-12 items-center gap-1.5 tabular-nums">
                {automatic ? <output aria-label={`${name}产量`} className="text-base font-semibold">{(output || 0).toFixed(fixed)}</output>
                    : <AutoSizedInput delayed value={(output || 0).toFixed(fixed)} onChange={onOutputChange} aria-label={`${name}分配产量`}/>}
                <span className="text-base text-muted-foreground">/ {unit}</span>
            </div>
        </div>
        <div data-source-field="buildings" className="space-y-1.5 whitespace-nowrap">
            <p className="text-base text-muted-foreground">工厂数量</p>
            <div className="flex min-h-12 items-center gap-1.5 tabular-nums">
                {is_mineralized ? <span className="text-muted-foreground">外部供给</span> : <>
                    {factory_name && <ItemIcon item={factory_name} size={30}/>}
                    <output aria-label={`${name}工厂数量`} className="text-base">{(buildings || 0).toFixed(fixed)}</output>
                </>}
            </div>
        </div>
        {validRecipe && <><div data-source-field="recipe" className="space-y-1.5"><p className="text-base text-muted-foreground">配方选取</p>
            <RecipeSelect item={item} choice={recipe_choice} onChange={onRecipeChange} compact="full"/>
        </div>
        <div data-source-field="mode" className="space-y-1.5"><p className="text-base text-muted-foreground">增产模式</p>
            <ProModeSelect recipe_id={displayRecipeId} choice={proliferator_mode} onChange={onModeChange}/>
        </div>
        <div data-source-field="proliferator" className="space-y-1.5"><p className="text-base text-muted-foreground">增产剂</p>
            <ProNumSelect icon_size={32} choice={proliferator_points} onChange={onPointsChange}/>
        </div>
        <div data-source-field="factory" className="space-y-1.5"><p className="text-base text-muted-foreground">工厂类型</p>
            <FactorySelect icon_size={32} recipe_id={displayRecipeId} choice={building} onChange={onFactoryChange}/>
        </div></>}
        {!automatic && <div data-source-field="remove" className="space-y-1.5">
            <p className="text-base text-muted-foreground">操作</p>
            <div className="flex min-h-12 items-center"><Button type="button" variant="ghost" size="sm" className="h-8 px-1.5 text-base text-muted-foreground hover:text-destructive"
                aria-label={`删除${name}`} onClick={onRemove}>删除</Button></div>
        </div>}
        {source?.error && <p role="alert" className="col-span-full max-w-5xl whitespace-normal break-words text-base text-destructive">{source.error}</p>}
    </article>;
}

export function ProductionSourceGroup({item, group, totalControl, onAdd, mineralizeControl, children}) {
    const {settings} = useContext(GlobalStateContext);
    const fixed = settings.fixed_num;
    const unit = settings.is_time_unit_minute ? 'min' : 's';
    const produced = group.automatic + group.allocated + (group.byproduct_supply || 0);

    return <section id={`production-sources-${item}`} tabIndex={-1} aria-label={`${item}生产来源`} className="dsp-source-group w-[min(49rem,calc(100vw-3rem))] min-w-0 max-w-full scroll-mt-20 space-y-3 py-1 text-base">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center gap-2"><ItemIcon item={item} size={40} tooltip={false}/><h3 className="text-base font-semibold">{item}</h3></div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-base text-muted-foreground">总需求</span>{totalControl}<span className="text-base text-muted-foreground">/ {unit}</span></div>
            </div>
            <div className="flex items-center gap-2">{mineralizeControl}<Button type="button" variant="outline" size="sm" className="h-9 px-2 text-base"
                aria-label={`添加${item}产线`} onClick={onAdd}>＋ 添加产线</Button></div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted-foreground">
            <span aria-label={`${item}合计生产`}>合计生产 {produced.toFixed(fixed)} / {unit}</span>
            {(group.byproduct_supply || 0) > 1e-6 && <span>含副产物供给 {group.byproduct_supply.toFixed(fixed)} / {unit}</span>}
            {group.surplus > 1e-6 && <span role="status" className="font-medium text-amber-700 dark:text-amber-400">超额分配 / 多余产物 {group.surplus.toFixed(fixed)} / {unit}{group.automatic < 1e-6 ? '，需求产线已降至 0' : ''}</span>}
        </div>
        <div role="region" aria-label={`${item}产线，可横向滚动`} tabIndex={0}
            className="dsp-source-cards flex min-w-0 max-w-full flex-nowrap items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-2 focus-visible:outline-ring">
            {children}
        </div>
    </section>;
}
