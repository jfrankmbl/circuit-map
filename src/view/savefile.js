// Hand a file to him: the Share sheet on a phone (Save to Files, AirDrop, Mail), a download on a computer.
import { h, toast } from "../ui.js";

export async function saveFile(name, text, type) {
  const file = new File([text], name, { type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err.name === "AbortError") return; // he closed the Share sheet
    }
  }
  const url = URL.createObjectURL(file);
  h("a", { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast(`Saved to your Downloads folder as ${name}.`);
}
