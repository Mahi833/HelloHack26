#include <HX711_ADC.h>
#include <EEPROM.h>
#include <NimBLEDevice.h>
#include <Adafruit_NeoPixel.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

static const char* DEVICE_NAME = "iCup";
static const char* SERVICE_UUID = "7a1e0001-5c2b-4e3a-9f6d-2b8c0a4d1e01";
static const char* WEIGHT_CHARACTERISTIC_UUID = "7a1e0002-5c2b-4e3a-9f6d-2b8c0a4d1e01";
static const char* TARE_CHARACTERISTIC_UUID = "7a1e0003-5c2b-4e3a-9f6d-2b8c0a4d1e01";
static const char* ALERT_CHARACTERISTIC_UUID = "7a1e0004-5c2b-4e3a-9f6d-2b8c0a4d1e01";

const int HX711_dout = D4;
const int HX711_sck = D5;
HX711_ADC LoadCell(HX711_dout, HX711_sck);

const int LED_DATA_PIN = D1;
const int LED_COUNT = 12;
const uint8_t LED_BRIGHTNESS = 120;
Adafruit_NeoPixel ring(LED_COUNT, LED_DATA_PIN, NEO_GRB + NEO_KHZ800);

const float FULL_BOTTLE_G = 500.0;
const float BOTTLE_EMPTY_BELOW_G = 15.0;
const uint8_t WATER_RED = 69;
const uint8_t WATER_GREEN = 169;
const uint8_t WATER_BLUE = 201;

static const unsigned long ALERT_FLASH_MS = 5000;
static const unsigned long ALERT_BLINK_MS = 300;

const int calVal_eepromAdress = 0;
const float BACKUP_CAL_VALUE = 491.83;
unsigned long lastSampleSentAt = 0;
static const unsigned long SAMPLE_INTERVAL_MS = 250;

static const char TARE_COMMAND = 't';
static const char ALERT_ON_COMMAND = '1';
static const char ALERT_OFF_COMMAND = '0';

NimBLECharacteristic* weightCharacteristic = nullptr;
bool tareRequested = false;
bool alertOn = false;
bool alertLit = false;
unsigned long alertStartedAt = 0;
unsigned long lastBlinkAt = 0;
int litPixels = 0;

void renderRing() {
  if (alertOn) {
    const uint32_t colour = alertLit ? ring.Color(255, 0, 0) : ring.Color(0, 0, 0);
    for (int pixel = 0; pixel < LED_COUNT; pixel++) {
      ring.setPixelColor(pixel, colour);
    }
    ring.show();
    return;
  }
  for (int pixel = 0; pixel < LED_COUNT; pixel++) {
    const bool lit = pixel < litPixels;
    ring.setPixelColor(
      pixel,
      lit ? ring.Color(WATER_RED, WATER_GREEN, WATER_BLUE) : ring.Color(0, 0, 0)
    );
  }
  ring.show();
}

int pixelsForWeight(float grams) {
  if (grams < BOTTLE_EMPTY_BELOW_G) return 0;
  const float level = grams / FULL_BOTTLE_G;
  int pixels = static_cast<int>(lroundf(level * LED_COUNT));
  if (pixels < 1) pixels = 1;
  if (pixels > LED_COUNT) pixels = LED_COUNT;
  return pixels;
}

void showWaterLevel(float grams) {
  const int pixels = pixelsForWeight(grams);
  if (pixels == litPixels) return;
  litPixels = pixels;
  if (!alertOn) renderRing();
}

void showDrinkAlert() {
  if (alertOn) return;
  alertOn = true;
  alertLit = true;
  alertStartedAt = millis();
  lastBlinkAt = alertStartedAt;
  renderRing();
  Serial.println("Drink alert on: flashing red for 5 s");
}

void clearDrinkAlert() {
  alertOn = false;
  renderRing();
  Serial.println("Drink alert off: ring is back to the water level");
}

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
    clearDrinkAlert();
    NimBLEDevice::startAdvertising();
  }
};

class TareCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connInfo) override {
    (void)connInfo;
    const std::string value = characteristic->getValue();
    if (value.empty() || value[0] == TARE_COMMAND) {
      tareRequested = true;
      Serial.println("Tare requested over BLE");
    }
  }
};

class AlertCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connInfo) override {
    (void)connInfo;
    const std::string value = characteristic->getValue();
    if (value.empty()) return;
    if (value[0] == ALERT_ON_COMMAND) showDrinkAlert();
    if (value[0] == ALERT_OFF_COMMAND) clearDrinkAlert();
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

  NimBLECharacteristic* tareCharacteristic = service->createCharacteristic(
    TARE_CHARACTERISTIC_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
  );
  tareCharacteristic->setCallbacks(new TareCallbacks());

  NimBLECharacteristic* alertCharacteristic = service->createCharacteristic(
    ALERT_CHARACTERISTIC_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
  );
  alertCharacteristic->setCallbacks(new AlertCallbacks());

  service->start();

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setName(DEVICE_NAME);
  advertising->enableScanResponse(true);
  advertising->start();

  Serial.print("BLE advertising as ");
  Serial.println(DEVICE_NAME);
  Serial.print("Service UUID: ");
  Serial.println(SERVICE_UUID);
  Serial.print("Weight characteristic UUID: ");
  Serial.println(WEIGHT_CHARACTERISTIC_UUID);
  Serial.print("Tare characteristic UUID: ");
  Serial.println(TARE_CHARACTERISTIC_UUID);
  Serial.print("Drink alert characteristic UUID: ");
  Serial.println(ALERT_CHARACTERISTIC_UUID);
}

void setup() {
  Serial.begin(57600);
  delay(2000);
  Serial.println();
  Serial.println("Starting iCup load-cell reader...");

  ring.begin();
  ring.setBrightness(LED_BRIGHTNESS);
  clearDrinkAlert();

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

    showWaterLevel(grams);

    Serial.print("Weight: ");
    Serial.print(grams, 1);
    Serial.println(" g");
    newDataReady = false;
    lastSampleSentAt = now;
  }

  if (alertOn) {
    if (now - alertStartedAt >= ALERT_FLASH_MS) {
      clearDrinkAlert();
    } else if (now - lastBlinkAt >= ALERT_BLINK_MS) {
      lastBlinkAt = now;
      alertLit = !alertLit;
      renderRing();
    }
  }

  if (tareRequested) {
    tareRequested = false;
    LoadCell.tareNoDelay();
  }
  if (Serial.available() > 0 && Serial.read() == TARE_COMMAND) {
    LoadCell.tareNoDelay();
  }
  if (LoadCell.getTareStatus()) {
    Serial.println("Zeroed");
  }
}
