import {useContext, useMemo, useState, useEffect} from 'react';
import {CompactModeContext, GlobalStateContext, SchemeDataSetterContext, SettingsSetterContext} from './contexts';
import {ItemIcon} from './icon';
import {NplRows} from './natural_production_line';
import {describeRecipe, HorizontalMultiButtonSelect, Recipe} from './recipe';
import {AutoSizedInput} from './ui_components/auto_sized_input.jsx';
import {Button} from './components/ui/button';
import {Badge} from './components/ui/badge';
import {Card, CardContent, CardHeader, CardTitle} from './components/ui/card';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from './components/ui/dialog';
import {Tooltip, TooltipContent, TooltipTrigger} from './components/ui/tooltip';
import {cn} from './lib/utils';

const ValueWithDifference = ({currentValue, previousValue}) => {
    const global_state = useContext(GlobalStateContext);
    const fixedNum = global_state.settings.fixed_num;
    // 如果没有上一次的值或者值相同，则只显示当前值
    if (previousValue === undefined || Math.abs(currentValue - previousValue) < 1e-6) {
        return <>
            {currentValue.toFixed(fixedNum)}
        </>;
    }

    // 计算差值
    const diff = currentValue - previousValue;
    const diffSign = diff > 0 ? '+' : '';


    return (
        <>
            {currentValue.toFixed(fixedNum)}
            <span className={cn("ml-1 align-sub text-xs", diff > 0 ? "text-rose-500" : "text-emerald-600")}>
                {diffSign}{diff.toFixed(fixedNum)}
            </span>
        </>
    );
};

export function RecipeSelect({item, choice, onChange, compact}) {
    const global_state = useContext(GlobalStateContext);
    const {game_data, item_data} = global_state;
    if (item_data[item].length === 2) {
        return <div className="px-1 py-1.5"><Recipe recipe={game_data.recipe_data[item_data[item][1]]} compact={compact}/></div>;
    }
    return <div className="dsp-recipe-options flex w-fit max-w-80 flex-col gap-0.5 rounded-md border bg-muted/30 p-0.5" role="group" aria-label={`${item}配方`}>
        {item_data[item].slice(1).map((recipe_index, index) => {
            const value = index + 1;
            return <Button key={recipe_index} type="button" variant="ghost" size="sm"
                aria-label={`${item}配方 ${value}`} aria-description={describeRecipe(game_data.recipe_data[recipe_index])} aria-pressed={choice == value}
                className={cn("h-auto min-h-8 justify-start rounded-md px-1 py-1.5", choice == value && "bg-background shadow-sm ring-1 ring-border hover:bg-background")}
                onClick={() => onChange(value)}>
                <Recipe recipe={game_data.recipe_data[recipe_index]} compact={compact}/>
            </Button>;
        })}
    </div>;
}

function RatioAdjustInput({value, fixed_num, needs_list, set_needs_list, label}) {
    const disp_value = value.toFixed(fixed_num);
    const base_value = +disp_value;
    function set_needs_in_row(e_or_value) {
        if (base_value != 0) {
            const new_value = e_or_value.target ? e_or_value.target.value : e_or_value;
            const new_needs_list = {};
            for (const item in needs_list) {
                new_needs_list[item] = needs_list[item] * new_value / base_value;
            }
            set_needs_list(new_needs_list);
        }
    }
    return <Tooltip>
        <TooltipTrigger asChild>
            <span className="inline-flex">
                <AutoSizedInput delayed value={disp_value} onChange={set_needs_in_row} aria-label={label}/>
            </span>
        </TooltipTrigger>
        <TooltipContent>等比例调整所有需求</TooltipContent>
    </Tooltip>;
}

export function ProNumSelect({choice, onChange, icon_size}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_num_text = {};
    for (let i = 0; i < game_data.proliferator_data.length; i++) {
        pro_num_text[game_data.proliferator_data[i]["增产点数"]] = game_data.proliferator_data[i]["名称"];
    }
    let pro_num_options = [];
    for (let i = 0; i < game_data.proliferator_effect.length; i++) {
        if (i == 0) {
            continue;
        } else if (global_state.proliferator_price[i] != -1)
            pro_num_options.push({value: i, item_icon: pro_num_text[i]});

    }

    return <HorizontalMultiButtonSelect choice={choice} options={pro_num_options} onChange={onChange}
                                        icon_size={icon_size} optionType={"proNumSelect"}/>;
}

export const pro_mode_class = {
    [1]: "pro-mode-speedup",
    [2]: "pro-mode-extra-products"
}

export function ProModeSelect({recipe_id, choice, onChange}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    let pro_modes = {[0]: "无"};
    //如果是增产塔，只能选择增产分馏
    if (game_data.recipe_data[recipe_id]["增产"] & (1 << 3)) {
        pro_modes = {};
    }
    ["加速", "增产", "接收站透镜喷涂", "增产分馏"].forEach((e, i) => {
        if (game_data.recipe_data[recipe_id]["增产"] & (1 << i)) pro_modes[i + 1] = e
    })
    let options = Object.entries(pro_modes).map(([value, label]) => (
        {value: value, label: label, className: pro_mode_class[value]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange}
                                        className={"raw-text-selection [&>button]:text-base"}/>;
}

export function FactorySelect({recipe_id, choice, onChange, no_gap, icon_size}) {
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;

    let factory_kind = game_data.recipe_data[recipe_id]["设施"];
    let factory_list = game_data.factory_data[factory_kind];

    let options = factory_list.map((factory_data, idx) => (
        {value: idx, item_icon: factory_data["名称"]}
    ));

    return <HorizontalMultiButtonSelect choice={choice} options={options} onChange={onChange}
                                        no_gap={no_gap} icon_size={icon_size}/>;
}
// 简易的对象相等性检查函数
const isEqual = (obj1, obj2) => {
    if (!obj1 || !obj2) return obj1 === obj2;

    // 比较能源成本
    if (Math.abs(obj1.energyCost - obj2.energyCost) > 1e-6 ||
        Math.abs(obj1.totalEnergyCost - obj2.totalEnergyCost) > 1e-6) {
        return false;
    }

    // 比较建筑数量
    const buildings1 = Object.keys(obj1.buildingCounts);
    const buildings2 = Object.keys(obj2.buildingCounts);

    if (buildings1.length !== buildings2.length) {
        return false;
    }

    for (const building of buildings1) {
        if (obj1.buildingCounts[building] !== obj2.buildingCounts[building]) {
            return false;
        }
    }

    // 比较原矿材料
    const materials1 = Object.keys(obj1.rawMaterials);
    const materials2 = Object.keys(obj2.rawMaterials);

    if (materials1.length !== materials2.length) {
        return false;
    }

    for (const material of materials1) {
        if (Math.abs(obj1.rawMaterials[material] - (obj2.rawMaterials[material] || 0)) > 1e-6) {
            return false;
        }
    }

    return true;
};

export function Result({needs_list, set_needs_list, show_ore_popup, set_show_ore_popup, show_building_popup, set_show_building_popup}) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const set_settings = useContext(SettingsSetterContext);
    const compact_mode = useContext(CompactModeContext);
    const is_compact = compact_mode !== "full";
    const is_mobile = compact_mode === "mobile";

    const mob_btn_icon = is_mobile ? 18 : 32; // 表格内按钮图标
    let game_data = global_state.game_data;
    let scheme_data = global_state.scheme_data;
    let settings = global_state.settings;
    let item_data = global_state.item_data;
    let item_graph = global_state.item_graph;
    let time_tick = settings.is_time_unit_minute ? 60 : 1;

    // TODO refactor to a simple list
    let mineralize_list = settings.mineralize_list;
    let natural_production_line = settings.natural_production_line;

    const [result_dict, lp_surplus_list] = useMemo(() => {
        const res = global_state.calculate(needs_list);
        return res;
    }, [global_state, needs_list]);

    // 用于存储历史值的数组，最多保留两个版本
    const [historyValues, setHistoryValues] = useState([]);

    let fixed_num = settings.fixed_num;
    let energy_cost = 0, miner_energy_cost = 0;
    let building_list = {};

    function get_factory_number(amount, item) {
        const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
        const scheme_recipe = scheme_data.scheme_for_recipe[recipe_id];
        const factories_type = game_data.recipe_data[recipe_id]["设施"];
        const factory_info = game_data.factory_data[factories_type][scheme_recipe["建筑"]];
        const factory_name = factory_info["名称"];
        const factory_per_yield = 1 / item_graph[item]["产出倍率"] / factory_info["倍率"];
        const offset = 0.49994 * 0.1 ** fixed_num;//未显示的部分进一法取整
        const build_number = amount / time_tick * factory_per_yield + offset;
        if (Math.ceil(build_number - 0.5 * 0.1 ** fixed_num) !== 0) {
            if (factory_name in building_list) {
                building_list[factory_name] = Number(building_list[factory_name]) + Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
            } else {
                building_list[factory_name] = Math.ceil(build_number - 0.5 * 0.1 ** fixed_num);
            }
        }
        if (factory_name !== "轨道采集器") {
            let e_cost = (build_number - offset) * factory_info["耗能"];
            if (factory_name === "大型采矿机") {
                e_cost = settings.mining_efficiency_large / 100.0 * settings.mining_efficiency_large / 100.0 * (2.94 - 0.168) + 0.168;
            } else if (factory_name.endsWith("分馏塔")) {
                if (game_data.mods.GenesisBookEnable) {
                    if (settings.fractionating_speed > 60) {
                        e_cost *= (settings.fractionating_speed * 0.036 - 0.72) / 1.44;
                    }
                } else {
                    if (settings.fractionating_speed > 30) {
                        e_cost *= (settings.fractionating_speed * 0.036 - 0.36) / 0.72;
                    }
                }
            }
            if (scheme_recipe["增产模式"] != 0 && scheme_recipe["增产点数"] != 0) {
                e_cost *= game_data.proliferator_effect[scheme_recipe["增产点数"]]["耗电倍率"];
            }
            if (factory_name === "采矿机" || factory_name === "大型采矿机"
                || factory_name === "抽水机" || factory_name === "聚束液体汲取设施" || factory_name === "原油萃取站") {
                miner_energy_cost += e_cost;
            } else {
                energy_cost += e_cost;
            }
        }
        return build_number;
    }

    function get_gross_output(amount, item) {
        var offset = 0;
        offset = 0.49994 * 0.1 ** fixed_num;//未显示的部分进一法取整
        if (item_graph[item]["自消耗"]) {
            return Number(amount * (1 + item_graph[item]["自消耗"])) + offset;
        }
        return Number(amount) + offset;
    }

    // Dict<item, Dict<from, quantity>>
    let side_products = {};
    Object.entries(result_dict).forEach(([item, item_count]) => {
        Object.entries(item_graph[item]["副产物"]).forEach(([side_product, amount]) => {
            side_products[side_product] = side_products[side_product] || {};
            side_products[side_product][item] = item_count * amount;
        });
    })

    function mineralize(item) {
        let new_mineralize_list = structuredClone(mineralize_list);
        new_mineralize_list[item] = structuredClone(item_graph[item]);
        // editing item_graph!
        item_graph[item]["原料"] = {};

        set_settings({"mineralize_list": new_mineralize_list});
    }

    function unmineralize(item) {
        let new_mineralize_list = structuredClone(mineralize_list);
        // editing item_graph!
        item_graph[item] = structuredClone(mineralize_list[item]);
        delete new_mineralize_list[item];
        set_settings({"mineralize_list": new_mineralize_list});
    }

    function clear_mineralize_list() {
        for (let item in mineralize_list) {
            // editing item_graph!
            item_graph[item] = structuredClone(mineralize_list[item]);
        }
        set_settings({"mineralize_list": {}});
    }

    let mineralize_doms = Object.keys(mineralize_list).map(item => (
        <Button key={item} type="button" variant="outline" size="sm" className="h-auto gap-1 px-1.5 py-1" aria-label={`恢复${item}生产`} onClick={() => unmineralize(item)}>
            <ItemIcon item={item} size={is_mobile ? 24 : 40}/><span className="text-sm">{item}</span><span aria-hidden="true" className="text-muted-foreground">×</span>
        </Button>
    ));

    let result_table_rows = [];
    for (let i in result_dict) {
        side_products[i] = side_products[i] || {};
        let total = result_dict[i] + Object.values(side_products[i]).reduce((a, b) => a + b, 0);
        if (total < 1e-6) continue;
        let recipe_id = item_data[i][scheme_data.item_recipe_choices[i]];
        if (settings.hide_mines && ((i in mineralize_list) || Object.keys(game_data.recipe_data[recipe_id]["原料"]).length < 1)) {
            continue;
        }
        let factory_number = get_factory_number(result_dict[i], i);
        let from_side_products = Object.entries(side_products[i]).map(([from, amount]) =>
            <div key={from} className="mt-1 flex items-center justify-end gap-0.5 whitespace-nowrap text-sm text-muted-foreground">+{amount.toFixed(fixed_num)} (<ItemIcon item={from} size={is_mobile ? 18 : 26}/>)
            </div>
        );
        let factory_name = game_data.factory_data[game_data.recipe_data[recipe_id]["设施"]][scheme_data.scheme_for_recipe[recipe_id]["建筑"]]["名称"];
        let is_mineralized = i in mineralize_list;
        let row_class = is_mineralized ? "bg-muted/60" : "";

        const change_recipe = (value) => {
            set_scheme_data(old_scheme_data => {
                let scheme_data = structuredClone(old_scheme_data);
                scheme_data.item_recipe_choices[i] = value;
                return scheme_data;
            })
        };

        const change_pro_num = (value) => {
            set_scheme_data(old_scheme_data => {
                let scheme_data = structuredClone(old_scheme_data);
                scheme_data.scheme_for_recipe[recipe_id]["增产点数"] = value;
                return scheme_data;
            })
        };

        const change_pro_mode = (value) => {
            set_scheme_data(old_scheme_data => {
                let scheme_data = structuredClone(old_scheme_data);
                scheme_data.scheme_for_recipe[recipe_id]["增产模式"] = value;
                return scheme_data;
            })
        };

        const change_factory = (value) => {
            set_scheme_data(old_scheme_data => {
                let scheme_data = structuredClone(old_scheme_data);
                scheme_data.scheme_for_recipe[recipe_id]["建筑"] = value;
                return scheme_data;
            })
        };

        const ratioProps = {fixed_num, needs_list, set_needs_list};
        result_table_rows.push(<tr className={cn("border-b last:border-0 transition-colors hover:bg-muted/40", row_class)} key={i}>
            <td className="px-2 py-3">
                <Button type="button" variant="ghost" size="sm" className="h-7 whitespace-nowrap px-1 text-sm text-muted-foreground"
                    aria-label={is_mineralized ? `恢复${i}生产` : `将${i}视为原矿`}
                    onClick={() => is_mineralized ? unmineralize(i) : mineralize(i)}>
                    {is_mineralized ? '恢复' : '原矿化'}
                </Button>
            </td>
            <td className="px-2 py-3">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <ItemIcon item={i} tooltip={is_compact} size={is_mobile ? 24 : 40}/>
                    <span className={cn("dsp-item-name text-sm font-medium", is_compact && "sr-only")}>{i}</span>
                </div>
            </td>
            <td className="px-2 py-3 text-right">
                <RatioAdjustInput value={get_gross_output(result_dict[i], i)} {...ratioProps} label={`${i}产能，等比例调整需求`}/>
                {from_side_products}
            </td>
            <td className="px-2 py-3 whitespace-nowrap">
                {!is_mineralized ? <div className="inline-flex items-center gap-1">
                    <ItemIcon item={factory_name} size={is_mobile ? 20 : 30}/>
                    <RatioAdjustInput value={factory_number} {...ratioProps} label={`${i}工厂数量，等比例调整需求`}/>
                </div> : <span className="text-muted-foreground">—</span>}
            </td>
            <td className="px-2 py-3"><RecipeSelect item={i} onChange={change_recipe} choice={scheme_data.item_recipe_choices[i]} compact={compact_mode}/></td>
            <td className="px-2 py-3"><ProModeSelect recipe_id={recipe_id} onChange={change_pro_mode} choice={scheme_data.scheme_for_recipe[recipe_id]["增产模式"]}/></td>
            <td className="px-2 py-3"><ProNumSelect onChange={change_pro_num} choice={scheme_data.scheme_for_recipe[recipe_id]["增产点数"]} icon_size={mob_btn_icon}/></td>
            <td className="px-2 py-3"><FactorySelect recipe_id={recipe_id} onChange={change_factory} choice={scheme_data.scheme_for_recipe[recipe_id]["建筑"]} icon_size={mob_btn_icon}/></td>
        </tr>);
    }

    for (let NPId in natural_production_line) {
        let recipe = game_data.recipe_data[item_data[natural_production_line[NPId]["目标物品"]][natural_production_line[NPId]["配方id"]]];
        let factory_info = game_data.factory_data[recipe["设施"]][natural_production_line[NPId]["建筑"]];
        const factory_name = factory_info["名称"];
        if (factory_name in building_list) {
            building_list[factory_name] = Number(building_list[factory_name]) + Math.ceil(natural_production_line[NPId]["建筑数量"]);
        } else {
            building_list[factory_name] = Math.ceil(natural_production_line[NPId]["建筑数量"]);
        }
        if (factory_name !== "轨道采集器") {
            let e_cost = natural_production_line[NPId]["建筑数量"] * factory_info["耗能"];
            if (natural_production_line[NPId]["增产点数"] != 0 && natural_production_line[NPId]["增产模式"] != 0) {
                e_cost *= game_data.proliferator_effect[natural_production_line[NPId]["增产点数"]]["耗电倍率"];
            }
            if (factory_name === "采矿机" || factory_name === "大型采矿机"
                || factory_name === "抽水机" || factory_name === "聚束液体汲取设施" || factory_name === "原油萃取站") {
                miner_energy_cost += e_cost;
            } else {
                energy_cost += e_cost;
            }
        }
    }

    const building_rows = Object.entries(building_list).map(([building, count]) => (
        <tr key={building} className="border-b last:border-0">
            <td className="py-2"><span className="flex items-center gap-1.5 text-sm"><ItemIcon item={building} tooltip={false} size={is_mobile ? 26 : 40}/>{building}</span></td>
            <td className="py-2 pl-2 text-right text-base whitespace-nowrap tabular-nums">
                <ValueWithDifference currentValue={count} previousValue={historyValues?.[1]?.buildingCounts?.[building]}/>
            </td>
        </tr>));

    function IncreaseCostWhenSurplus(item) {
        set_scheme_data(old_scheme_data => {
            let scheme_data = structuredClone(old_scheme_data);
            scheme_data.cost_weight["物品额外成本"][item]["溢出时处理成本"] += 5000;
            return scheme_data;
        })
    }

    const surplus_doms = Object.entries(lp_surplus_list).map(([item, quant]) =>
        <div key={item} className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-1.5 py-2">
            <ItemIcon item={item} size={is_mobile ? 28 : 40}/>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item}</p><p className="text-sm tabular-nums text-muted-foreground">{quant.toFixed(fixed_num)} / {time_tick === 60 ? 'min' : 's'}</p></div>
            <Button type="button" variant="outline" size="sm" className="h-8 px-1.5 text-sm" aria-label={`避免${item}溢出`} onClick={() => IncreaseCostWhenSurplus(item)}>避免溢出</Button>
        </div>);

    const isRawMaterial = (item) => {
        // 判断物品是否为原矿：1. 在原矿化列表中，或 2. 配方没有输入需求且输出产物只有一种
        if (item in mineralize_list) return true;
        try {
            const recipe_id = item_data[item][scheme_data.item_recipe_choices[item]];
            const recipe = game_data.recipe_data[recipe_id];
            // 检查配方是否没有输入需求且输出产物只有一种
            const hasNoInputs = Object.keys(recipe["原料"]).length === 0;
            const hasSingleOutput = Object.keys(recipe["产物"]).length === 1;
            return hasNoInputs && hasSingleOutput;
        } catch {
            return false;
        }
    };

    // 计算数值变化的差值
    // 更新历史值
    useEffect(() => {
        // 构建新的值对象
        const currentValues = {
            energyCost: energy_cost,
            totalEnergyCost: energy_cost + miner_energy_cost,
            buildingCounts: { ...building_list },
            rawMaterials: {}
        };

        Object.entries(result_dict).forEach(([item, amount]) => {
            if (isRawMaterial(item)) {
                currentValues.rawMaterials[item] = amount;
            }
        });

        // 如果historyValues为空或者第一个元素与当前值不同，则更新
        if (historyValues.length === 0 || !isEqual(historyValues[0], currentValues)) {
            // 将当前值添加到数组开头，最多保留两个版本
            const newHistory = [currentValues, ...historyValues].slice(0, 2);
            setHistoryValues(newHistory);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result_dict, energy_cost, miner_energy_cost, building_list]);

    const rawMaterials = Object.entries(result_dict).filter(([item]) => isRawMaterial(item));
    const totalBuildings = Object.values(building_list).reduce((sum, count) => sum + count, 0);
    const unit = time_tick === 60 ? 'min' : 's';
    const rawMaterialCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="px-3 pt-4 pb-2"><CardTitle className="text-base">原矿输入总需求</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3">
            {rawMaterials.length > 0 ? <table className="w-auto"><tbody>
                {rawMaterials.map(([item, amount]) => <tr key={item} className="border-b last:border-0">
                    <td className="py-2"><span className="flex items-center gap-1.5 text-sm"><ItemIcon item={item} tooltip={false} size={is_mobile ? 26 : 40}/>{item}</span></td>
                    <td className="py-2 pl-2 text-right text-base whitespace-nowrap tabular-nums">
                        <ValueWithDifference currentValue={amount} previousValue={historyValues?.[1]?.rawMaterials?.[item]}/><span className="ml-0.5 text-muted-foreground">/{unit}</span>
                    </td>
                </tr>)}
            </tbody></table> : <p className="py-2 text-sm text-muted-foreground">暂无原矿需求</p>}
        </CardContent>
    </Card>;
    const buildingCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 pt-4 pb-2"><CardTitle className="text-base">建筑统计</CardTitle><Badge variant="secondary" className="px-1.5 py-0.5 text-sm tabular-nums">{totalBuildings}</Badge></CardHeader>
        <CardContent className="px-3 pb-3">
            {building_rows.length > 0 ? <table className="w-auto"><tbody>{building_rows}</tbody></table> : <p className="py-2 text-sm text-muted-foreground">暂无建筑需求</p>}
        </CardContent>
    </Card>;
    const energyCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="px-3 pt-4 pb-3"><CardTitle className="text-base">预估电力</CardTitle></CardHeader>
        <CardContent className="space-y-2 px-3 pb-4">
            <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">生产设施</span><span className="text-base tabular-nums"><ValueWithDifference currentValue={energy_cost} previousValue={historyValues?.[1]?.energyCost}/> MW</span></div>
            <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">含采集设备</span><span className="text-base font-medium tabular-nums"><ValueWithDifference currentValue={energy_cost + miner_energy_cost} previousValue={historyValues?.[1]?.totalEnergyCost}/> MW</span></div>
        </CardContent>
    </Card>;
    const mineralizedCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 pt-4 pb-3"><CardTitle className="text-base">原矿化列表</CardTitle>
            {mineralize_doms.length > 0 && <Button type="button" variant="ghost" size="sm" className="h-7 px-1 text-sm text-muted-foreground" onClick={clear_mineralize_list}>清空</Button>}
        </CardHeader>
        <CardContent className="px-3 pb-4">{mineralize_doms.length > 0 ? <div className="flex flex-wrap gap-1.5">{mineralize_doms}</div> : <p className="text-sm text-muted-foreground">将物品视为原矿，直接从生产链外部供给</p>}</CardContent>
    </Card>;
    const surplusCard = <Card className="dsp-summary-card gap-0 rounded-lg py-0 shadow-none">
        <CardHeader className="px-3 pt-4 pb-3"><CardTitle className="text-base">多余产物</CardTitle></CardHeader>
        <CardContent className="space-y-2 px-3 pb-4">{surplus_doms.length > 0 ? surplus_doms : <p className="text-sm text-muted-foreground">没有多余产物</p>}</CardContent>
    </Card>;

    return <section className="dsp-result w-fit max-w-full space-y-4" data-density="comfortable" aria-labelledby="production-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
                <p className="mb-1 text-xs tracking-wider text-muted-foreground uppercase">Production overview</p>
                <div className="flex items-center gap-2"><h2 id="production-heading" className="text-xl font-semibold tracking-tight">生产总览</h2>
                    <Badge variant="secondary" className="px-1.5 py-0.5 text-sm font-normal">{result_table_rows.length} 项物品 · 每{time_tick === 60 ? '分钟' : '秒'}</Badge>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-sm" onClick={() => set_show_ore_popup(true)}>原矿与溢出</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-sm" onClick={() => set_show_building_popup(true)}>建筑与需求</Button>
            </div>
        </div>
        <div className="dsp-result-layout flex max-w-full items-start gap-4">
            <Card className="dsp-result-table-card w-fit min-w-0 max-w-full flex-[0_1_auto] gap-0 overflow-hidden rounded-lg py-0 shadow-none">
                <p className="border-b bg-muted/20 px-2 py-2 text-sm text-muted-foreground lg:hidden">左右滑动表格，查看配方与生产设置</p>
                <div className="dsp-result-table-scroll max-h-[70dvh] max-w-full overflow-auto" tabIndex={0} role="region" aria-label="生产结果表，可横向滚动">
                    <table className="dsp-production-table w-auto border-collapse text-base [&_td]:align-middle">
                        <caption className="sr-only">生产链计算结果：产能、工厂、配方和增产设置</caption>
                        <thead className="sticky top-0 z-10 border-b bg-muted shadow-[0_1px_0_var(--border)]">
                            <tr className="text-left text-base whitespace-nowrap text-muted-foreground">
                                <th scope="col" className="px-2 py-3 font-medium">操作</th><th scope="col" className="px-2 py-3 font-medium">物品</th>
                                <th scope="col" className="px-2 py-3 text-right font-medium">产能 / {unit}</th><th scope="col" className="px-2 py-3 font-medium">工厂数量</th>
                                <th scope="col" className="px-2 py-3 font-medium">配方选取</th><th scope="col" className="px-2 py-3 font-medium">增产模式</th>
                                <th scope="col" className="px-2 py-3 font-medium">增产剂</th><th scope="col" className="px-2 py-3 font-medium">工厂类型</th>
                            </tr>
                        </thead>
                        <tbody><NplRows/>{result_table_rows}
                            {result_table_rows.length === 0 && natural_production_line.length === 0 && <tr><td colSpan={8} className="px-4 py-20 text-center">
                                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border bg-muted/40 text-lg text-muted-foreground" aria-hidden="true">＋</div>
                                <p className="text-sm font-medium">开始规划你的生产线</p><p className="mt-1.5 text-sm text-muted-foreground">添加目标物品与需求数量，查看完整的生产链与建筑需求</p>
                            </td></tr>}
                        </tbody>
                    </table>
                </div>
            </Card>
            <aside className="dsp-result-summary hidden max-h-[70dvh] w-max max-w-80 shrink-0 content-start gap-3 overflow-y-auto lg:grid" aria-label="生产统计">
                {energyCard}{rawMaterialCard}{buildingCard}
                {mineralize_doms.length > 0 && mineralizedCard}
                {surplus_doms.length > 0 && surplusCard}
            </aside>
        </div>
        <Dialog open={show_ore_popup} onOpenChange={set_show_ore_popup}>
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>原矿与多余产物</DialogTitle><DialogDescription>管理外部供给，调整多余产物的处理成本</DialogDescription></DialogHeader>
                <div className="space-y-3">{mineralizedCard}{surplusCard}</div>
            </DialogContent>
        </Dialog>
        <Dialog open={show_building_popup} onOpenChange={set_show_building_popup}>
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>建筑与需求</DialogTitle><DialogDescription>原矿需求、建筑数量与预估电力。角标表示与上次计算的差值</DialogDescription></DialogHeader>
                <div className="space-y-3">{energyCard}{rawMaterialCard}{buildingCard}</div>
            </DialogContent>
        </Dialog>
    </section>;
}
