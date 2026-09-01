import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as mobilenet from "@tensorflow-models/mobilenet";
import { matchBreed } from "./breedCatalog";
import { detectPetParts } from "./partDetection";

const MIN_DETECTION_SCORE = 0.2;
const BOX_PADDING_RATIO = 0.12;

let cocoModelPromise = null;
let mobilenetModelPromise = null;

async function loadCocoModel() {
  if (!cocoModelPromise) {
    cocoModelPromise = cocoSsd.load();
  }

  return cocoModelPromise;
}

async function loadMobilenetModel() {
  if (!mobilenetModelPromise) {
    mobilenetModelPromise = mobilenet.load({ version: 2, alpha: 1.0 });
  }

  return mobilenetModelPromise;
}

function isPetLabel(label = "") {
  const value = label.toLowerCase();
  return value.includes("cat") || value.includes("dog") || value.includes("animal") || value.includes("person");
}

function fallbackAttributes(imageElement) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return {
      furColor: "golden",
      earStyle: "floppy",
      faceShape: "round"
    };
  }

  const sampleSize = 48;
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  context.drawImage(imageElement, 0, 0, sampleSize, sampleSize);

  const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
  let red = 0;
  let green = 0;
  let blue = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
  }

  const count = pixels.length / 4;
  const averageRed = red / count;
  const averageGreen = green / count;
  const averageBlue = blue / count;
  const brightness = (averageRed + averageGreen + averageBlue) / 3;
  const maxChannel = Math.max(averageRed, averageGreen, averageBlue);

  let furColor = "golden";
  if (averageRed > averageGreen * 1.2 && averageRed > averageBlue * 1.1) {
    furColor = "ginger";
  } else if (averageBlue > averageRed && averageBlue > averageGreen) {
    furColor = "silver";
  } else if (brightness < 90) {
    furColor = "charcoal";
  } else if (averageGreen > averageRed * 1.15 && averageGreen > averageBlue * 1.15) {
    furColor = "mint";
  }

  return {
    furColor,
    earStyle: maxChannel < 120 ? "pointed" : "floppy",
    faceShape: imageElement.width / imageElement.height > 1.15 ? "long" : "round"
  };
}

// Expands the detected box so ears/tail/paws near the edges aren't cropped,
// clamped to the image bounds.
function padBox(box, imageElement) {
  const padX = box.width * BOX_PADDING_RATIO;
  const padY = box.height * BOX_PADDING_RATIO;

  const x = Math.max(0, box.x - padX);
  const y = Math.max(0, box.y - padY);
  const right = Math.min(imageElement.width, box.x + box.width + padX);
  const bottom = Math.min(imageElement.height, box.y + box.height + padY);

  return { x, y, width: right - x, height: bottom - y };
}

function cropToCanvas(imageElement, box) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = Math.max(1, Math.round(box.width));
  canvas.height = Math.max(1, Math.round(box.height));

  if (context) {
    context.drawImage(imageElement, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height);
  }

  return canvas;
}

export function createPetDebugImage(imageElement, inference) {
  if (!imageElement || !inference?.validPet) {
    return "";
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return "";
  }

  canvas.width = imageElement.width;
  canvas.height = imageElement.height;
  context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/png");
}

export async function runPetInference(imageElement) {
  if (!imageElement) {
    return {
      detected: false,
      validPet: false,
      attributes: {},
      breed: "Unknown breed",
      reason: "No image supplied"
    };
  }

  try {
    await tf.ready();
    const [cocoModel, breedModel] = await Promise.all([loadCocoModel(), loadMobilenetModel()]);
    const predictions = await cocoModel.detect(imageElement, 10, MIN_DETECTION_SCORE);

    const petCandidates = predictions
      .filter((item) => isPetLabel(item.class || ""))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const bestMatch = petCandidates[0];

    if (!bestMatch) {
      return {
        detected: false,
        validPet: false,
        attributes: fallbackAttributes(imageElement),
        breed: "Unknown breed",
        reason: "We couldn't clearly detect a cat or dog in this photo. Try a clearer, well-lit photo with the pet fully in frame."
      };
    }

    const [boxX, boxY, boxWidth, boxHeight] = bestMatch.bbox;
    const overallBox = padBox({ x: boxX, y: boxY, width: boxWidth, height: boxHeight }, imageElement);

    const fallback = fallbackAttributes(imageElement);
    const aspectRatio = overallBox.width / Math.max(overallBox.height, 1);

    // Classify the cropped pet region (rather than the whole photo) so the
    // breed model isn't distracted by background clutter.
    const croppedCanvas = cropToCanvas(imageElement, overallBox);
    const breedPredictions = await breedModel.classify(croppedCanvas, 5);
    const breedMatch = matchBreed(breedPredictions);

    const partResult = detectPetParts(croppedCanvas);
    const partBoxes = partResult.boxes.map((box) => ({
      ...box,
      x: box.x + overallBox.x,
      y: box.y + overallBox.y
    }));

    const detectionLabel = bestMatch.class?.toLowerCase() || "";
    const petType = breedMatch?.petType || (detectionLabel.includes("cat") ? "cat" : "dog");
    const breed = breedMatch?.friendly || (petType === "cat" ? "Domestic Cat" : "Mixed Breed Dog");
    const earStyle = breedMatch?.earStyle || fallback.earStyle;
    const faceShape = aspectRatio > 1.2 ? "long" : fallback.faceShape;

    const computedAttributes = {
      furColor: fallback.furColor,
      earStyle,
      faceShape,
      petType,
      detectionLabel: bestMatch.class,
      detectionConfidence: bestMatch.score || 0.5,
      breedConfidence: breedMatch?.confidence || 0,
      partDetectionMethod: partResult.method
    };

    return {
      detected: true,
      validPet: true,
      confidence: bestMatch.score || 0.5,
      breed,
      breedConfidence: breedMatch?.confidence || 0,
      breedAlternatives: breedPredictions,
      bbox: overallBox,
      partBoxes,
      partDetectionMethod: partResult.method,
      attributes: {
        ...computedAttributes,
        breed,
        partBoxes
      }
    };
  } catch (error) {
    const fallback = fallbackAttributes(imageElement);
    return {
      detected: false,
      validPet: false,
      attributes: fallback,
      breed: "Unknown breed",
      reason: error?.message || "Model unavailable while checking the image."
    };
  }
}
