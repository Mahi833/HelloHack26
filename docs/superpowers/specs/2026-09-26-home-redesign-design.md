# Home screen redesign

## Intent

A hydration app that reads in one glance and logs in one tap, where the cup
logging by itself is the point and manual logging is the fallback. Simple means
fewer screens and fewer decisions, not fewer features.

Success:

- You can tell where you stand without reading anything.
- You can log a drink you did not take from the cup without leaving home.
- You find out promptly when the cup stops logging.

The third criterion is not something Alex asked for. It came out of the
research and he accepted it. It is the reason the device status design is
asymmetric rather than simply small.

## Decisions taken

| Question | Answer |
| --- | --- |
| Scope | Rebuild home, fold Quick Add into it, three tabs become two |
| Hero | Large water orb with the number inside |
| Device status | Small status dot in the header |
| Manual logging | Preset row, secondary to the hero |
| Layout | Single screen, no scrolling |
| Reminder cadence | Adapts to how far behind you are |
| Reminder loudness | Default sound, normal priority |
| Sip feedback | Subtle buzz, only while the app is open |
| Glass | Local native module, not `expo-glass-effect` |
| Glass extent | Cards and controls, not the orb |

## What the references gave us

Four hydration app mockups were supplied. The parts worth stealing:

- The hero should be a **next action**, not only a status readout (Ref 1).
- One circle, percentage and absolute together, read in under a second (Ref 2).
- **Undo after logging.** Almost nobody ships it and it is the most forgiving
  affordance in any of the four (Ref 2).
- Reminders as first-class content, not a settings toggle (Ref 4).
- Showing the **gap** to the goal, not only the progress (Ref 3).

The parts to avoid:

- Splitting a fraction across two elements so the reader has to assemble it
  (Ref 1: `1000ml` in the circle, `2000ml` in a card beside it).
- White text on a light blue gradient (Ref 4). Fails contrast at the light end.
- Carousel dots hiding content behind an undiscoverable swipe (Ref 3).
- Five tabs on an app that does one thing (Ref 3).

The pattern common to all four, and the one that matters most: every one of
them puts logging within one tap of the home screen. The current build makes
you switch tabs. That is the largest single friction we are removing.

None of the four pairs with hardware, so none of them solve device status.

## What the research changed

Two research briefs were commissioned, one on hydration app patterns and one on
general mobile UI/UX. What actually altered the design:

**Device status is asymmetric.** HidrateSpark ships a coloured glyph in the nav
area with full device detail one tap away, which validates the header dot. But
its own reviews describe sync silently failing and users losing trust in the
data. So: steady state is a dot, failure is a banner.

**Lead with completed, not remaining.** Kivetz, Urminsky and Zheng (2006) found
completed framing outperforms remaining framing on matched effort. The current
screen leads with "1,675 ml to go". The hero becomes consumed volume, and "to
go" drops to a tertiary line. Caveat recorded honestly: that study is loyalty
cards, not daily health metrics. It is a reasonable inference, not proven here.

**Tabular figures on the hero.** Without them the number reflows every time it
changes, on the one screen whose entire job is that number.

**Dynamic Type.** Every style in this codebase uses a fixed `fontSize`. The
hero will clip for anyone running larger system text.

**Reduce Motion.** The slosh is ambient motion with no state change behind it,
which is the class of animation that should be disabled outright under Reduce
Motion. The version shipped today does not do this. It is a defect in existing
work, not a new feature.

**Notification fatigue is the top complaint in this category.** Reviewers of
the market leader use the words "extremely annoying", "hounds me constantly"
and "preachy". This is the argument against making reminders louder, and the
reason the adaptive cadence below is quiet when you are on pace.

Recorded gap: no controlled study was found comparing orb, ring and bar for
hydration apps. The orb is the convention shipping apps converged on, not a
proven win.

## The screen, top to bottom

Single screen. Nothing scrolls. On an iPhone 13 the content is roughly 480 pt
of an 844 pt screen, so there is comfortable slack for Dynamic Type.

### Header

`Today` and the date, leading. Trailing: a status dot and a gear.

The dot is green when the cup is connected and logging, grey when it is not.
Tapping it opens a sheet containing battery, live weight, connect, disconnect
and tare. That sheet is where the current `bleControlCard` goes.

**Failure is not a dot.** If the cup reports connected but no weight sample has
arrived for 60 seconds, a full-width amber banner appears beneath the header
reading `iCup connected but not sending data`. The threshold is 60 s because
the firmware notifies continuously while connected, so a minute of silence is
unambiguous rather than a slow sample rate. Silent sync failure is the
documented way apps in this category lose the user's trust in their own data.

### Hero orb

About 260 pt, centred, filled to `todayMl / dailyGoalMl`, using the slosh
physics already built.

Inside the orb: consumed millilitres as the dominant number in tabular figures,
with `of 3,000 ml` small beneath it. Below the orb, one muted line:
`44% · 1,675 ml to go`.

The orb stays solid water. It does not become glass, so the hero still reads as
liquid rather than as another panel.

### Preset row

Three chips in the thumb zone: `250 ml`, `500 ml`, `+` for a custom amount.
One tap on either preset logs immediately. The `+` opens a sheet with a stepper
in 50 ml increments and a confirm button, so a custom amount costs three taps
and no typing. For four seconds after any log the row swaps to `Undo`, which
removes the drink just added and restores the previous total.

This replaces the Quick Add tab entirely.

### Reminder line

One line: `Next reminder 4:30pm` and the toggle.

### Tabs

Three become two: Home and History. Quick Add's serving cards become the preset
row.

## Glass

Verified against the installed iOS 26.2 SDK rather than assumed:
`UIGlassEffect : UIVisualEffect`, `API_AVAILABLE(ios(26.0))`, styles `Regular`
and `Clear`, constructed with `+effectWithStyle:`.

The deployment target is 16.4, so the view checks availability at runtime and
falls back to `UIBlurEffect` with `systemThinMaterial` below iOS 26. Alex's
demo phone runs iOS 26.5.2, so it gets the real material.

**Glass needs something behind it.** The current background is a flat
`#F4FAFC`. Blurring a flat colour returns the same flat colour, so glass over
today's background would be indistinguishable from a translucent white
rectangle. The material therefore ships together with a background worth
blurring: the orb's colour bleeding outward and soft blue shapes toward the
screen edges. Neither half is worth doing alone.

Built as `modules/icup-glass/`, a local autolinked package, following the
pattern proven by `modules/icup-motion/`. This is a Fabric **view** component
rather than a Turbo Module, so it needs `type: "components"` in `codegenConfig`,
a `codegenNativeComponent` spec, and an `RCTViewComponentView` subclass. That is
more codegen surface than `icup-motion` needed, and it is the main reason this
step is larger than it looks.

`expo-glass-effect` would be faster and was explicitly rejected, because it
walks back the decision to drop Expo and adds another package to unwind.

## Reminders

### Adaptive cadence

Waking window is 07:00 to 22:00, fifteen hours, chosen to match the existing
quiet hours rather than fight them.

    expectedByNow = goal * clamp((now - 07:00) / 15h, 0, 1)
    deficit       = expectedByNow - todayMl
    gap           = deficit > 0.2 * expectedByNow ? 60 min : 120 min

Quiet hours 22:00 to 07:00 stay as they are. This replaces the constant
`DEFAULT_IDLE_GAP_MS` of 90 minutes.

The gap function is pure, so it is unit tested alongside the existing suite
before it is wired in.

### The notification defect

`scheduleNudge` in `src/health/use-health-reminders.ts` never sets
`content.sound`. The handler in `src/app/_layout.tsx` sets
`shouldPlaySound: true`, but that governs only notifications arriving while the
app is foregrounded. A reminder firing against a locked phone is delivered
silent, and therefore does not vibrate either.

Fix: `sound: 'default'` on the notification content.

Permissions are not implicated. `requestPermissionsAsync()` with no arguments
defaults to alert, badge and sound, confirmed in the installed package.

Recorded so it is not promised later: **iOS has no independent vibrate setting
for notifications.** The system decides from the ring switch and the user's
haptics settings. There will be no vibrate toggle.

### Sip feedback

When the cup logs a sip while the app is foregrounded, a short buzz via React
Native's built-in `Vibration` API. No new dependency. Nothing fires while the
app is backgrounded, so automatic logging never interrupts.

## Accessibility

- Dynamic Type across every text style, replacing fixed `fontSize`.
- Tabular figures on the hero number.
- Slosh disabled entirely under Reduce Motion. The orb still fills, but as a
  crossfade rather than physics, because the fill communicates a state change
  and the slosh does not.
- Contrast stays dark-on-light. The palette keeps its current calm blue
  precisely because the references' white-on-gradient fails at the light end.

## What gets deleted

- `src/app/quick-add.tsx` and its tab entry.
- The `bleControlCard` block in `src/app/index.tsx`, relocated into the device
  sheet.
- Confirmed-unreferenced components: `external-link.tsx`, `hint-row.tsx`,
  `web-badge.tsx`.
- `themed-text.tsx` and `themed-view.tsx` are **not** unreferenced. An earlier
  draft of this spec said they were, which was wrong: `app-tabs.web.tsx` imports
  both. They die only if the web target dies, which is a separate decision.

The Bluetooth and battery bubbles and their 21 dead style entries are already
removed.

## Risks

**This is the demo surface.** The home screen is the demo. Every change here is
on the critical path, and the verified beta currently on the phone came from
`alex/icup-ble-health`, not this branch.

**The glass module is the long pole.** A Fabric view component is more codegen
than the Turbo Module that preceded it, and it needs a native rebuild to test
at all. If it slips, the redesign should ship with the View-based fallback and
the material swapped in behind the same component afterwards, which touches one
file.

**Adaptive reminders are real logic.** A constant gap cannot be wrong. A
function of time of day and deficit can be, which is why it is unit tested
first.

**The single-screen layout has no slack for growth.** If the app outgrows one
screen, the contained change is a pinned hero with scrollable detail beneath.

## Out of scope

- The History screen, beyond the tab bar change.
- Onboarding and the splash screen.
- The remaining drop-expo steps 2 through 9.
- The app icon, which is separate work already agreed: a half-filled water
  droplet in the current palette.
