import {useContext} from 'react';
import {GlobalStateContext} from './contexts';
import {get_icon_by_item} from "./GameData.jsx";
import {Tooltip, TooltipContent, TooltipTrigger} from './components/ui/tooltip';

const image_index_modules = import.meta.glob('../icon/*.json', {
    import: 'default',
    eager: true,
});

/** {[game_name: string]: {[item: string]: image_props}}} */
const image_indices = Object.fromEntries(
    Object.entries(image_index_modules)
        .map(([module, icons]) =>
            [module.replace(/^\.\.\/icon\/(.+)\.json/, "$1"), icons]
        ))

export function IconStyles() {
    function get_icon_style(mod_name) {
        //console.log("mod_name", mod_name)
        return `
.icon-${mod_name} {
    vertical-align: middle;
    display: inline-block;
    flex-shrink: 0;
    background-image: url('${import.meta.env.BASE_URL}icon/${mod_name}.png');
    @supports (background-image: url('${import.meta.env.BASE_URL}icon/${mod_name}.webp')) {
        background-image: url('${import.meta.env.BASE_URL}icon/${mod_name}.webp');
    }
}`;
    }

    const styles = Object.keys(image_indices).map(get_icon_style).join("\n");
    return <style>{styles}</style>;
}

function Icon({icon, size, mods}) {
    //console.log("Icon(" + icon + ", " + size + ", " + mods + ")");
    if (!mods.includes("Vanilla")) {
        mods = ["Vanilla", ...mods];
    }
    //倒序查询图标
    for (let i = mods.length - 1; i >= 0; i--) {
        let icon2 = get_icon_from_one_mod(icon, size, mods[i]);
        if (icon2 !== null) {
            return icon2;
        }
    }
    return <><span role="img" aria-label={icon}
        style={{
            width: size, height: size,
            display: "inline-block",
            fontSize: 10,
            textWrap: "pretty",
            overflow: "hidden",
        }}
    >? {icon}</span></>
}

function get_icon_from_one_mod(icon, size, mod) {
    //console.log("Icon1(" + icon + ", " + size + ", " + mod + ")");
    //console.log("image_indices", image_indices);
    //console.log("mod", mod);
    //console.log("icon", icon);
    try {
        const {x, y, height, total_width, total_height} = image_indices[mod][icon];
        //console.log("find " + icon + " from " + mod + " success.");
        const scale = size / height;

        const tw = total_width * scale, th = total_height * scale;
        const bgx = -x * scale, bgy = -y * scale;

        return <>
            <span className={`icon-${mod}`} role="img" aria-label={icon}
                 style={{
                     width: size, height: size,
                     backgroundPosition: `${bgx}px ${bgy}px`,
                     backgroundSize: `${tw}px ${th}px`,
                 }}
            />
        </>;
    } catch {
        //console.log("find " + icon + " from " + mod + " fail.");
        return null;
    }
}

export function ItemIcon({item, size, tooltip}) {
    const global_state = useContext(GlobalStateContext);
    size = size || 40;

    const icon = get_icon_by_item(item);

    let img = <Icon icon={icon} size={size} mods={global_state.game_data.mods}/>;

    tooltip = tooltip === undefined ? true : tooltip;
    if (tooltip) {
        return <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex shrink-0 items-center align-middle">{img}</span>
            </TooltipTrigger>
            <TooltipContent side="top">{item}</TooltipContent>
        </Tooltip>;
    }
    return img;
}
