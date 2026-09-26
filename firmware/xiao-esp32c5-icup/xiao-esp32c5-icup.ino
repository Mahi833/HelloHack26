/*
  iCup BLE load-cell firmware for Seeed XIAO ESP32-C5

  HX711 DT   -> D4
  HX711 SCK  -> D5
  HX711 VCC  -> 3V3
  HX711 GND  -> GND

  Keeps the saved HX711_ADC calibration value and Serial Monitor tare command
  from sketch_sep26a.ino. BLE clients can read or subscribe to the weight
  characteristic, which contains UTF-8 JSON such as {"weight_g":312.4}.
*/

#include <HX711_ADC.h>
#include <EEPROM.h>
#include <NimBLEDevice.h>
#include <stdio.h>
#include <string.h>

static const char* DEVICE_NAME = "iCup";
static const char* SERVICE_UUID = "a82f0001-4ef3-4b7a-9c2d-5bd3a1e0c101";
static const char* WEIGHT_CHARACTERISTIC_UUID = "a82f0002-4ef3-4b7a-9c2d-5bd3a1e0c101";

const int HX711_dout = D4;
const int HX711_sck = D5;
HX711_ADC LoadCell(HX711_dout, HX711_sck);

const int calVal_eepromAdress = 0;
const float BACKUP_CAL_VALUE = 491.83;
unsigned long lastSampleSentAt = 0;
static const unsigned long SAMPLE_INTERVAL_MS = 250;

NimBLECharacteristic* weightCharacteristic = nullptr;

class IcupServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server, NimBLEConnInfo& connInfo) override {
    (void)server;
    (void)connInfo;
    Serial.println("BLE client connected");
  }

  void onDisconnect(NimBLEServer* server, NimBLEConnInfo& connInfo, int reason) override {
    (void)server;
    (void)connInfo;
    Serial.printf("BLE client disconnected (reason %d); advertising again\n", reason);
    NimBLEDevice::startAdvertising();
  }
};

void startBleServer() {
  NimBLEDevice::init(DEVICE_NAME);

  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new IcupServerCallbacks());

  NimBLEService* service = server->createService(SERVICE_UUID);
  weightCharacteristic = service->createCharacteristic(
    WEIGHT_CHARACTERISTIC_UUID,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );
  weightCharacteristic->setValue("{\"weight_g\":0.0}");
  service->start();

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->start();

  Serial.print("BLE advertising as ");
  Serial.println(DEVICE_NAME);
  Serial.print("Service UUID: ");
  Serial.println(SERVICE_UUID);
  Serial.print("Weight characteristic UUID: ");
  Serial.println(WEIGHT_CHARACTERISTIC_UUID);
}

void setup() {
  Serial.begin(57600);
  delay(2000);
  Serial.println();
  Serial.println("Starting iCup load-cell reader...");

  float calibrationValue;
  EEPROM.begin(512);
  EEPROM.get(calVal_eepromAdress, calibrationValue);
  if (isnan(calibrationValue) || calibrationValue <= 0) {
    calibrationValue = BACKUP_CAL_VALUE;
    Serial.println("No saved calibration found; using backup value 491.83");
  }
  Serial.print("Calibration value: ");
  Serial.println(calibrationValue);

  LoadCell.begin();
  LoadCell.start(2000, true);
  if (LoadCell.getTareTimeoutFlag() || LoadCell.getSignalTimeoutFlag()) {
    Serial.println("HX711 timeout; check DT -> D4 and SCK -> D5");
    while (true) delay(1000);
  }
  LoadCell.setCalFactor(calibrationValue);

  startBleServer();
  Serial.println("Ready. Weight in grams. Send 't' over Serial to tare.");
}

void loop() {
  static bool newDataReady = false;
  if (LoadCell.update()) newDataReady = true;

  const unsigned long now = millis();
  if (newDataReady && now - lastSampleSentAt >= SAMPLE_INTERVAL_MS) {
    const float grams = LoadCell.getData();
    char payload[48];
    snprintf(payload, sizeof(payload), "{\"weight_g\":%.1f}", static_cast<double>(grams));

    weightCharacteristic->setValue(
      reinterpret_cast<const uint8_t*>(payload),
      strlen(payload)
    );
    weightCharacteristic->notify();

    Serial.print("Weight: ");
    Serial.print(grams, 1);
    Serial.println(" g");
    newDataReady = false;
    lastSampleSentAt = now;
  }

  if (Serial.available() > 0 && Serial.read() == 't') {
    LoadCell.tareNoDelay();
  }
  if (LoadCell.getTareStatus()) {
    Serial.println("Zeroed");
  }
}
