export interface PreprocessedScreenshot {
  dataUrl: string;
  previewUrl: string;
  wasInverted: boolean;
  width: number;
  height: number;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = src;
  });
}

/**
 * Prepares a pasted WhatsApp/Slack/email screenshot for offline Tesseract OCR:
 * - Upscales small captures for crisper character recognition.
 * - Detects dark-mode chat screenshots by sampling luminance and inverts them
 *   to dark-text-on-light-background with gentle contrast enhancement.
 */
export async function preprocessScreenshotForOcr(
  file: Blob,
  options: { autoInvertDark?: boolean } = {},
): Promise<PreprocessedScreenshot> {
  const autoInvertDark = options.autoInvertDark ?? true;
  const previewUrl = await readBlobAsDataUrl(file);
  const img = await loadImage(previewUrl);

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) {
    throw new Error("Screenshot has invalid dimensions.");
  }

  // Upscale small screenshots up to 1.75x (capped at 2000px) so small UI text reads cleanly
  let scale = 1;
  const maxDim = Math.max(srcW, srcH);
  if (maxDim < 1000) {
    scale = Math.min(1.75, 1400 / maxDim);
  } else if (maxDim > 2200) {
    scale = 2200 / maxDim;
  }

  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { dataUrl: previewUrl, previewUrl, wasInverted: false, width: srcW, height: srcH };
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Estimate average luminance by striding across pixels
  let lumaSum = 0;
  let sampleCount = 0;
  const stride = Math.max(4, Math.floor((pixels.length / 4) / 15_000) * 4);
  for (let i = 0; i < pixels.length; i += stride) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
    sampleCount += 1;
  }
  const avgLuma = sampleCount > 0 ? lumaSum / sampleCount : 255;
  const isDarkMode = avgLuma < 118;
  const shouldInvert = autoInvertDark && isDarkMode;

  // Apply grayscale + gentle contrast stretch (and invert if dark-mode screenshot)
  const contrast = shouldInvert ? 1.25 : 1.12;
  for (let i = 0; i < pixels.length; i += 4) {
    let gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    if (shouldInvert) gray = 255 - gray;
    gray = (gray - 128) * contrast + 128;
    const clamped = Math.max(0, Math.min(255, Math.round(gray)));
    pixels[i] = clamped;
    pixels[i + 1] = clamped;
    pixels[i + 2] = clamped;
    pixels[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    previewUrl,
    wasInverted: shouldInvert,
    width,
    height,
  };
}
