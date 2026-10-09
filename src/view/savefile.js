// Hand a file to him: the Share sheet on a phone (Save to Files, AirDrop, Mail), a download on a computer.
import { h, toast } from "../ui.js";

// Whether saveFile would open the Share sheet for a file of this name and type, rather than download it.
export function willShare(name, type) {
  return matchMedia("(pointer: coarse)").matches && !!navigator.canShare && navigator.canShare({ files: [new File([""], name, { type })] });
}

// True once the file has been handed over; false if he closed the Share sheet without choosing anything. If sharing
// is refused the file is downloaded instead. note is added to the message after a download, which then stays up.
export async function saveFile(name, text, type, note = "") {
  const file = new File([text], name, { type });
  if (willShare(name, type)) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      if (err.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(file);
  h("a", { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast(`Saved to your Downloads folder as ${name}.${note && " " + note}`, note && { text: "OK", run: () => {} });
  return true;
}
