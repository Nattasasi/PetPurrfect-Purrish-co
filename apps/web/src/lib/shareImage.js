import { matchStrengthLabel, traitAdjective } from "./personalityInsights";

function capitalizeWord(value) {
  if (!value) {
    return "";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  text.split(/\s+/).filter(Boolean).forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

// Largest font size (down to minSize) at which the text fits within maxLines lines of maxWidth.
function fitWrapped(ctx, text, weight, maxWidth, maxLines, startSize, minSize) {
  for (let size = startSize; size >= minSize; size -= 2) {
    ctx.font = `${weight} ${size}px Poppins, sans-serif`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.every((line) => ctx.measureText(line).width <= maxWidth)) {
      return { size, lines };
    }
  }
  ctx.font = `${weight} ${minSize}px Poppins, sans-serif`;
  return { size: minSize, lines: wrapLines(ctx, text, maxWidth).slice(0, maxLines) };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function renderQuizResultCanvas(payload) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const CENTER_X = 540;
  const TEXT_WIDTH = 760;
  const matchName = payload?.match?.name || "Your Pet Match";
  const matchStrength = capitalizeWord(matchStrengthLabel(payload?.match?.confidence || 0));
  const personalityTraits = (payload?.topTraits || [])
    .slice(0, 3)
    .map((item) => capitalizeWord(traitAdjective(item.key, item.value)))
    .filter(Boolean)
    .join(" \u2022 ") || "Balanced";

  ctx.fillStyle = "#fff8f4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";

  ctx.fillStyle = "#ff7fa8";
  ctx.font = "bold 56px Poppins, sans-serif";
  ctx.fillText("Purrish&Co.", CENTER_X, 140);
  ctx.fillStyle = "#9a8a8f";
  ctx.font = "500 30px Poppins, sans-serif";
  ctx.fillText("Purrsonality quiz result", CENTER_X, 190);

  ctx.fillStyle = "#ffffff";
  roundedRect(ctx, 100, 250, 880, 660, 40);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffd7e5";
  ctx.stroke();

  ctx.fillStyle = "#ff7fa8";
  ctx.font = "700 28px Poppins, sans-serif";
  ctx.fillText("YOUR PERSONALITY MATCH", CENTER_X, 330);

  const name = fitWrapped(ctx, matchName, "bold", TEXT_WIDTH, 2, 88, 48);
  ctx.fillStyle = "#333";
  let y = 330 + 40 + name.size;
  name.lines.forEach((line) => {
    ctx.fillText(line, CENTER_X, y);
    y += name.size * 1.15;
  });

  y += 10;
  ctx.fillStyle = "#7fd1b9";
  ctx.fillRect(CENTER_X - 80, y, 160, 4);

  y += 70;
  ctx.fillStyle = "#d95179";
  ctx.font = "600 44px Poppins, sans-serif";
  ctx.fillText(matchStrength, CENTER_X, y);

  y += 70;
  ctx.fillStyle = "#9a8a8f";
  ctx.font = "500 28px Poppins, sans-serif";
  ctx.fillText("Your personality", CENTER_X, y);

  const traits = fitWrapped(ctx, personalityTraits, "600", TEXT_WIDTH, 2, 38, 28);
  ctx.fillStyle = "#333";
  y += 20 + traits.size;
  traits.lines.forEach((line) => {
    ctx.fillText(line, CENTER_X, y);
    y += traits.size * 1.3;
  });

  ctx.fillStyle = "#9a8a8f";
  ctx.font = "500 28px Poppins, sans-serif";
  ctx.fillText("Find your match at pet-purrfect.site", CENTER_X, 990);

  return canvas;
}

function downloadCanvas(canvas, fileName) {
  if (!canvas) {
    return;
  }
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function canvasToFile(canvas, fileName) {
  return new Promise((resolve) => {
    if (!canvas) {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], fileName, { type: "image/png" }) : null);
    }, "image/png");
  });
}

export function exportQuizResultImage(payload) {
  downloadCanvas(renderQuizResultCanvas(payload), "purrishco-result.png");
}

export async function createQuizResultImageFile(payload) {
  return canvasToFile(renderQuizResultCanvas(payload), "purrishco-result.png");
}

function renderStickerResultCanvas(payload) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }

    const breed = payload?.breed || "Pet";
    const title = payload?.title || "Purrish&Co. Sticker";
    const captionText = `this is my ${breed}!`;

    const CENTER_X = 540;
    const CENTER_Y = 520;
    const RADIUS = 330;

    ctx.fillStyle = "#fff7f3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ff7fa8";
    ctx.font = "bold 52px Poppins, sans-serif";
    ctx.fillText(title, CENTER_X, 130);

    ctx.fillStyle = "#ffd8e4";
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#333";
    ctx.font = "600 62px Poppins, sans-serif";
    ctx.fillText(captionText, CENTER_X, 940);

    ctx.fillStyle = "#9a8a8f";
    ctx.font = "500 28px Poppins, sans-serif";
    ctx.fillText("Made with Purrish&Co. Purrify", CENTER_X, 1010);

    const finish = () => resolve(canvas);

    if (!payload?.imageUrl) {
      finish();
      return;
    }

    const stickerImage = new Image();
    stickerImage.crossOrigin = "anonymous";
    stickerImage.onload = () => {
      // Fit the sticker inside the circle without stretching it.
      const box = RADIUS * 1.7;
      const scale = Math.min(box / stickerImage.width, box / stickerImage.height);
      const width = stickerImage.width * scale;
      const height = stickerImage.height * scale;
      ctx.drawImage(stickerImage, CENTER_X - width / 2, CENTER_Y - height / 2, width, height);

      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, RADIUS + 8, 0, Math.PI * 2);
      ctx.lineWidth = 12;
      ctx.strokeStyle = "#ffd7e5";
      ctx.stroke();

      finish();
    };
    stickerImage.onerror = finish;
    stickerImage.src = payload.imageUrl;
  });
}

export async function exportStickerResultImage(payload) {
  downloadCanvas(await renderStickerResultCanvas(payload), "purrishco-sticker.png");
}

export async function createStickerResultImageFile(payload) {
  return canvasToFile(await renderStickerResultCanvas(payload), "purrishco-sticker.png");
}
