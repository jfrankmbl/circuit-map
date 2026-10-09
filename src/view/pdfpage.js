// A PDF as a floor picture: read the file, let him pick a page when there are several, give back that page as an image.
import { pdfScale } from "../picture.js";
import { h, button, openSheet } from "../ui.js";

const THUMB = 320; // pixels on the longest side of a page thumbnail (shown at about 150 to 220 CSS pixels)

let reader; // pdf.js, loaded the first time a PDF is chosen
async function pdfjs() {
  if (!reader) {
    reader = await import("../../vendor/pdf.js/pdf.min.mjs");
    reader.GlobalWorkerOptions.workerSrc = new URL("../../vendor/pdf.js/pdf.worker.min.mjs", import.meta.url).href;
  }
  return reader;
}

async function draw(doc, number, longSide) {
  const page = await doc.getPage(number);
  const size = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: pdfScale(size.width, size.height, longSide) });
  const canvas = h("canvas", { width: Math.round(viewport.width), height: Math.round(viewport.height) });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // a PDF page has no background of its own
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// Resolves with an ImageBitmap of the page, or null if he cancelled. Throws an Error whose message can be shown as is.
export async function pickPdfPage(file, longSide) {
  let doc;
  try {
    doc = await (await pdfjs()).getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (err) {
    throw new Error(err && err.name === "PasswordException"
      ? "This PDF is locked with a password. Open it in Preview, choose File > Export as PDF without the password, and try again."
      : "This PDF can't be opened here. Take a screenshot of the page and choose that instead.");
  }
  const page = (number) => draw(doc, number, longSide).then((canvas) => createImageBitmap(canvas));
  if (doc.numPages === 1) return page(1);
  return new Promise((resolve, reject) => {
    openSheet("Which page is the floor?", (close) => {
      const grid = h("div", { class: "pages" });
      for (let n = 1; n <= doc.numPages; n++) {
        const cell = h("button", { type: "button", class: "page-thumb", "aria-label": `Page ${n}`, onclick: () => {
          close();
          page(n).then(resolve, reject);
        } }, h("span", {}, `Page ${n} of ${doc.numPages}`));
        grid.append(cell);
        draw(doc, n, THUMB).then((canvas) => cell.prepend(canvas)).catch(() => {});
      }
      return [grid, button("Cancel", () => { close(); resolve(null); })];
    });
  });
}
