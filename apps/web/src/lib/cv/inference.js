import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { classifyBreed } from "./breedClassifier";
import { detectPetParts } from "./partDetection";
import { extractPetColors } from "./colorExtraction";
import { getForegroundMask, createSegmentationDebugImage } from "./segmentation";

const MIN_DETECTION_SCORE = 0.2;
const BOX_PADDING_RATIO = 0.12;
const COLOR_SAMPLE_SIZE = 48;
// Well above the 1-in-47 chance baseline, so an unrelated (non-pet) photo
// forced through the breed classifier doesn't get accepted as a false positive.
const FALLBACK_BREED_CONFIDENCE = 0.5;

let cocoModelPromise = null;

async function loadCocoModel() {
  if (!cocoModelPromise) {
    cocoModelPromise = cocoSsd.load();
  }

  return cocoModelPromise;
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
    const cocoModel = await loadCocoModel();
    const predictions = await cocoModel.detect(imageElement, 10, MIN_DETECTION_SCORE);

    const petCandidates = predictions
      .filter((item) => isPetLabel(item.class || ""))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    let bestMatch = petCandidates[0];
    let overallBox = bestMatch
      ? padBox({ x: bestMatch.bbox[0], y: bestMatch.bbox[1], width: bestMatch.bbox[2], height: bestMatch.bbox[3] }, imageElement)
      : null;

    // coco-ssd is a generic 90-class detector and can flat-out miss (or
    // misclassify) a pet in tightly-cropped close-up photos. As a fallback,
    // try the dedicated 47-breed cat/dog classifier directly on the whole
    // photo — since every one of its classes IS a cat or dog breed, a
    // confident result there is strong evidence a pet is actually present.
    let wholeImageBreedMatch = null;
    if (!bestMatch) {
      wholeImageBreedMatch = await classifyBreed(imageElement);
      if (wholeImageBreedMatch && wholeImageBreedMatch.confidence >= FALLBACK_BREED_CONFIDENCE) {
        overallBox = { x: 0, y: 0, width: imageElement.width, height: imageElement.height };
        bestMatch = {
          class: wholeImageBreedMatch.petType === "cat" ? "cat" : "dog",
          score: wholeImageBreedMatch.confidence,
          bbox: [0, 0, imageElement.width, imageElement.height]
        };
      }
    }

    if (!bestMatch) {
      return {
        detected: false,
        validPet: false,
        attributes: fallbackAttributes(imageElement),
        breed: "Unknown breed",
        reason: "We couldn't clearly detect a cat or dog in this photo. Try a clearer, well-lit photo with the pet fully in frame."
      };
    }

    const fallback = fallbackAttributes(imageElement);
    const aspectRatio = overallBox.width / Math.max(overallBox.height, 1);

    // Classify the cropped pet region (rather than the whole photo) so the
    // breed model isn't distracted by background clutter. Reuse the
    // whole-image classification above when that's what found the pet.
    const croppedCanvas = cropToCanvas(imageElement, overallBox);
    const breedMatch = wholeImageBreedMatch || (await classifyBreed(croppedCanvas));

    const partResult = detectPetParts(croppedCanvas);
    const partBoxes = partResult.boxes.map((box) => ({
      ...box,
      x: box.x + overallBox.x,
      y: box.y + overallBox.y
    }));

    // Segment the pet out of its crop (foreground-probability mask) so fur
    // colors are sampled from the actual animal, not background/other
    // objects the padded detection box happens to include. Falls back to
    // geometric/radial weighting alone (inside extractPetColors) if the
    // segmentation model can't be loaded or run.
    const foregroundMask = await getForegroundMask(croppedCanvas, COLOR_SAMPLE_SIZE);
    const segmentationDebugImage = createSegmentationDebugImage(croppedCanvas, foregroundMask, COLOR_SAMPLE_SIZE);

    // Extract a few representative fur tones from the cropped pet region and
    // snap each to the nearest curated preset color for the sticker layers.
    const colors = extractPetColors(croppedCanvas, foregroundMask) || undefined;

    const detectionLabel = bestMatch.class?.toLowerCase() || "";
    const petType = breedMatch?.petType || (detectionLabel.includes("cat") ? "cat" : "dog");
    const breed = breedMatch?.friendly || (petType === "cat" ? "Domestic Cat" : "Mixed Breed Dog");
    const earStyle = breedMatch?.earStyle || fallback.earStyle;
    const faceShape = aspectRatio > 1.2 ? "long" : fallback.faceShape;

    const computedAttributes = {
      furColor: fallback.furColor,
      colors,
      petBox: overallBox,
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
      breedAlternatives: breedMatch?.alternatives || [],
      bbox: overallBox,
      partBoxes,
      partDetectionMethod: partResult.method,
      segmentationDebugImage,
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
