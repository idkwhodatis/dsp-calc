import {useContext, useMemo, useState} from 'react';
import {Check, ChevronDown, PackageSearch, Search, X} from 'lucide-react';
import fuzzysort from 'fuzzysort';
import {pinyin} from 'pinyin-pro';
import {GameInfoContext} from './contexts.jsx';
import {ItemIcon} from './icon.jsx';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';
import {Badge} from './components/ui/badge';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from './components/ui/dialog';
import {cn} from './lib/utils.js';

export function ItemSelect({item, set_item, text = '选择物品', icon, disabled = false, variant, className}) {
    const game_info = useContext(GameInfoContext);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const targets = useMemo(() => {
        const all = new Set(game_info.all_target_items);
        const ordered = (game_info.icon_grid?.icons ?? [])
            .filter(entry => all.has(entry.item))
            .sort((a, b) => a.row - b.row || a.col - b.col)
            .map(entry => entry.item);
        // Some modded products have no icon-grid position; they remain selectable.
        return [...new Set([...ordered, ...all])].map(name => ({
            item: name,
            py_first: pinyin(name, {pattern: 'first', type: 'array'}).join(''),
            py_full: pinyin(name, {toneType: 'none'}),
            py_joined: pinyin(name, {toneType: 'none', type: 'array'}).join(''),
        }));
    }, [game_info]);
    const results = useMemo(() => {
        const search = query.trim();
        return search
            ? fuzzysort.go(search, targets, {keys: ['item', 'py_first', 'py_full', 'py_joined']}).map(result => result.obj.item)
            : targets.map(target => target.item);
    }, [query, targets]);

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
        <DialogContent className="flex max-h-[88dvh] flex-col gap-4 overflow-hidden sm:max-w-3xl">
            <DialogHeader className="pr-6">
                <DialogTitle>选择物品</DialogTitle>
                <DialogDescription>搜索物品名称、拼音或拼音首字母，按 Enter 选择首个搜索结果。</DialogDescription>
            </DialogHeader>
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true"/>
                <Input autoFocus type="search" value={query} placeholder="搜索物品，例如：铁块 / tiek / tk"
                       aria-label="搜索物品，支持中文和拼音" className="h-11 pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden"
                       onChange={event => setQuery(event.target.value)}
                       onKeyDown={event => {
                           if (event.key === 'Enter' && !event.nativeEvent.isComposing && query.trim() && results.length) {
                               event.preventDefault();
                               select(results[0]);
                           }
                       }}/>
                {query && <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                                  aria-label="清除搜索" onClick={() => setQuery('')}><X className="size-4"/></Button>}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{query.trim() ? '搜索结果' : '全部物品'}</span>
                <Badge variant="secondary" aria-live="polite">{results.length} 项</Badge>
            </div>
            <div className="-mx-1 min-h-0 overflow-y-auto px-1 pb-1">
                {results.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                    {results.map((target, index) => <Button key={target} type="button" variant="outline"
                        aria-label={`选择${target}`} aria-pressed={target === item}
                        className={cn('relative h-auto min-h-24 flex-col gap-2 whitespace-normal rounded-xl px-2 py-3 text-center text-xs font-normal leading-snug',
                            target === item && 'border-primary bg-primary/5',
                            query.trim() && index === 0 && 'ring-1 ring-ring')}
                        onClick={() => select(target)}>
                        <ItemIcon item={target} size={36} tooltip={false}/>
                        <span className="line-clamp-2">{target}</span>
                        {target === item && <Check className="absolute right-2 top-2 size-3 text-primary" aria-hidden="true"/>}
                    </Button>)}
                </div> : <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center">
                    <PackageSearch className="size-9 text-muted-foreground/60" aria-hidden="true"/>
                    <p className="text-sm font-medium">没有找到相关物品</p>
                    <p className="text-xs text-muted-foreground">试试更短的名称、拼音首字母，或检查已启用的模组。</p>
                    <Button variant="outline" size="sm" onClick={() => setQuery('')}>查看全部物品</Button>
                </div>}
            </div>
        </DialogContent>
    </Dialog>;
}
