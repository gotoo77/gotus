import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../assets/css/gotus.css', import.meta.url), 'utf8');

function declarations(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
    assert.ok(block, `Bloc CSS introuvable : ${selector}`);
    return Object.fromEntries(
        [...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)]
            .map(match => [match[1], match[2]])
    );
}

function luminance(color) {
    const channels = color.slice(1).match(/.{2}/g).map(value => parseInt(value, 16) / 255);
    const linear = channels.map(value => (
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    ));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
    const [brightest, darkest] = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (brightest + 0.05) / (darkest + 0.05);
}

test('les textes des deux thèmes atteignent le contraste WCAG AA', () => {
    const dark = declarations(':root');
    const light = { ...dark, ...declarations(':root.light') };

    for (const theme of [dark, light]) {
        assert.ok(contrast(theme.text, theme.bg) >= 4.5);
        assert.ok(contrast(theme.dim, theme.bg) >= 4.5);
        assert.ok(contrast(theme.link, theme.bg) >= 4.5);
        assert.ok(contrast('#ffffff', theme.correct) >= 4.5);
        assert.ok(contrast('#171717', theme.present) >= 4.5);
        assert.ok(contrast('#ffffff', theme.absent) >= 4.5);
        assert.ok(contrast(theme.focus, theme.bg) >= 3);
        assert.ok(contrast(theme.focus, theme.panel) >= 3);
        assert.ok(contrast(theme['cell-border'], theme.cell) >= 3);
        assert.ok(contrast(theme['cell-border'], theme.panel) >= 3);
        assert.ok(contrast(theme.primary, theme.bg) >= 3);
        assert.ok(contrast('#ffffff', theme.primary) >= 4.5);
    }
});
