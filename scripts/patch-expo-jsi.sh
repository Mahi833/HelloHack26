#!/bin/sh
set -e
ROOT="node_modules/expo-modules-jsi/apple"
HEADER="$ROOT/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h"
CHANGED=0
if [ -f "$HEADER" ] && grep -q "SWIFT_RETURNS_RETAINED RuntimeScheduler" "$HEADER"; then
  sed -i '' 's|^  SWIFT_RETURNS_RETAINED RuntimeScheduler(|  RuntimeScheduler(|' "$HEADER"
  CHANGED=1
fi
if [ "$CHANGED" = "1" ]; then
  rm -rf "$ROOT/.DerivedData"
  echo "patched expo-modules-jsi for Xcode 26.2"
fi
