import {createContext, useEffect, useState, useMemo} from 'react';
import {GameInfo, GlobalState} from './global_state';
import {init_scheme_data} from './scheme_data';
import {default_game_data, get_game_data, get_mod_options, MoreMegaStructureGUID, TheyComeFromVoidGUID} from "./GameData.jsx";
import {getStorageSnapshot, readStorageObject} from "./lib/storage.js";


/** set_game_name_and_data(game_name, game_data) */
export const GameInfoSetterContext = createContext(null);
export const SchemeDataSetterContext = createContext(null);
/** set_settings({prop: value}) */
export const SettingsSetterContext = createContext(null);
export const GlobalStateContext = createContext(null);
export const SettingsContext = createContext(null);
export const StorageWarningContext = createContext("");
export const GameInfoContext = createContext(null);

const DEFAULT_SETTINGS = {
    mining_speed_oil: 3.0,
    mining_speed_hydrogen: 1.0,
    mining_speed_deuterium: 0.05,
    mining_speed_gas_hydrate: 0.8,
    mining_speed_helium: 0.02,
    mining_speed_ammonia: 0.3,
    mining_speed_nitrogen: 1.2,
    mining_speed_oxygen: 0.6,
    mining_speed_carbon_dioxide: 0.4,
    mining_speed_sulfur_dioxide: 0.6,

    hide_mines: false,
    covered_veins_small: 8,
    covered_veins_large: 16,
    mining_efficiency_large: 3.0,
    mining_speed_multiple: 1.0,
    enemy_drop_multiple: 1.0,
    icarus_manufacturing_speed: 1.0,
    fractionating_speed: 30,

    is_time_unit_minute: true,
    fixed_num: 2,
    stack_research_lab: 15,
    proliferate_itself: true,
    acc_rate: 1.0,
    inc_rate: 1.0,
    blue_buff: false,

    mineralize_list: {},
    natural_production_line: []
};
export const DefaultSettingsContext = createContext(DEFAULT_SETTINGS);

// "full" >= 1400px | "compact" 1024-1399px | "narrow" 768-1023px | "mobile" < 768px
function get_compact_mode(width) {
    if (width >= 1400) return "full";
    if (width >= 1024) return "compact";
    if (width >= 768) return "narrow";
    return "mobile";
}

export const CompactModeContext = createContext("full");

function safe_parse_json(str) {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

function restore_scheme(game_data) {
    let all;
    try { all = readStorageObject("auto_scheme"); } catch { all = {}; }
    const saved = all[game_data.game_name];
    return saved?.scheme_for_recipe?.length === game_data.recipe_data.length
        ? saved : init_scheme_data(game_data);
}

export function ContextProvider({children}) {
    const [storageWarning, setStorageWarning] = useState("");
    const [model, set_model] = useState(() => {
        const saved_mods = safe_parse_json(getStorageSnapshot("auto_mods"));
        const valid_mods = Array.isArray(saved_mods) ? saved_mods.filter(mod => get_mod_options().some(option => option.value === mod)) : [];
        if (valid_mods.includes(TheyComeFromVoidGUID) && !valid_mods.includes(MoreMegaStructureGUID)) valid_mods.push(MoreMegaStructureGUID);
        const game_data = valid_mods.length ? get_game_data(valid_mods) : default_game_data;
        return {game_info: new GameInfo(game_data), scheme_data: restore_scheme(game_data)};
    });
    const {game_info, scheme_data} = model;
    function set_scheme_data(next) {
        set_model(previous => ({...previous, scheme_data: typeof next === "function" ? next(previous.scheme_data) : next}));
    }
    const [settings, update_settings] = useState(() => {
        let saved;
        try { saved = readStorageObject("auto_settings"); } catch { saved = {}; }
        const merged = {...DEFAULT_SETTINGS, ...saved};
        // Legacy empty arrays must become a record, or JSON drops named items.
        if (Array.isArray(merged.mineralize_list)) merged.mineralize_list = {...merged.mineralize_list};
        // 清理 delete arr[i] 导致的 null 空洞
        if (Array.isArray(merged.natural_production_line)) {
            merged.natural_production_line = merged.natural_production_line.filter(e => e != null);
        }
        return merged;
    });
    function set_settings(patch) {
        update_settings(previous => ({...previous, ...(typeof patch === 'function' ? patch(previous) : patch)}));
    }
    const [compact_mode, set_compact_mode] = useState(() => get_compact_mode(window.innerWidth));

    useEffect(() => {
        const mql_full = window.matchMedia("(min-width: 1400px)");
        const mql_compact = window.matchMedia("(min-width: 1024px)");
        const mql_narrow = window.matchMedia("(min-width: 768px)");

        function on_resize() {
            set_compact_mode(get_compact_mode(window.innerWidth));
        }

        mql_full.addEventListener("change", on_resize);
        mql_compact.addEventListener("change", on_resize);
        mql_narrow.addEventListener("change", on_resize);
        return () => {
            mql_full.removeEventListener("change", on_resize);
            mql_compact.removeEventListener("change", on_resize);
            mql_narrow.removeEventListener("change", on_resize);
        };
    }, []);

    // Auto-save scheme_data
    const game_name = game_info.game_data.game_name;
    useEffect(() => {
        try {
            const all = readStorageObject("auto_scheme");
            all[game_name] = scheme_data;
            localStorage.setItem("auto_scheme", JSON.stringify(all));
        } catch {
            setStorageWarning("无法自动保存生产策略。原始保存数据未被修改，请检查浏览器存储权限或备份现有数据。");
        }
    }, [scheme_data, game_name]);

    // Auto-save settings
    useEffect(() => {
        try {
            readStorageObject("auto_settings");
            localStorage.setItem("auto_settings", JSON.stringify(settings));
        } catch {
            setStorageWarning("无法自动保存计算设置。原始保存数据未被修改，请检查浏览器存储权限或备份现有数据。");
        }
    }, [settings]);

    const global_state = useMemo(() => new GlobalState(game_info, scheme_data, settings), [game_info, scheme_data, settings]);

    function set_game_data(game_data) {
        set_model({game_info: new GameInfo(game_data), scheme_data: restore_scheme(game_data)});
    }

    return <CompactModeContext.Provider value={compact_mode}>
        <GameInfoContext.Provider value={game_info}>
            <GlobalStateContext.Provider value={global_state}>
                <GameInfoSetterContext.Provider value={set_game_data}>
                    <SchemeDataSetterContext.Provider value={set_scheme_data}>
                        <SettingsSetterContext.Provider value={set_settings}>
                            <SettingsContext.Provider value={settings}>
                                <StorageWarningContext.Provider value={storageWarning}>{children}</StorageWarningContext.Provider>
                            </SettingsContext.Provider>
                        </SettingsSetterContext.Provider>
                    </SchemeDataSetterContext.Provider>
                </GameInfoSetterContext.Provider>
            </GlobalStateContext.Provider>
        </GameInfoContext.Provider>
    </CompactModeContext.Provider>
}
