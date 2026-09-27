# Removing Expo from iCup

## Why

Alex wants Expo out. The tooling objection is already satisfied: the beta on his
phone was produced by `xcodebuild` against `ios/HelloHack26.xcworkspace`, signed
with his certificate, with `main.jsbundle` compiled into the app. No Expo
account, no EAS, no Metro. What remains is Expo as a set of native libraries and
as a generator for `Info.plist` and entitlements.

One concrete cost already paid: `expo-modules-jsi` is what failed to compile
under Xcode 26.2, and carrying a vendored patch for it is ongoing maintenance.

## Done already

Nine packages had zero imports and zero plugin entries and were removed:
`@expo/ui`, `expo-constants`, `expo-dev-client`, `expo-device`, `expo-font`,
`expo-glass-effect`, `expo-linking`, `expo-status-bar`, `expo-system-ui`.
Typecheck, lint and 45 tests still pass. Not yet verified against a native
build, because the pod set changed.

## What is left, in dependency order

Ordered so each step lands on a working app. `expo-router` is last because
everything renders inside it.

### 1. expo-symbols — DONE, no replacement needed

Its only consumer was `src/components/ui/collapsible.tsx`, which nothing
imports. Traced from all four routes under `src/app/`: `_layout`, `index`,
`history` and `quick-add` reach neither it nor anything that reaches it. Both
the file and the package were deleted, so no chevron replacement was written.

This orphaned `src/components/themed-text.tsx` and
`src/components/themed-view.tsx`, whose only importer was `collapsible`. They
are left in place because removing them is unrelated to this migration.

### 2. expo-web-browser — also dead code

Its only consumer is `src/components/external-link.tsx`, which nothing imports
either. This step is a deletion, not a replacement, so `Linking.openURL` and
`react-native-inappbrowser-reborn` are both moot and the earlier concern about
the user leaving the app does not apply.

Also unreferenced, found while tracing: `src/components/hint-row.tsx` and
`src/components/web-badge.tsx`. Neither involves Expo.

### 3. expo-image (3 imports)

Used for the splash overlay and the Bluetooth badge. React Native's `Image`
covers both; neither uses caching, blurhash, or transitions. Straight swap.

### 4. expo-splash-screen (2 imports)

`preventAutoHideAsync` plus the animated overlay in
`src/components/animated-icon.tsx`. Replace with `react-native-bootsplash`,
which owns the native launch screen and exposes a hide call. Touches the Xcode
project's launch storyboard, so this is the first step with real native surface
area.

### 5. expo-sqlite (2 imports) — carries the persistence layer

`src/store/db.ts` and `src/store/hydration-store.ts`, which hold every logged
drink. Replace with `@op-engineering/op-sqlite`, which supports the New
Architecture and is actively maintained.

The schema and queries are small, but this is the step that can lose user data,
so it needs a migration path for anyone already running the current build, and
the store's tests must pass against the new driver before the old one is
deleted.

### 6. expo-notifications (3 imports) — carries the reminder layer

`src/health/use-health-reminders.ts` and the toggle in `src/app/index.tsx`.
Replace with `@notifee/react-native` plus `react-native-permissions`.

Two behaviours must survive: scheduling a local notification with a
`data.kind === 'sip-reminder'` tag, and reading back all scheduled notifications
to decide whether the toggle shows on. Notifee models channels and triggers
differently, so this is a rewrite of the scheduling logic rather than a rename.

### 7. expo-router (4 imports) — the app shell

`src/app/_layout.tsx`, `src/app/index.tsx`, `expo-router/ui`, and
`expo-router/unstable-native-tabs` in `app-tabs.tsx`. Also supplies
`ThemeProvider`, `DarkTheme` and `DefaultTheme`.

Replace with `@react-navigation/native` plus
`@react-navigation/bottom-tabs`. File-based routing goes away, so the four
screens under `src/app/` become an explicit navigator. `unstable-native-tabs`
has no direct equivalent; the closest is
`react-native-bottom-tabs` for genuinely native tabs, or accepting JS tabs.

This is the largest step and the one most likely to change how the app looks,
which matters because Alex asked for the visuals to be left alone.

### 8. expo and expo-modules-core

Only removable once everything above is gone, because each `expo-*` package
registers through `expo-modules-core`. Removing it also retires
`patches/expo-modules-jsi+57.1.1.patch` and
`scripts/patch-expo-jsi.sh`, which is the direct payoff for the Xcode 26.2
breakage.

### 9. Continuous Native Generation

`app.json` plugins currently generate the `Info.plist` keys and the HealthKit
entitlement. Without them, `ios/` becomes hand-maintained and must be committed
to git, where it is currently ignored (`.gitignore:42:/ios`). The entitlement
that `codesign` confirmed in the Release binary has to be preserved by hand.

Keep `react-native-healthkit` and `@sfourdrinier/react-native-ble-plx`: neither
is an Expo package, and both already work.

## Risks

The persistence and reminder layers are the demo, and steps 5 and 6 rewrite both.
Step 7 can move the UI. Every step changes the pod set, so each needs a full
native rebuild, and the first Release build took about 40 minutes from a cold
cache.

There is no partial win available at the end: `expo` and `expo-modules-core`
only leave after all seven consumers do, so stopping halfway means carrying both
stacks.

## Open decision: the gyroscope slosh

The slosh animation needs a motion sensor. `react-native-sensors` was chosen but
is unusable: last published November 2022, peer range `react-native >=0.39`, no
`codegenConfig`, and RN 0.86 is bridgeless only.

Decided: a native CoreMotion module. No Expo, no third-party dependency.

It must be a New Architecture native module, since RN 0.86 is bridgeless only,
and it needs to push a stream of samples rather than answer a single call. That
means an event-emitting Turbo Module: a TypeScript spec, `codegenConfig` in
`package.json`, and a Swift implementation wrapping
`CMMotionManager.startDeviceMotionUpdates`, reading the gravity vector so the
orb tracks down without integrating raw gyroscope rates.

Sequencing: this lands after step 1 has been through a green native build.
Stacking an unverified new native module on an unverified pod set would make a
failure impossible to attribute.

## Orb design, as chosen

A new circular vessel alongside the existing bar, not replacing it. Water level
set by `todayMl / dailyGoalMl`. Surface is a rectangle clipped to the circle via
`overflow: hidden`, so no drawing library is needed and `react-native-svg` stays
out. Surface angle comes from gravity through a damped spring per axis in
Reanimated 4.5.1, already installed, so it overshoots and settles rather than
tracking rigidly. Straight surface edge, not a curved wave, which is the
accepted cost of adding no graphics dependency.
