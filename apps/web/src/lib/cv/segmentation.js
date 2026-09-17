import * as ort from "onnxruntime-web/wasm";
import ortWasmUrl from "./ort-runtime/ort-wasm-simd-threaded.wasm?url";
import ortWasmMjsUrl from "./ort-runtime/ort-wasm-simd-threaded.mjs?url";

// Same vendored wasm runtime as breedClassifier.js; setting this again here
// is harmless (onnxruntime-web is a shared module instance either way).
ort.env.wasm.wasmPaths = {
  "ort-wasm-simd-threaded.wasm": ortWasmUrl,
  "ort-wasm-simd-threaded.mjs": ortWasmMjsUrl
};
ort.env.wasm.numThreads = 1;

const MODEL_URL = "/models/u2netp.onnx";
const INPUT_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let sessionPromise = null;

function loadSession() {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"]
    });
  }
  return sessionPromise;
}

function preprocess(imageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const context = canvas.getContext("2d");
  context.drawImage(imageSource, 0, 0, INPUT_SIZE, INPUT_SIZE);

  const { data } = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  const chwData = new Float32Array(3 * plane);

  for (let i = 0; i < plane; i++) {
    chwData[i] = (data[i * 4] / 255 - MEAN[0]) / STD[0];
    chwData[plane + i] = (data[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
    chwData[plane * 2 + i] = (data[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }

  return new ort.Tensor("float32", chwData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

// Runs U^2-Netp (a lightweight salient-object segmentation model) on an
// image/canvas and returns a foreground-probability mask resampled onto a
// maskSize x maskSize grid (row-major Float32Array, 0..1). Returns null if
// the model can't be loaded/run, so callers can fall back to heuristics.
export async function getForegroundMask(imageSource, maskSize) {
  try {
    const session = await loadSession();
    const input = preprocess(imageSource);
    const results = await session.run({ [session.inputNames[0]]: input });
    // The model's first output is the final fused saliency map (the other
    // outputs are intermediate side-outputs used only during training).
    const output = results[session.outputNames[0]];
    const data = output.data;

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    const range = max - min || 1;

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = INPUT_SIZE;
    maskCanvas.height = INPUT_SIZE;
    const maskContext = maskCanvas.getContext("2d");
    const maskImageData = maskContext.createImageData(INPUT_SIZE, INPUT_SIZE);
    for (let i = 0; i < data.length; i++) {
      const value = Math.round(((data[i] - min) / range) * 255);
      maskImageData.data[i * 4] = value;
      maskImageData.data[i * 4 + 1] = value;
      maskImageData.data[i * 4 + 2] = value;
      maskImageData.data[i * 4 + 3] = 255;
    }
    maskContext.putImageData(maskImageData, 0, 0);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = maskSize;
    outCanvas.height = maskSize;
    const outContext = outCanvas.getContext("2d");
    outContext.drawImage(maskCanvas, 0, 0, maskSize, maskSize);
    const outData = outContext.getImageData(0, 0, maskSize, maskSize).data;

    const mask = new Float32Array(maskSize * maskSize);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = outData[i * 4] / 255;
    }
    return mask;
  } catch {
    return null;
  }
}

// Renders the cropped pet region with the mask overlaid (green = kept as
// foreground, red = excluded as background) for the debug panel, so it's
// visible which pixels actually fed the color extraction.
export function createSegmentationDebugImage(croppedCanvas, mask, maskSize) {
  if (!mask) {
    return "";
  }

  const width = croppedCanvas.width;
  const height = croppedCanvas.height;
  if (!width || !height) {
    return "";
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }
  context.drawImage(croppedCanvas, 0, 0, width, height);

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = maskSize;
  overlayCanvas.height = maskSize;
  const overlayContext = overlayCanvas.getContext("2d");
  const overlayData = overlayContext.createImageData(maskSize, maskSize);
  for (let i = 0; i < mask.length; i++) {
    const kept = mask[i] >= 0.15;
    overlayData.data[i * 4] = kept ? 0 : 220;
    overlayData.data[i * 4 + 1] = kept ? 200 : 0;
    overlayData.data[i * 4 + 2] = 0;
    overlayData.data[i * 4 + 3] = 110;
  }
  overlayContext.putImageData(overlayData, 0, 0);

  context.imageSmoothingEnabled = false;
  context.drawImage(overlayCanvas, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}
