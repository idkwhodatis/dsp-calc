import {useContext} from 'react';
import {CompactModeContext, GameInfoContext, GlobalStateContext, SettingsContext, SettingsSetterContext} from './contexts.jsx';
import {ApplyBuildingMultiplier} from './global_state.jsx';
import {ItemIcon} from './icon';
import {ItemSelect} from './item_select.jsx';
import {FactorySelect, ProModeSelect, ProNumSelect, RecipeSelect} from './result.jsx';
import {AutoSizedInput} from './ui_components/auto_sized_input.jsx';
import {Button} from './components/ui/button';
import {Badge} from './components/ui/badge';

// { "目标物品": "氢", "建筑数量": 0, "配方id": 1, "增产点数": 0, "增产模式": 0, "建筑": 0 }

function NplRow({row, set_row, remove_row}) {
    // TODO performance issue (dependency loop?)
    const settings = useContext(SettingsContext);
    const game_info = useContext(GameInfoContext);
    const global_state = useContext(GlobalStateContext);
    const compact_mode = useContext(CompactModeContext);
    let game_data = global_state.game_data;

    function set_row_prop(prop, is_number) {
        return function (e_or_value) {
            // Either an event [e] or a raw [value] is supported
            let value = e_or_value.target ? e_or_value.target.value : e_or_value;
            let row_new = structuredClone(row);
            if (is_number) {
                row_new[prop] = Number(value) || 0;
            } else {
                row_new[prop] = value;
            }
            set_row(row_new);
        }
    }

    function set_item(item) {
        let row_new = structuredClone(row);
        row_new["目标物品"] = item;
        row_new["配方id"] = 1;
        set_row(row_new);
    }

    function get_output_num(item, recipe, building_scale, pro_mode, pro_num, building_name) {
        let output_num = recipe["产物"][item];
        output_num *= building_scale;
        output_num *= (settings.is_time_unit_minute ? 60 : 1) / recipe["时间"];
        let proliferator_data = game_data.proliferator_effect[Number(pro_num)];
        if (pro_mode == 2) {
            output_num *= proliferator_data["增产效果"];
        } else if (pro_mode == 1 || pro_mode == 3) {
            output_num *= proliferator_data["加速效果"];
        }
        
        // 根据建筑类型应用相应的倍率
        output_num = ApplyBuildingMultiplier(output_num, building_name, item, settings);
        
        return output_num;
    }

    let item = row["目标物品"];
    let recipe_id = game_info.item_data[item][row["配方id"]];
    let recipe = game_data.recipe_data[recipe_id];
    let selected_building = game_data.factory_data[recipe["设施"]][row["建筑"]];
    let output_num = get_output_num(item, recipe, row["建筑数量"] * selected_building["倍率"], row["增产模式"], row["增产点数"], selected_building["名称"]);
    return <tr className="border-b bg-muted/40 transition-colors hover:bg-muted/60">
        <td className="px-1.5 py-1"><Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-[11px] text-muted-foreground hover:text-destructive" aria-label={`删除${item}自然产线`} onClick={remove_row}>删除</Button></td>
        <td className="px-1.5 py-1"><div className="flex items-center gap-1"><ItemSelect item={item} set_item={set_item} className="h-7 gap-1 px-1.5 text-xs"/><Badge variant="secondary" className="px-1 py-0 text-[9px] font-normal whitespace-nowrap">自然产线</Badge></div></td>
        <td className="px-1.5 py-1 text-right text-xs whitespace-nowrap tabular-nums">{output_num}</td>
        <td className="px-1.5 py-1"><div className="flex items-center gap-1">
            <ItemIcon item={selected_building["名称"]} size={20}/><span className="text-xs text-muted-foreground">×</span>
            <AutoSizedInput value={row["建筑数量"]} onChange={set_row_prop("建筑数量", true)} aria-label={`${item}自然产线建筑数量`}/>
        </div></td>
        <td className="px-1.5 py-1"><RecipeSelect item={item} choice={row["配方id"]} onChange={set_row_prop("配方id", true)} compact={compact_mode}/></td>
        <td className="px-1.5 py-1"><ProModeSelect recipe_id={recipe_id} choice={row["增产模式"]} onChange={set_row_prop("增产模式", true)}/></td>
        <td className="px-1.5 py-1"><ProNumSelect choice={row["增产点数"]} onChange={set_row_prop("增产点数", true)}/></td>
        <td className="px-1.5 py-1"><FactorySelect recipe_id={recipe_id} choice={row["建筑"]} onChange={set_row_prop("建筑", true)}/></td>
    </tr>;

}

export function NplRows() {
    const settings = useContext(SettingsContext);
    const set_settings = useContext(SettingsSetterContext);

    const npl = settings.natural_production_line;

    function set_npl(new_npl) {
        set_settings({"natural_production_line": new_npl});
    }

    let rows = npl.map((npl_row, idx_row) => {
        function set_row(row) {
            let new_npl = structuredClone(npl);
            new_npl[idx_row] = row;
            set_npl(new_npl);
        }

        function remove_row() {
            let new_npl = structuredClone(npl);
            new_npl.splice(idx_row, 1);
            set_npl(new_npl);
        }

        return <NplRow key={idx_row} row={npl_row} set_row={set_row} remove_row={remove_row}/>;
    });

    return <>{rows}</>;
}
