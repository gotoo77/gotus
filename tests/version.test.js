import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageInfo = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
const buildInfo = JSON.parse(
    await readFile(new URL('../assets/data/build-info.json', import.meta.url), 'utf8')
);
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const versionedSources = await Promise.all([
    '../index.html',
    '../assets/css/gotus.css',
    '../assets/js/gotus.js',
    '../assets/js/intro.js',
    '../assets/js/game-logic.js',
    '../assets/js/logger.js',
    '../assets/images/favicon.svg'
].map(path => readFile(new URL(path, import.meta.url), 'utf8')));

test('les informations du build correspondent à package.json', () => {
    assert.match(packageInfo.version, /^\d+\.\d+\.\d+$/);
    assert.equal(buildInfo.version, packageInfo.version);
    assert.equal(buildInfo.release, packageInfo.gotus.release);
    assert.equal(buildInfo.channel, packageInfo.gotus.channel);
});

test('la date et le commit du build sont renseignés', () => {
    assert.ok(!Number.isNaN(new Date(buildInfo.buildDate).getTime()));
    assert.match(buildInfo.buildDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.match(buildInfo.commit, /^(?:[0-9a-f]{8}(?:-dirty)?|indisponible)$/);
});

test('le changelog suit la version courante et conserve une section à venir', () => {
    assert.match(changelog, /^## \[À venir\]$/m);
    assert.ok(changelog.includes(`## [${packageInfo.version}]`));
});

test('les fichiers publics portent la version et les crédits du projet', () => {
    for (const source of versionedSources) {
        assert.ok(source.includes(`@version ${packageInfo.version}`));
        assert.match(source, /@author Gotoo et les contributeurs/);
        assert.match(source, /@license MIT/);
    }
    assert.match(versionedSources[0], new RegExp(`\\?v=${packageInfo.version.replaceAll('.', '\\.')}["']`));
    assert.match(versionedSources[2], new RegExp(`\\?v=${packageInfo.version.replaceAll('.', '\\.')}["']`));
});
