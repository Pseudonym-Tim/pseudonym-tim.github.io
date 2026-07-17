// Generic window layout helpers for canvas/window-style game panels...
function computeViewportScale(designWidth, designHeight, minScale, maxScale, viewportWidth = window.innerWidth, viewportHeight = window.innerHeight) {
  const basedOnDesign = Math.min(viewportWidth / designWidth, viewportHeight / designHeight);
  return clamp(basedOnDesign, minScale, maxScale);
}

function getClampedWindowPosition(frame, x, y, viewportWidth = window.innerWidth, viewportHeight = window.innerHeight, inset = 4) {
  const maxX = Math.max(0, viewportWidth - frame.cssWidth - inset);
  const maxY = Math.max(0, viewportHeight - frame.cssHeight - frame.cssHeader - inset);
  return { x: clamp(x, inset, maxX), y: clamp(y, inset, maxY) };
}

function getWindowOverlapArea(a, b, padding = 0) {
  const overlapX = Math.min(a.x + a.w + padding, b.x + b.w + padding) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h + padding, b.y + b.h + padding) - Math.max(a.y, b.y);
  return Math.max(0, overlapX) * Math.max(0, overlapY);
}

function findOpenWindowPosition(frames, width, height, padding = 10, attempts = 80, viewportWidth = window.innerWidth, viewportHeight = window.innerHeight) {
  const maxX = Math.max(padding, viewportWidth - width - padding);
  const maxY = Math.max(padding, viewportHeight - height - padding);
  let best = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const rect = { x: rand(padding, maxX), y: rand(padding, maxY), w: width, h: height };
    let score = 0;

    for (const frame of frames) {
      const other = frame.getRect();
      if (rectsOverlap(rect, other, 8)) {
        const ox = Math.min(rect.x + rect.w, other.x + other.w) - Math.max(rect.x, other.x);
        const oy = Math.min(rect.y + rect.h, other.y + other.h) - Math.max(rect.y, other.y);
        score += Math.max(0, ox) * Math.max(0, oy);
      }
    }

    if (score < bestScore) {
      bestScore = score;
      best = rect;
    }

    if (score === 0) {
      return { x: rect.x, y: rect.y };
    }
  }

  return { x: best?.x ?? padding, y: best?.y ?? padding };
}

function getWindowPushCandidate(movable, movingRect, obstacleRect, padding, dx, dy) {
  const left = obstacleRect.x - padding - (movingRect.x + movingRect.w);
  const right = obstacleRect.x + obstacleRect.w + padding - movingRect.x;
  const up = obstacleRect.y - padding - (movingRect.y + movingRect.h);
  const down = obstacleRect.y + obstacleRect.h + padding - movingRect.y;

  const candidates = [
    { x: left, y: 0, axis: 'x' },
    { x: right, y: 0, axis: 'x' },
    { x: 0, y: up, axis: 'y' },
    { x: 0, y: down, axis: 'y' }
  ].filter((candidate) => Math.abs(candidate.x) > 0.001 || Math.abs(candidate.y) > 0.001);

  if (!candidates.length) {
    return null;
  }

  const preferred = normalizeVector(dx, dy);
  const movingCenterX = movingRect.x + movingRect.w / 2;
  const movingCenterY = movingRect.y + movingRect.h / 2;
  const obstacleCenterX = obstacleRect.x + obstacleRect.w / 2;
  const obstacleCenterY = obstacleRect.y + obstacleRect.h / 2;

  return candidates.reduce((best, candidate) => {
    const distance = Math.hypot(candidate.x, candidate.y);
    const direction = normalizeVector(candidate.x, candidate.y) || { x: 0, y: 0 };
    const followsPush = preferred ? Math.max(0, direction.x * preferred.x + direction.y * preferred.y) : 0;
    const separatesCenters = Math.max(0, direction.x * Math.sign(movingCenterX - obstacleCenterX) + direction.y * Math.sign(movingCenterY - obstacleCenterY));
    const axisPenalty = preferred && (candidate.axis === 'x') !== Math.abs(preferred.x) >= Math.abs(preferred.y) ? 6 : 0;
    const score = distance - followsPush * 24 - separatesCenters * 3 + axisPenalty;
    return !best || score < best.score ? { ...candidate, score } : best;
  }, null);
}

function pushWindowAway(movable, obstacle, _frames, padding = 8, _anchor = null, pushDirection = null) {
  const movingRect = movable.getRect();
  const obstacleRect = obstacle.getRect();

  if (!rectsOverlap(movingRect, obstacleRect, padding)) {
    return false;
  }

  const centerDx = movingRect.x + movingRect.w / 2 - (obstacleRect.x + obstacleRect.w / 2);
  const centerDy = movingRect.y + movingRect.h / 2 - (obstacleRect.y + obstacleRect.h / 2);
  const candidate = getWindowPushCandidate(movable, movingRect, obstacleRect, padding, pushDirection?.x ?? centerDx, pushDirection?.y ?? centerDy);

  if (!candidate) {
    return false;
  }

  const stepX = candidate.x;
  const stepY = candidate.y;
  const pos = getClampedWindowPosition(movable, movable.x + stepX, movable.y + stepY);

  if (Math.abs(pos.x - movable.x) < 0.01 && Math.abs(pos.y - movable.y) < 0.01) {
    return false;
  }

  movable.setPosition(pos.x, pos.y);
  return true;
}

function relaxWindowLayout(frames, focus = null, scale = 1, padding = Math.max(8, 14 * scale), maxIterations = 90) {
  // This is intentionally iterative. Shove just moves the damn
  // overlap somewhere else when windows are packed together...
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let moved = false;

    for (let i = 0; i < frames.length; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        const aFrame = frames[i];
        const bFrame = frames[j];
        const a = aFrame.getRect();
        const b = bFrame.getRect();
        const aCx = a.x + a.w / 2;
        const aCy = a.y + a.h / 2;
        const bCx = b.x + b.w / 2;
        const bCy = b.y + b.h / 2;
        let dx = bCx - aCx;
        let dy = bCy - aCy;

        if (Math.abs(dx) < 0.01) {
          dx = rand(-1, 1);
        }

        if (Math.abs(dy) < 0.01) {
          dy = rand(-1, 1);
        }

        const overlapX = (a.w + b.w) / 2 + padding - Math.abs(dx);
        const overlapY = (a.h + b.h) / 2 + padding - Math.abs(dy);
        
        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        const moveFocusWeight = 0.38;
        const aWeight = focus === aFrame ? moveFocusWeight : focus === bFrame ? 1 - moveFocusWeight : 0.5;
        const bWeight = 1 - aWeight;

        if (overlapX < overlapY) {
          const sign = dx >= 0 ? 1 : -1;
          const push = overlapX + rand(1, 7 * scale);
          aFrame.setPosition(aFrame.x - sign * push * aWeight, aFrame.y + rand(-0.8, 0.8));
          bFrame.setPosition(bFrame.x + sign * push * bWeight, bFrame.y + rand(-0.8, 0.8));
        } else {
          const sign = dy >= 0 ? 1 : -1;
          const push = overlapY + rand(1, 7 * scale);
          aFrame.setPosition(aFrame.x + rand(-0.8, 0.8), aFrame.y - sign * push * aWeight);
          bFrame.setPosition(bFrame.x + rand(-0.8, 0.8), bFrame.y + sign * push * bWeight);
        }

        moved = true;
      }
    }

    if (!moved) {
      break;
    }
  }
}