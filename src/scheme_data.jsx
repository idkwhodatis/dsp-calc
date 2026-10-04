import {useContext} from 'react';
import {GlobalStateContext, SchemeDataSetterContext, SettingsSetterContext} from './contexts.jsx';
import {SavedPresets} from './components/saved-presets.jsx';
import {normalizeSourceIds} from './lib/source-storage.js';

const DEFAULT_SCHEME_DATA = {
    "item_recipe_choices": {"氢": 1},
    "scheme_for_recipe": [{"建筑": 0, "增产点数": 0, "增产模式": 0}],
    // 这是示例,实际上cost_weight之后会在init_scheme_data中重置
    "cost_weight": {
        "占地": 1,
        "电力": 0,
        "建筑成本": {
            "分拣器": 0,
            "制造台": 0,
        },
        "物品额外成本": {
            "单极磁石": {"成本": 10, "启用": 1, "与其它成本累计": 0},
            "铁": {"成本": 1, "启用": 0, "与其它成本累计": 0}
        }
    },
};

function get_item_data(game_data) {
    //通过读取配方表得到配方中涉及的物品信息，item_data中的键名为物品名，键值为
    //此物品在计算器中的id与用于生产此物品的配方在配方表中的序号
    var item_data = {};
    var i = 0;
    for (var num = 0; num < game_data.recipe_data.length; num++) {
        for (var item in game_data.recipe_data[num].产物) {
            if (!(item in item_data)) {
                item_data[item] = [i];
                i++;
            }
            item_data[item].push(num);
        }
    }
    return item_data;
}

export function init_scheme_data(game_data) {
    let scheme_data = structuredClone(DEFAULT_SCHEME_DATA);
    let item_data = get_item_data(game_data);
    scheme_data.item_recipe_choices = {};
    scheme_data.scheme_for_recipe = [];
    scheme_data.cost_weight["占地"] = 1;
    scheme_data.cost_weight["电力"] = 0;
    scheme_data.cost_weight["建筑成本"] = {"分拣器": 0};
    scheme_data.cost_weight["物品额外成本"] = {};
    for (var factory in game_data.factory_data) {
        for (var building_id in game_data.factory_data[factory]) {
            scheme_data.cost_weight["建筑成本"][game_data.factory_data[factory][building_id]["名称"]] = 0;
        }
    }
    for (var item in item_data) {
        scheme_data.cost_weight["物品额外成本"][item] = {
            "成本": 0,
            "启用": 0,
            "与其它成本累计": 0,
            "溢出时处理成本": 0
        };
    }
    for (let item in item_data) {
        scheme_data.item_recipe_choices[item] = 1;
    }
    for (var i = 0; i < game_data.recipe_data.length; i++) {
        scheme_data.scheme_for_recipe.push({"建筑": 0, "增产点数": 0, "增产模式": 0});
    }
    return scheme_data;
}

export function SchemeStorage() {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const set_settings = useContext(SettingsSetterContext);
    const game_name = global_state.game_data.game_name;

    function loadScheme(saved) {
        const {production_sources = [], ...scheme} = saved;
        if (!Array.isArray(production_sources)) throw new Error('方案中的产线来源格式不正确，当前计算未被修改。');
        set_scheme_data(scheme);
        set_settings({production_sources: normalizeSourceIds(production_sources), natural_production_line: []});
    }

    return <SavedPresets key={game_name} storageKey="scheme_data" scope={game_name}
                         label="生产策略" noun="方案" value={{...global_state.scheme_data, production_sources: global_state.settings.production_sources || []}}
                         onLoad={loadScheme}/>;
}
