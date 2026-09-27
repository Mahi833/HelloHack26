import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..');

const nativeSources = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return nativeSources(path);
    if (path === import.meta.filename) return [];
    if (/\.web\.tsx?$/.test(entry)) return [];
    return /\.tsx$/.test(entry) ? [path] : [];
  });

const nativeScreenSources = (): string[] => [
  ...nativeSources(join(ROOT, 'src/app')),
  ...nativeSources(join(ROOT, 'src/components')),
];

test('the app declares a single light appearance', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
  assert.equal(config.expo.userInterfaceStyle, 'light', 'app.json still follows the system appearance');

  const iosDir = join(ROOT, 'ios');
  if (!existsSync(iosDir)) return;
  const plistPath = readdirSync(iosDir)
    .map((entry) => join(iosDir, entry, 'Info.plist'))
    .find((candidate) => existsSync(candidate));
  if (plistPath === undefined) return;
  const plist = readFileSync(plistPath, 'utf8');
  const declared = /<key>UIUserInterfaceStyle<\/key>\s*<string>([^<]+)<\/string>/.exec(plist);
  assert.equal(declared?.[1], 'Light', 'Info.plist still follows the system appearance');
});

test('no native screen switches palette on the system colour scheme', () => {
  const offenders = nativeScreenSources().filter((path) =>
    /useColorScheme|DarkTheme/.test(readFileSync(path, 'utf8')),
  );
  assert.deepEqual(offenders, [], 'a native screen still branches on the system appearance');
});

test('screens draw their surfaces from the shared design tokens', () => {
  const screens = nativeSources(join(ROOT, 'src/app')).filter((path) => !/\.test\.tsx?$/.test(path));
  const offenders = screens.filter((path) => !/@\/constants\/design/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, [], 'a screen defines its own palette instead of using the design tokens');
});
