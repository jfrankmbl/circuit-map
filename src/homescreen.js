// The Home Screen matters on an iPhone: an app added to it has its own storage, which starts empty. No DOM here.

// Whether this is an iPhone (or iPad) browser tab, rather than the app opened from the Home Screen.
// env: { ua, platform, touchPoints, standalone } read from navigator by the caller.
export function inIphoneTab({ ua = "", platform = "", touchPoints = 0, standalone = false }) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1); // an iPad can say it is a Mac
  return ios && !standalone && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export const HOME_CARD = "Add this to your Home Screen first. Tap Share, then Add to Home Screen, then open Circuit Map from your Home Screen.";

export const HOME_NOTE = "If you add this to your Home Screen, the new app starts empty. First tap Send or back up. Then open the Home Screen app and choose I already have a project file.";
