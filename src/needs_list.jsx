import {useContext, useEffect, useId, useState} from 'react';
import {Factory, Gem, Plus, PlusSquare, Target, Trash2, X} from 'lucide-react';
import {GlobalStateContext, SettingsSetterContext} from './contexts.jsx';
import {ItemIcon} from './icon.jsx';
import {ItemSelect} from './item_select.jsx';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';
import {Label} from './components/ui/label';
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from './components/ui/dialog';
import {SavedPresets} from './components/saved-presets.jsx';

function isPositiveNumber(value) {
    return String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
}

function NeedRow({item, count, unit, onChange, onRemove}) {
    const id = useId();
    const [draft, setDraft] = useState(String(count));
    useEffect(() => setDraft(String(count)), [count]);
    const valid = isPositiveNumber(draft);

    function update(value) {
        setDraft(value);
        if (isPositiveNumber(value)) onChange(Number(value));
    }

    return <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-background px-3 py-2.5 shadow-xs">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
            <ItemIcon item={item} size={30} tooltip={false}/>
        </span>
        <div className="min-w-0 flex-1">
            <Label htmlFor={id} className="block truncate text-sm font-medium" title={item}>{item}</Label>
            <span className="text-[11px] text-muted-foreground">目标产量 · {unit}</span>
        </div>
        <Input id={id} aria-label={`${item}目标产量`} type="number" inputMode="decimal" min="0" step="any" value={draft}
               aria-invalid={!valid} className="h-9 w-24 shrink-0 text-right tabular-nums sm:w-28"
               onChange={event => update(event.target.value)}
               onBlur={() => { if (!valid) setDraft(String(count)); }}/>
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`移除${item}需求`} title={`移除${item}`} onClick={onRemove}>
            <X className="size-4" aria-hidden="true"/>
        </Button>
    </div>;
}

export function NeedsList({needs_list, set_needs_list, set_show_ore_popup, set_show_building_popup}) {
    const global_state = useContext(GlobalStateContext);
    const set_settings = useContext(SettingsSetterContext);
    const [count, setCount] = useState('60');
    const [error, setError] = useState('');
    const [clearOpen, setClearOpen] = useState(false);
    const countId = useId();
    const unit = global_state.settings.is_time_unit_minute ? '/ min' : '/ sec';
    const validCount = isPositiveNumber(count);
    const entries = Object.entries(needs_list);

    function add_need(item) {
        if (!validCount || !global_state.game_data.recipe_data.some(recipe => Object.hasOwn(recipe.产物, item))) {
            setError('请选择有效物品，并输入大于 0 的有限产量。');
            return false;
        }
        const next = (Number(needs_list[item]) || 0) + Number(count);
        if (!Number.isFinite(next)) {
            setError('产量过大，请输入较小的数值。');
            return false;
        }
        set_needs_list({...needs_list, [item]: next});
        setError('');
    }

    function add_npl(item) {
        if (!validCount) {
            setError('请输入大于 0 的有限产量。');
            return false;
        }
        const lines = (global_state.settings.natural_production_line || []).filter(Boolean);
        set_settings({natural_production_line: [...lines, {
            '目标物品': item, '目标产量': Number(count), '建筑数量': 10,
            '配方id': 1, '增产点数': 0, '增产模式': 0, '建筑': 0,
        }]});
        setError('');
    }

    function remove(item) {
        const next = {...needs_list};
        delete next[item];
        set_needs_list(next);
    }

    return <section className="space-y-4" aria-label="生产目标">
        <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
                <Label htmlFor={countId} className="text-xs text-muted-foreground">目标产量</Label>
                <div className="relative w-32 sm:w-36">
                    <Input id={countId} type="number" min="0" step="any" inputMode="decimal" value={count}
                           aria-invalid={!validCount} aria-describedby={!validCount ? `${countId}-error` : undefined}
                           className="pr-12 tabular-nums" onChange={event => { setCount(event.target.value); setError(''); }}/>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
                </div>
            </div>
            <ItemSelect text="添加需求物品" set_item={add_need} disabled={!validCount} icon={<Plus className="size-4" aria-hidden="true"/>}/>
            <ItemSelect text="添加现有产线" set_item={add_npl} variant="outline" disabled={!validCount}
                        icon={<PlusSquare className="size-4" aria-hidden="true"/>}/>
            <div className="ml-auto flex items-center gap-1">
                {set_show_ore_popup && <Button variant="outline" size="icon" className="xl:hidden" aria-label="查看原矿化列表与多余产物"
                                            title="原矿化列表与多余产物" onClick={() => set_show_ore_popup(true)}><Gem className="size-4"/></Button>}
                {set_show_building_popup && <Button variant="outline" size="icon" className="xl:hidden" aria-label="查看建筑统计与预估电力"
                                                 title="建筑统计与预估电力" onClick={() => set_show_building_popup(true)}><Factory className="size-4"/></Button>}
                {entries.length > 0 && <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                                              onClick={() => setClearOpen(true)}><Trash2 className="size-3.5" aria-hidden="true"/>清空需求</Button>}
            </div>
        </div>
        {!validCount && <p id={`${countId}-error`} role="alert" className="text-xs text-destructive">请输入大于 0 的有效产量后选择物品。</p>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        {entries.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {entries.map(([item, amount]) => <NeedRow key={item} item={item} count={amount} unit={unit}
                onChange={next => set_needs_list({...needs_list, [item]: next})} onRemove={() => remove(item)}/>)}
        </div> : <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/25 px-4 py-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-background"><Target className="size-4 text-muted-foreground" aria-hidden="true"/></span>
            <div>
                <p className="text-sm font-medium">从一个生产目标开始</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">设定每分钟或每秒的目标产量，再添加物品，即可计算完整产线。</p>
            </div>
        </div>}
        <Dialog open={clearOpen} onOpenChange={setClearOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>清空当前需求？</DialogTitle>
                    <DialogDescription>将移除当前的 {entries.length} 项生产目标。已保存的需求列表和现有产线不会被删除。</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setClearOpen(false)}>取消</Button>
                    <Button variant="destructive" onClick={() => { set_needs_list({}); setClearOpen(false); }}>清空需求</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </section>;
}

export function NeedsListStorage({needs_list, set_needs_list}) {
    const global_state = useContext(GlobalStateContext);
    const game_name = global_state.game_data.game_name;

    return <SavedPresets key={game_name} storageKey="needs_list" scope={game_name}
                         label="需求列表" noun="需求列表" value={needs_list} onLoad={set_needs_list}/>;
}
