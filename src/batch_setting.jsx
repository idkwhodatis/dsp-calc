import {useContext, useId} from 'react';
import {GlobalStateContext, SchemeDataSetterContext} from './contexts.jsx';
import {ItemIcon} from './icon.jsx';
import {Button} from './components/ui/button';
import {Checkbox} from './components/ui/checkbox';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from './components/ui/select';

function FactorySelect({factory, list}) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const game_data = global_state.game_data;
    const scheme_data = global_state.scheme_data;
    const first = game_data.recipe_data.findIndex(recipe => recipe['设施'] === Number(factory));
    const current = first >= 0 ? scheme_data.scheme_for_recipe[first]['建筑'] : 0;

    function set_factory(building) {
        const building_name = list[Number(building)]['名称'];
        set_scheme_data(previous => {
            const next = structuredClone(previous);
            game_data.recipe_data.forEach((recipe, index) => {
                const facility_list = game_data.factory_data[recipe['设施']];
                const matched = facility_list.findIndex(entry => entry['名称'] === building_name);
                if (matched !== -1) next.scheme_for_recipe[index]['建筑'] = matched;
            });
            return next;
        });
    }

    return <div className="min-w-0 space-y-1.5">
        <p className="text-[11px] text-muted-foreground">{list[0]['名称']}</p>
        <Select value={String(current)} onValueChange={set_factory}>
            <SelectTrigger className="h-9 min-w-36 gap-2 bg-background text-xs" aria-label={`批量设置${list[0]['名称']}建筑`}>
                <SelectValue/>
            </SelectTrigger>
            <SelectContent>
                {list.map((data, index) => <SelectItem key={data['名称']} value={String(index)}>
                    <span className="flex items-center gap-2"><ItemIcon item={data['名称']} size={22} tooltip={false}/>{data['名称']}</span>
                </SelectItem>)}
            </SelectContent>
        </Select>
    </div>;
}

export function BatchSetting() {
    const pileSorterId = useId();
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const {game_data, scheme_data, proliferator_price} = global_state;
    const first = scheme_data.scheme_for_recipe[0];
    const pro_num = first?.['增产点数'] ?? 0;
    const pro_mode = first?.['增产模式'] ?? 0;
    const names = Object.fromEntries(game_data.proliferator_data.map(data => [data['增产点数'], data['增产点数'] === 0 ? '无' : data['名称']]));
    const proliferators = game_data.proliferator_effect
        .map((_effect, index) => index)
        .filter(index => proliferator_price[index] !== -1);
    const factories = Object.entries(game_data.factory_data).filter(([factory, list]) =>
        list.length >= 2 && game_data.recipe_data.filter(recipe => recipe['设施'] === Number(factory)).length >= 3);

    function change_pro_num(points) {
        set_scheme_data(previous => {
            const next = structuredClone(previous);
            next.scheme_for_recipe.forEach(recipe => { recipe['增产点数'] = points; });
            return next;
        });
    }

    function change_pro_mode(mode) {
        set_scheme_data(previous => {
            const next = structuredClone(previous);
            game_data.recipe_data.forEach((recipe, index) => {
                if (mode !== 0 && !(mode & recipe['增产'])) return;
                next.scheme_for_recipe[index]['增产模式'] = mode;
            });
            return next;
        });
    }

    return <section aria-label="批量预设">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">增产剂</p>
                <div className="flex min-h-9 flex-wrap items-center gap-1" role="group" aria-label="批量设置增产点数">
                    {proliferators.map(points => <Button key={points} size="sm" variant={pro_num === points ? 'secondary' : 'outline'}
                        className={`h-9 min-w-9 gap-1.5 px-2 ${pro_num === points ? 'ring-1 ring-border' : 'bg-background'}`}
                        aria-pressed={pro_num === points} aria-label={names[points] || `${points} 点增产`} title={names[points] || `${points} 点增产`}
                        onClick={() => change_pro_num(points)}>
                        {points !== 0 && names[points] ? <ItemIcon item={names[points]} size={23} tooltip={false}/> : <span className="text-xs">{points === 0 ? '无' : points}</span>}
                    </Button>)}
                </div>
            </div>
            <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">增产模式</p>
                <div className="flex gap-1" role="group" aria-label="批量设置增产模式">
                    {['无', '加速', '增产'].map((label, mode) => <Button key={mode} size="sm" variant={pro_mode === mode ? 'secondary' : 'outline'}
                        className={`h-9 px-3 text-xs ${pro_mode === mode ? 'ring-1 ring-border' : 'bg-background'}`}
                        aria-pressed={pro_mode === mode} onClick={() => change_pro_mode(mode)}>{label}</Button>)}
                </div>
            </div>
            {factories.map(([factory, list]) => <FactorySelect key={factory} factory={factory} list={list}/>)}
        </div>
        <div className="mt-4 space-y-1.5 border-t pt-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm" htmlFor={pileSorterId}>
                <Checkbox id={pileSorterId} checked={scheme_data.use_pile_sorter === true}
                    aria-describedby={`${pileSorterId}-description`}
                    onCheckedChange={checked => set_scheme_data(previous => ({...previous, use_pile_sorter: checked === true}))}/>
                使用集装分拣器（满级科技）
            </label>
            <p id={`${pileSorterId}-description`} className="text-xs text-muted-foreground">按集装分拣器改良 6、理想 4 层出料估算；仅影响物流参考，不改变产量或建筑数量</p>
        </div>
    </section>;
}
