/*
  Smart Office - One Room Demo
  ESP32 + DIP Switches + Relays + PIR + Potentiometers
*/

const int switchPins[5] = {33, 14, 27, 26, 25};
const int relayPins[5]  = {18, 5, 17, 4, 19};

// Potentiometers
const int currentPins[5] = {
  12,
  34,
  32,
  35,   // Change your wiring to GPIO35
  39    // Change your wiring to GPIO39
};

const int pirPin = 0;

const char* names[5] = {
  "Light 1",
  "Light 2",
  "Light 3",
  "Fan 1",
  "Fan 2"
};

const float voltage = 220.0;
const float sensitivity = 0.1;

bool occupied = false;
unsigned long lastMotion = 0;
const unsigned long timeout = 30000;

void setup() {

  Serial.begin(115200);

  for (int i = 0; i < 5; i++) {

    pinMode(switchPins[i], INPUT_PULLUP);

    pinMode(relayPins[i], OUTPUT);

    // Wokwi relay OFF (Active LOW)
    digitalWrite(relayPins[i], HIGH);
  }

  pinMode(pirPin, INPUT);

  Serial.println("System Started");
}

void loop() {

  // ---------------- PIR ----------------

  if (digitalRead(pirPin) == HIGH) {
    occupied = true;
    lastMotion = millis();
  }

  if (occupied && millis() - lastMotion > timeout) {
    occupied = false;
  }

  float totalPower = 0;

  Serial.println();
  Serial.println("-----------------------------------------");
  Serial.print("Room : ");
  Serial.println(occupied ? "Occupied" : "Empty");
  Serial.println("-----------------------------------------");

  for (int i = 0; i < 5; i++) {

    bool sw = digitalRead(switchPins[i]) == LOW;

    // Relay control (Wokwi relay = Active LOW)
    if (occupied && sw)
      digitalWrite(relayPins[i], LOW);     // ON
    else
      digitalWrite(relayPins[i], HIGH);    // OFF

    float current = 0;
    float power = 0;

    if (occupied && sw) {

      int raw = analogRead(currentPins[i]);

      float sensorVoltage = (raw / 4095.0) * 3.3;

      current = sensorVoltage / sensitivity;

      power = current * voltage;

      totalPower += power;
    }

    Serial.print(names[i]);
    Serial.print(" : ");

    if (occupied && sw)
      Serial.print("ON");
    else
      Serial.print("OFF");

    Serial.print(" | Current: ");
    Serial.print(current, 2);
    Serial.print(" A");

    Serial.print(" | Power: ");
    Serial.print(power, 1);
    Serial.println(" W");
  }

  Serial.println("-----------------------------------------");

  Serial.print("Voltage : ");
  Serial.print(voltage);
  Serial.println(" V");

  Serial.print("Total Power : ");
  Serial.print(totalPower, 1);
  Serial.println(" W");

  delay(250);
}