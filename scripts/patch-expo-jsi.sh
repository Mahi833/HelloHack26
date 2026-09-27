#!/bin/sh
set -e
ROOT="node_modules/expo-modules-jsi"
PATCH="patches/expo-modules-jsi+57.1.1.patch"
[ -d "$ROOT" ] || exit 0
[ -f "$PATCH" ] || exit 0
INSTALLED=$(node -p "require('./$ROOT/package.json').version" 2>/dev/null || echo unknown)
if [ "$INSTALLED" != "57.1.1" ]; then
  echo "expo-modules-jsi is $INSTALLED, patch targets 57.1.1; skipping. Verify the Xcode 26.2 build."
  exit 0
fi
if patch -p1 -d "$ROOT" --dry-run --forward --silent < "$PATCH" >/dev/null 2>&1; then
  patch -p1 -d "$ROOT" --forward --silent < "$PATCH"
  rm -rf "$ROOT/apple/.DerivedData" "$ROOT/apple/.build"
  echo "patched expo-modules-jsi for Xcode 26.2"
fi
