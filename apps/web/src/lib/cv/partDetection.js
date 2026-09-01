// Detects only body parts supported by direct pixel evidence. This intentionally
// avoids deriving ears, head, body, legs, or tail positions from eye spacing.
const GRID_COLS = 40;

function buildGrayscaleGrid(canvas, cols) {
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  const rows = Math.max(8, Math.round((cols * height) / width));
  const { data } = context.getImageData(0, 0, width, height);
  const cellW = width / cols;
  const cellH = height / rows;
  const sums = new Float64Array(cols * rows);
  const counts = new Float64Array(cols * rows);

  for (let y = 0; y < height; y++) {
    const row = Math.min(rows - 1, Math.floor(y / cellH));
    for (let x = 0; x < width; x++) {
      const col = Math.min(cols - 1, Math.floor(x / cellW));
      const idx = (y * width + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const cellIdx = row * cols + col;
      sums[cellIdx] += gray;
      counts[cellIdx] += 1;
    }
  }

  const grid = new Float64Array(cols * rows);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = counts[i] ? sums[i] / counts[i] : 255;
  }

  return { grid, cols, rows, cellW, cellH, pixels: data, pixelWidth: width, pixelHeight: height };
}

function findDarkBlobs(grid, cols, rowStart, rowEnd) {
  const searchValues = [];
  for (let row = rowStart; row < rowEnd; row++) {
    for (let col = 0; col < cols; col++) {
      searchValues.push(grid[row * cols + col]);
    }
  }

  const sorted = [...searchValues].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.15)] ?? 60;

  const isDark = (col, row) => {
    if (col < 0 || col >= cols || row < rowStart || row >= rowEnd) {
      return false;
    }
    return grid[row * cols + col] <= threshold;
  };

  const visited = new Uint8Array(cols * (rowEnd - rowStart));
  const visitedIndex = (col, row) => (row - rowStart) * cols + col;
  const blobs = [];

  for (let row = rowStart; row < rowEnd; row++) {
    for (let col = 0; col < cols; col++) {
      const startIdx = visitedIndex(col, row);
      if (visited[startIdx] || !isDark(col, row)) {
        continue;
      }

      const stack = [[col, row]];
      visited[startIdx] = 1;
      const cells = [];

      while (stack.length) {
        const [c, r] = stack.pop();
        cells.push([c, r]);

        const neighbors = [
          [c + 1, r],
          [c - 1, r],
          [c, r + 1],
          [c, r - 1]
        ];

        for (const [nc, nr] of neighbors) {
          if (nc < 0 || nc >= cols || nr < rowStart || nr >= rowEnd) {
            continue;
          }
          const nIdx = visitedIndex(nc, nr);
          if (!visited[nIdx] && isDark(nc, nr)) {
            visited[nIdx] = 1;
            stack.push([nc, nr]);
          }
        }
      }

      const cols_ = cells.map(([c]) => c);
      const rows_ = cells.map(([, r]) => r);
      const minCol = Math.min(...cols_);
      const maxCol = Math.max(...cols_);
      const minRow = Math.min(...rows_);
      const maxRow = Math.max(...rows_);
      const bboxW = maxCol - minCol + 1;
      const bboxH = maxRow - minRow + 1;

      const avgCol = cols_.reduce((sum, c) => sum + c, 0) / cells.length;
      const avgRow = rows_.reduce((sum, r) => sum + r, 0) / cells.length;

      blobs.push({
        size: cells.length,
        col: avgCol,
        row: avgRow,
        bboxW,
        bboxH,
        aspect: bboxW / Math.max(bboxH, 1),
        fillRatio: cells.length / Math.max(bboxW * bboxH, 1)
      });
    }
  }

  return blobs;
}

// A real pupil almost always shows a small, sharply brighter reflection
// (catchlight) against its dark iris; plain dark fur usually doesn't. This
// samples actual pixels (not the coarse grid) around a blob to check for one.
function hasCatchlight(pixels, pixelWidth, pixelHeight, cellW, cellH, blob) {
  const centerX = Math.round((blob.col + 0.5) * cellW);
  const centerY = Math.round((blob.row + 0.5) * cellH);
  const radiusX = Math.max(4, Math.round(blob.bboxW * cellW * 0.9));
  const radiusY = Math.max(4, Math.round(blob.bboxH * cellH * 0.9));

  const left = Math.max(0, centerX - radiusX);
  const right = Math.min(pixelWidth - 1, centerX + radiusX);
  const top = Math.max(0, centerY - radiusY);
  const bottom = Math.min(pixelHeight - 1, centerY + radiusY);

  let sum = 0;
  let count = 0;
  let maxBrightness = 0;
  let brightPixelCount = 0;

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const idx = (y * pixelWidth + x) * 4;
      const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
      sum += brightness;
      count += 1;
      maxBrightness = Math.max(maxBrightness, brightness);
    }
  }

  const avgBrightness = count ? sum / count : 0;

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const idx = (y * pixelWidth + x) * 4;
      const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
      if (brightness > avgBrightness + 55 && brightness > 150) {
        brightPixelCount += 1;
      }
    }
  }

  const area = Math.max(1, (right - left + 1) * (bottom - top + 1));
  const brightRatio = brightPixelCount / area;

  // A catchlight is a small, concentrated highlight — not a large bright area.
  return brightRatio > 0.01 && brightRatio < 0.35 && maxBrightness > 170;
}

function findEyePair(blobs, cols, rowStart, rowEnd) {
  const rowSpan = rowEnd - rowStart;
  const maxSize = cols * rowSpan * 0.04;

  // Compactness filters out elongated/irregular fur patches — real pupils
  // are small, roughly-circular, densely-filled blobs.
  const candidates = blobs.filter(
    (blob) =>
      blob.size >= 1 &&
      blob.size <= maxSize &&
      blob.aspect >= 0.5 &&
      blob.aspect <= 2 &&
      blob.fillRatio >= 0.45
  );

  let bestPair = null;
  let bestScore = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const left = a.col < b.col ? a : b;
      const right = a.col < b.col ? b : a;
      const colGap = right.col - left.col;
      const rowGap = Math.abs(a.row - b.row);

      if (colGap < cols * 0.12 || colGap > cols * 0.6 || rowGap > rowSpan * 0.25) {
        continue;
      }

      const sizeBalance = 1 - Math.abs(a.size - b.size) / Math.max(a.size, b.size, 1);
      const spacingScore = 1 - Math.abs(colGap - cols * 0.32) / (cols * 0.32);
      const alignmentScore = 1 - rowGap / (rowSpan * 0.25);
      const catchlightBonus = (a.hasCatchlight ? 1.5 : 0) + (b.hasCatchlight ? 1.5 : 0);
      const score = sizeBalance + spacingScore + alignmentScore + catchlightBonus;

      if (score > bestScore) {
        bestScore = score;
        bestPair = { left, right };
      }
    }
  }

  return bestPair;
}

function clampBox(box, width, height) {
  const x = Math.max(0, Math.min(box.x, width - 4));
  const y = Math.max(0, Math.min(box.y, height - 4));
  const w = Math.max(6, Math.min(box.width, width - x));
  const h = Math.max(6, Math.min(box.height, height - y));
  return { label: box.label, x, y, width: w, height: h };
}

export function detectPetParts(canvas) {
  const { width, height } = canvas;
  const { grid, cols, rows, cellW, cellH, pixels, pixelWidth, pixelHeight } = buildGrayscaleGrid(canvas, GRID_COLS);
  // Search a band that skips the very top (ears/forehead crown) and bottom
  // (muzzle/nose), where eyes are unlikely to be.
  const rowStart = Math.max(0, Math.round(rows * 0.1));
  const rowEnd = Math.max(rowStart + 2, Math.round(rows * 0.62));

  const blobs = findDarkBlobs(grid, cols, rowStart, rowEnd).map((blob) => ({
    ...blob,
    hasCatchlight: hasCatchlight(pixels, pixelWidth, pixelHeight, cellW, cellH, blob)
  }));

  // Require catchlights so dark fur or background texture is not reported as eyes.
  const catchlightBlobs = blobs.filter((blob) => blob.hasCatchlight);
  const eyePair = findEyePair(catchlightBlobs, cols, rowStart, rowEnd);

  const toPx = (col, row) => ({ x: (col + 0.5) * cellW, y: (row + 0.5) * cellH });

  if (eyePair) {
    const leftEyePx = toPx(eyePair.left.col, eyePair.left.row);
    const rightEyePx = toPx(eyePair.right.col, eyePair.right.row);
    const eyeSpacing = Math.max(8, rightEyePx.x - leftEyePx.x);

    const eyeBoxSize = eyeSpacing * 0.32;
    return {
      method: "eye-anchored",
      boxes: [
        { label: "left eye", x: leftEyePx.x - eyeBoxSize / 2, y: leftEyePx.y - eyeBoxSize / 2, width: eyeBoxSize, height: eyeBoxSize },
        { label: "right eye", x: rightEyePx.x - eyeBoxSize / 2, y: rightEyePx.y - eyeBoxSize / 2, width: eyeBoxSize, height: eyeBoxSize },
      ].map((box) => clampBox(box, width, height))
    };
  }

  // No confident eye pair found (e.g. profile shot, closed eyes, poor lighting) —
  // fall back to coarse zones instead of pretending to know exact part locations.
  return {
    method: "no-confident-parts",
    boxes: []
  };
}
