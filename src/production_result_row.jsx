import {createContext, useContext} from 'react';
import {cn} from './lib/utils';

/** Empty in flat view; each tree occurrence gets its own DOM identity. */
export const ProductionRowInstanceContext = createContext('');

/** Both views mount the exact same canonical editor cells and callbacks. */
export function CanonicalProductionRow({row, instanceId = '', leadingCell, rowProps = {}}) {
    const {children, ...props} = row.props;
    return <ProductionRowInstanceContext.Provider value={instanceId}>
        <tr {...props} {...rowProps} className={cn(props.className, rowProps.className)} data-row-instance={instanceId || undefined}>
            {leadingCell}{children}
        </tr>
    </ProductionRowInstanceContext.Provider>;
}

/** Keep tree item names visible even when the flat layout uses icon-only labels. */
export function ProductionItemName({item, compact}) {
    const instanceId = useContext(ProductionRowInstanceContext);
    return <span className={cn('dsp-item-name text-sm font-medium', compact && !instanceId && 'sr-only')}>{item}</span>;
}

export function ProductionColumns({unit, global = false}) {
    return <>
        <th scope="col" className="px-2 py-3 font-medium">操作</th><th scope="col" className="px-2 py-3 font-medium">物品</th>
        <th scope="col" className="px-2 py-3 text-right font-medium">{global ? '全局产能' : '产能'} / {unit}</th>
        <th scope="col" className="px-2 py-3 font-medium">{global ? '全局工厂数量' : '工厂数量'}</th>
        <th scope="col" className="px-2 py-3 font-medium">配方选取</th><th scope="col" className="px-2 py-3 font-medium">增产模式</th>
        <th scope="col" className="px-2 py-3 font-medium">增产剂</th><th scope="col" className="px-2 py-3 font-medium">工厂类型</th>
        <th scope="col" className="w-24 px-2 py-3 font-medium">物流估算</th>
    </>;
}
