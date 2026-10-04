// Validate emitted URLs for either a project subpath or a root/custom domain.
import assert from 'node:assert/strict';
import console from 'node:console';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const base = `/${(process.argv[2] || '').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\//, '/');
const output = path.resolve(process.argv[3] || 'dist');
const html = readFileSync(path.join(output, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(path.join(output, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.start_url, base, 'PWA start URL must use the configured Pages path');
assert.equal(manifest.scope, base, 'PWA scope must stay inside this site');
assert.ok(existsSync(path.join(output, 'sw.js')), 'Service worker is emitted');
for (const game of ['Vanilla', 'MoreMegaStructure', 'GenesisBook', 'FractionateEverything']) {
    for (const extension of ['png', 'webp']) {
        assert.ok(existsSync(path.join(output, `icon/${game}.${extension}`)), `${game} ${extension} sprite is emitted`);
    }
}

const origin = 'https://pages.example';
function assertLocalAsset(reference) {
    const url = new URL(reference, `${origin}${base}`);
    if (url.origin !== origin || url.protocol === 'data:') return;
    assert.ok(url.pathname.startsWith(base), `Asset escapes Pages base: ${reference}`);
    const relativePath = decodeURIComponent(url.pathname.slice(base.length));
    assert.ok(existsSync(path.join(output, relativePath)), `Missing asset: ${reference}`);
}

for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assertLocalAsset(reference);
}
for (const icon of manifest.icons) assertLocalAsset(icon.src);
const serviceWorker = readFileSync(path.join(output, 'sw.js'), 'utf8');
assert.ok(serviceWorker.includes('index.html'), 'Offline navigation fallback is precached');
console.log(`Verified HTML, manifest, service worker and sprites for ${base}`);
