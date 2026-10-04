const STORAGE_EVENT = 'dsp-calc:storage';

export function isStorageRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Keep the existing localStorage format, and never replace an unreadable save. */
export function readStorageObject(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return {};
    let value;
    try {
        value = JSON.parse(raw);
    } catch {
        throw new Error('保存的数据无法读取。请先备份浏览器中的原始数据，再重试。');
    }
    // Older versions sometimes wrote null for an empty collection.
    if (value === null) return {};
    if (!isStorageRecord(value)) {
        throw new Error('保存的数据格式不正确，原始数据未被修改。');
    }
    return value;
}

export function getStorageSnapshot(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function subscribeStorage(listener) {
    window.addEventListener('storage', listener);
    window.addEventListener(STORAGE_EVENT, listener);
    return () => {
        window.removeEventListener('storage', listener);
        window.removeEventListener(STORAGE_EVENT, listener);
    };
}

/** Read again at action time so saving one game never overwrites another game. */
export function updateScopedStorage(key, scope, updater) {
    const all = readStorageObject(key);
    const existing = Object.hasOwn(all, scope) ? all[scope] : {};
    if (!isStorageRecord(existing)) {
        throw new Error('此游戏版本的保存数据无法读取，原始数据未被修改。');
    }
    const updated = {...all, [scope]: updater({...existing})};
    localStorage.setItem(key, JSON.stringify(updated));
    window.dispatchEvent(new Event(STORAGE_EVENT));
}
