import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const EXPO_LOGO_MD5 = '5ee5db91d59518c45ebcc99a2f5afc57';

const md5 = (path: string): string =>
  createHash('md5').update(readFileSync(path)).digest('hex');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (path === import.meta.filename) return [];
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });

test('the launch screen does not ship the Expo logo', () => {
  const splash = join(ROOT, 'assets/images/splash-icon.png');
  assert.ok(existsSync(splash), 'splash-icon.png is missing');
  assert.notEqual(md5(splash), EXPO_LOGO_MD5, 'splash-icon.png is still the Expo logo');
});

test('no source file references the Expo template artwork', () => {
  const offenders = sourceFiles(join(ROOT, 'src'))
    .filter((path) => /expo-logo|logo-glow/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, [], 'Expo template artwork is still referenced');
});

test('nothing re-introduces the timed splash overlay', () => {
  const offenders = sourceFiles(join(ROOT, 'src'))
    .filter((path) => /animated-icon|AnimatedSplashOverlay/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, [], 'the splash overlay is back on the launch path');
});
