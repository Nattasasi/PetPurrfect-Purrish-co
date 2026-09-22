import * as ort from "onnxruntime-web/wasm";
import ortWasmUrl from "./ort-runtime/ort-wasm-simd-threaded.wasm?url";
import ortWasmMjsUrl from "./ort-runtime/ort-wasm-simd-threaded.mjs?url";
import { BREED_LABELS } from "./breedLabels";

// onnxruntime-web's package exports don't expose its dist/ files as a
// subpath, so the runtime is vendored under ./ort-runtime and imported as a
// relative asset — this resolves correctly in both Vite dev and build.
ort.env.wasm.wasmPaths = {
  wasm: ortWasmUrl,
  mjs: ortWasmMjsUrl
};
ort.env.wasm.numThreads = 1;

const MODEL_URL = "/models/breed_classifier.onnx";
const INPUT_SIZE = 224;
const RESIZE_SIZE = 256;
// Standard torchvision ImageNet normalization; the fine-tune was trained with
// the default Resize(256) -> CenterCrop(224) -> Normalize preprocessing.
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

function preprocess(imageElement) {
  const resizeCanvas = document.createElement("canvas");
  resizeCanvas.width = RESIZE_SIZE;
  resizeCanvas.height = RESIZE_SIZE;
  const resizeCtx = resizeCanvas.getContext("2d");
  resizeCtx.drawImage(imageElement, 0, 0, RESIZE_SIZE, RESIZE_SIZE);

  const cropOffset = (RESIZE_SIZE - INPUT_SIZE) / 2;
  const { data } = resizeCtx.getImageData(cropOffset, cropOffset, INPUT_SIZE, INPUT_SIZE);

  const plane = INPUT_SIZE * INPUT_SIZE;
  const chwData = new Float32Array(3 * plane);

  for (let i = 0; i < plane; i++) {
    chwData[i] = (data[i * 4] / 255 - MEAN[0]) / STD[0];
    chwData[plane + i] = (data[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
    chwData[plane * 2 + i] = (data[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }

  return new ort.Tensor("float32", chwData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / sum);
}

// Classifies a cropped pet image with the fine-tuned MobileNetV3-Large model
// (47 cat/dog breed classes). Returns null if the model can't be loaded/run,
// so callers can fall back to heuristic attributes.
export async function classifyBreed(imageElement) {
  try {
    const session = await loadSession();
    const input = preprocess(imageElement);
    const results = await session.run({ input });
    const outputName = session.outputNames[0];
    const logits = Array.from(results[outputName].data);
    const probabilities = softmax(logits);

    const ranked = probabilities
      .map((probability, index) => ({ probability, label: BREED_LABELS[index] }))
      .filter((entry) => entry.label)
      .sort((a, b) => b.probability - a.probability);

    const [best, ...rest] = ranked;
    if (!best) {
      return null;
    }

    return {
      id: best.label.id,
      friendly: best.label.friendly,
      petType: best.label.petType,
      earStyle: best.label.earStyle,
      confidence: best.probability,
      alternatives: rest.slice(0, 4).map((entry) => ({
        className: entry.label.friendly,
        probability: entry.probability
      }))
    };
  } catch {
    return null;
  }
}
