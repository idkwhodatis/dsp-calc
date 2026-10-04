import {useContext, useMemo, useState} from 'react';
import {Check, ChevronDown, PackageSearch, Search, X} from 'lucide-react';
import fuzzysort from 'fuzzysort';
import {pinyin} from 'pinyin-pro';
import {CompactModeContext, GameInfoContext} from './contexts.jsx';
import {ItemIcon} from './icon.jsx';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';
import {Badge} from './components/ui/badge';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from './components/ui/dialog';
import {Tooltip, TooltipContent, TooltipTrigger} from './components/ui/tooltip';
import {cn} from './lib/utils.js';

function CompactItemTile({entry, selected, iconSize, onSelect}) {
    return <Tooltip>
        <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={`选择${entry.item}`} aria-pressed={selected}
                    className={cn('relative size-[var(--picker-tile-size)] rounded-md border border-transparent bg-muted/40 p-0 hover:border-border hover:bg-accent focus-visible:z-10',
                        selected && 'border-primary/60 bg-primary/10')}
                    style={entry.col ? {gridColumn: entry.col, gridRow: entry.row} : undefined}
                    onClick={() => onSelect(entry.item)}>
                <ItemIcon item={entry.item} size={iconSize} tooltip={false}/>
                {selected && <Check className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-background text-primary" aria-hidden="true"/>}
            </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>{entry.item}</TooltipContent>
    </Tooltip>;
}

export function ItemSelect({item, set_item, text = '选择物品', icon, disabled = false, variant, className}) {
    const game_info = useContext(GameInfoContext);
    const compactMode = useContext(CompactModeContext);
    const iconSize = compactMode === 'mobile' ? 28 : 40;
    const tileSize = iconSize + 4;
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const layout = useMemo(() => {
        const all = new Set(game_info.all_target_items);
        const positionedNames = new Set();
        const positioned = (game_info.icon_grid?.icons ?? [])
            .filter(entry => all.has(entry.item) && Number.isInteger(entry.col) && entry.col > 0 && Number.isInteger(entry.row) && entry.row > 0)
            .sort((a, b) => a.row - b.row || a.col - b.col)
            .filter(entry => {
                if (positionedNames.has(entry.item)) return false;
                positionedNames.add(entry.item);
                return true;
            });
        // Keep every modded target, including products without a game-grid slot.
        const unpositioned = [...all].filter(name => !positionedNames.has(name));
        const names = [...positioned.map(entry => entry.item), ...unpositioned];
        const targets = names.map(name => ({
            item: name,
            py_first: pinyin(name, {pattern: 'first', type: 'array'}).join(''),
            py_full: pinyin(name, {toneType: 'none'}),
            py_joined: pinyin(name, {toneType: 'none', type: 'array'}).join(''),
        }));
        const columns = Math.max(1, Number.isFinite(game_info.icon_grid?.ncol) ? game_info.icon_grid.ncol : 0, ...positioned.map(entry => entry.col));
        const rows = Math.max(1, Number.isFinite(game_info.icon_grid?.nrow) ? game_info.icon_grid.nrow : 0, ...positioned.map(entry => entry.row));
        return {positioned, unpositioned, targets, columns, rows};
    }, [game_info]);
    const results = useMemo(() => {
        const search = query.trim();
        return search
            ? fuzzysort.go(search, layout.targets, {keys: ['item', 'py_first', 'py_full', 'py_joined']}).map(result => result.obj.item)
            : layout.targets.map(target => target.item);
    }, [query, layout]);
    const searching = Boolean(query.trim());
    const gridStyle = {
        gridTemplateColumns: `repeat(${layout.columns}, var(--picker-tile-size))`,
        gridTemplateRows: `repeat(${layout.rows}, var(--picker-tile-size))`,
    };

    function select(target) {
        const result = set_item(target);
        if (result !== false) setOpen(false);
    }

    function changeOpen(next) {
        if (next) setQuery('');
        setOpen(next);
    }

    return <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
            <Button type="button" variant={variant || (item ? 'outline' : 'default')} disabled={disabled}
                    className={cn('gap-2', className)} title={text} aria-label={item ? `${text}：${item}` : text}>
                {item && <ItemIcon item={item} size={24} tooltip={false}/>}
                {!item && icon}
                <span className="max-w-48 truncate">{item || text}</span>
                {item && <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true"/>}
            </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[90dvh] max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-hidden p-3 sm:max-w-[calc(100vw-2rem)] sm:p-4"
                       style={{'--picker-tile-size': `${tileSize}px`, width: `${Math.max(360, layout.columns * (tileSize + 3) - 3 + 34)}px`}}>
            <DialogHeader className="shrink-0 gap-1 pr-6 text-left">
                <DialogTitle className="text-base">选择物品</DialogTitle>
                <DialogDescription className="text-xs">按游戏布局快速选择，支持名称、拼音与首字母搜索。</DialogDescription>
            </DialogHeader>
            <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true"/>
                <Input autoFocus type="search" value={query} placeholder="搜索物品，例如：铁块 / tiekuai / tk"
                       aria-label="搜索物品，支持中文和拼音" className="h-9 pl-9 pr-10 text-sm [&::-webkit-search-cancel-button]:hidden"
                       onChange={event => setQuery(event.target.value)}
                       onKeyDown={event => {
                           if (event.key === 'Enter' && !event.nativeEvent.isComposing && query.trim() && results.length) {
                               event.preventDefault();
                               select(results[0]);
                           }
                       }}/>
                {query && <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                                  aria-label="清除搜索" onClick={() => setQuery('')}><X className="size-3.5"/></Button>}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{searching ? '搜索结果 · Enter 选择首项' : '全部物品 · 悬停查看名称'}</span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]" aria-live="polite">{results.length} 项</Badge>
            </div>
            <div className="min-h-0 overflow-auto overscroll-contain rounded-md p-0.5" aria-label={searching ? '物品搜索结果' : '游戏物品布局'}>
                {searching ? (results.length ? <div className="grid gap-1 sm:grid-cols-2">
                    {results.map((target, index) => <Button key={target} type="button" variant="ghost"
                        aria-label={`选择${target}`} aria-pressed={target === item}
                        className={cn('h-9 min-w-0 justify-start gap-2 rounded-md border border-transparent px-2 text-xs font-normal',
                            target === item && 'border-primary/60 bg-primary/10',
                            index === 0 && 'border-border bg-accent')}
                        onClick={() => select(target)}>
                        <ItemIcon item={target} size={24} tooltip={false}/>
                        <span className="truncate">{target}</span>
                        {target === item && <Check className="ml-auto size-3 shrink-0 text-primary" aria-hidden="true"/>}
                    </Button>)}
                </div> : <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-3 text-center">
                    <PackageSearch className="size-7 text-muted-foreground/60" aria-hidden="true"/>
                    <p className="text-sm font-medium">没有找到相关物品</p>
                    <p className="text-xs text-muted-foreground">试试更短的名称、拼音首字母，或检查已启用的模组。</p>
                    <Button variant="outline" size="sm" onClick={() => setQuery('')}>查看全部物品</Button>
                </div>) : <div className="w-max min-w-full space-y-3">
                    {layout.positioned.length > 0 && <div className="grid w-max gap-[3px]" style={gridStyle} role="group" aria-label="游戏物品网格">
                        {layout.positioned.map(entry => <CompactItemTile key={entry.item} entry={entry} selected={entry.item === item}
                            iconSize={iconSize} onSelect={select}/>)}
                    </div>}
                    {layout.unpositioned.length > 0 && <div className={cn('space-y-2', layout.positioned.length > 0 && 'border-t pt-3')}>
                        <p className="text-[11px] text-muted-foreground">其它物品</p>
                        <div className="grid w-max gap-[3px]" style={{gridTemplateColumns: gridStyle.gridTemplateColumns}} role="group" aria-label="其它可选物品">
                            {layout.unpositioned.map(target => <CompactItemTile key={target} entry={{item: target}} selected={target === item}
                                iconSize={iconSize} onSelect={select}/>)}
                        </div>
                    </div>}
                </div>}
            </div>
            {!searching && <p className="shrink-0 text-[10px] text-muted-foreground md:hidden">可横向滚动查看完整布局，也可直接搜索物品</p>}
        </DialogContent>
    </Dialog>;
}
