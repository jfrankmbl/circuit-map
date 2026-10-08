// Fixture types. heightIn is the default height above the floor in inches (null = ceiling or not applicable).
// sweep = shown in the breaker test list (things that go dead when a breaker is off).
export const GROUPS = [["outlet", "Outlets"], ["switch", "Switches"], ["light", "Lights"], ["other", "Other"], ["custom", "Something else"]];

const t = (name, group, heightIn, sweep) => ({ name, group, heightIn, sweep });

export const TYPES = {
  D: t("Duplex outlet", "outlet", 12, true),
  G: t("GFCI outlet", "outlet", 12, true),
  R: t("240 V outlet", "outlet", 12, true),
  FO: t("Floor outlet", "outlet", 0, true),
  WP: t("Exterior outlet", "outlet", 18, true),
  S: t("Switch", "switch", 48, false),
  S3: t("3-way switch", "switch", 48, false),
  S4: t("4-way switch", "switch", 48, false),
  DM: t("Dimmer", "switch", 48, false),
  FC: t("Fan control", "switch", 48, false),
  L: t("Ceiling light", "light", null, true),
  RL: t("Recessed light", "light", null, true),
  SC: t("Wall sconce", "light", 66, true),
  F: t("Ceiling fan", "light", null, true),
  UC: t("Under-cabinet light", "light", 54, true),
  FL: t("Flood light", "light", null, true),
  SM: t("Smoke / CO alarm", "other", null, true),
  EF: t("Exhaust fan", "other", null, true),
  TS: t("Thermostat", "other", 60, false),
  DB: t("Doorbell transformer", "other", null, true),
  J: t("Junction box / blank plate", "other", 12, false),
  HA: t("Hard-wired appliance", "other", null, true),
  BP: t("Breaker panel", "other", 60, false),
  SP: t("Subpanel", "other", 60, false),
  MN: t("Meter", "other", 60, false),
  X: t("Something else", "custom", null, true),
};

export function typeInfo(type) {
  return TYPES[type] || TYPES.X;
}

export function displayName(device) {
  return device.customName || typeInfo(device.type).name;
}

// Outlets whose top and bottom halves can be switched separately.
export function hasHalves(type) {
  return ["D", "G", "WP"].includes(type);
}

export function isSwitch(type) {
  return typeInfo(type).group === "switch";
}
