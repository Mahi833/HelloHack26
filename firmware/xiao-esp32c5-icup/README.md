# iCup firmware (Seeed XIAO ESP32-C5)

Streams load-cell weight to the app over BLE, and takes two commands back:
zero the scale, and light the ring red when it is time to drink.

## Wiring

| Part | Pin |
| --- | --- |
| HX711 DT | D4 |
| HX711 SCK | D5 |
| HX711 VCC | 3V3 |
| HX711 GND | GND |
| WS2812 ring DIN | D1 |
| WS2812 ring 5V | 5V |
| WS2812 ring GND | GND |

`LED_DATA_PIN`, `LED_COUNT` and `LED_BRIGHTNESS` sit at the top of the sketch.
Change `LED_COUNT` to however many pixels are on the bottle.

## Arduino IDE setup

1. Install the Seeed XIAO ESP32-C5 board support as described in [Seeed's getting started guide](https://wiki.seeedstudio.com/xiao_esp32c5_getting_started/); select **XIAO_ESP32C5**.
2. Install **HX711_ADC**, **NimBLE-Arduino** and **Adafruit NeoPixel** from Library Manager.
3. Open `xiao-esp32c5-icup.ino`, select the XIAO's USB port, and upload.
4. Open the Serial Monitor at **57600 baud**. The board prints its BLE name and all four UUIDs at startup.
5. In nRF Connect, scan for **iCup**, connect, enable notifications on the weight characteristic and confirm JSON such as `{"weight_g":312.4}`. Writing `1` to the alert characteristic should flash the ring red.

It keeps the EEPROM calibration value (backup `491.83`) and the Serial Monitor `t` tare command from `sketch_sep26a.ino`.

## BLE contract

The app scans for the service UUID, so these must match
`src/contexts/icup-ble-context.tsx` exactly.

| Characteristic | UUID | Properties | Payload |
| --- | --- | --- | --- |
| Service | `7a1e0001-5c2b-4e3a-9f6d-2b8c0a4d1e01` | | |
| Weight | `7a1e0002-5c2b-4e3a-9f6d-2b8c0a4d1e01` | read, notify | `{"weight_g":312.4}` every 250 ms |
| Tare | `7a1e0003-5c2b-4e3a-9f6d-2b8c0a4d1e01` | write | `t` |
| Drink alert | `7a1e0004-5c2b-4e3a-9f6d-2b8c0a4d1e01` | write | `1` flash red, `0` back to the gauge |

## How a drink gets logged

The ring streams grams. `src/ble/sip-detector.ts` watches for the weight
settling at a lower value than before and converts the drop to millilitres, so
picking the bottle up and putting it back down is what logs the drink. Nothing
is logged while the reading is still moving.

## What the ring shows

Resting state is a water gauge. The lit pixel count tracks the weight on the
scale against `FULL_BOTTLE_G`, so a full bottle lights the whole ring and an
empty one goes dark. Lit pixels are the same blue as the app, `#45A9C9`.

`src/ble/drink-alert.ts` decides when to interrupt that. It calls for an alert
once the reminder interval has passed since the last logged drink, and stands
down as soon as a drink lands, the daily goal is met, or reminders are off. On
an alert the ring flashes red for 5 seconds at roughly 3 Hz, then returns to
the water gauge on its own. The app pushes the change only while it is
connected and in the foreground.

Tare with an empty bottle on the scale so the reading is the water alone, then
set `FULL_BOTTLE_G` to what a full bottle of water weighs in grams.

