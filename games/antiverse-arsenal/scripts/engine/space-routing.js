// Generic spatial routing helpers for raycasting between window/canvas frames...
function findRaycastFrame(frames, worldX, worldY, direction, exclude = null, minT = 0.5) {
  let best = null;
  let bestT = Infinity;

  for (const frame of frames) {
    if (frame === exclude) {
      continue;
    }

    const rect = frame.getCanvasRect();
    const hit = rayEnterRect({ x: worldX, y: worldY }, direction, rect, minT);

    if (hit && hit.t < bestT) {
      bestT = hit.t;
      best = { frame, x: hit.x, y: hit.y, t: hit.t };
    }
  }

  return best;
}

function findNearestFrame(frames, worldX, worldY, exclude = null) {
  let best = null;
  let bestDistance = Infinity;

  for (const frame of frames) {
    if (frame === exclude) {
      continue;
    }

    const rect = frame.getCanvasRect();
    const closest = closestPointToRect(worldX, worldY, rect);
    const d = distSq(worldX, worldY, closest.x, closest.y);

    if (d < bestDistance) {
      bestDistance = d;
      best = frame;
    }
  }

  return best;
}