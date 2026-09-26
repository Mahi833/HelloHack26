# XIAO ESP32-C5 iCup BLE firmware

This sketch wraps the calibrated HX711 reader from `sketch_sep26a.ino` with a BLE GATT server. It retains the EEPROM calibration value (backup `491.83`) and the Serial Monitor `t` tare command.

## Arduino IDE setup

1. Install the Seeed XIAO ESP32-C5 board support as described in [Seeed's getting started guide](https://wiki.seeedstudio.com/xiao_esp32c5_getting_started/); select **XIAO_ESP32C5**.
2. Install the **HX711_ADC** library and **NimBLE-Arduino** from Library Manager.
3. Open `xiao-esp32c5-icup.ino`, select the XIAO's USB port, and upload.
4. Open the Serial Monitor at **57600 baud**. The board prints its BLE name and UUIDs at startup.
5. In nRF Connect, scan for **iCup**, connect, find the service and weight characteristic UUIDs printed in Serial Monitor, then enable notifications. Values are JSON, for example `{"weight_g":312.4}`.

BLE UUIDs are constants near the top of the sketch. Keep them unchanged when configuring the phone app to connect.
