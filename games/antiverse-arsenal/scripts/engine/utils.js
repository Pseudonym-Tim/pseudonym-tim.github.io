// Math, geometry, and timing helpers...
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function distSq(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

function rectsOverlap(a, b, padding = 0) {
  return a.x < b.x + b.w + padding &&
    a.x + a.w + padding > b.x &&
    a.y < b.y + b.h + padding &&
    a.y + a.h + padding > b.y;
}

function closestPointToRect(px, py, rect) {
  return {
    x: clamp(px, rect.x, rect.x + rect.w),
    y: clamp(py, rect.y, rect.y + rect.h)
  };
}

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

function circleCollisionShape(x, y, radius) {
  return { type: 'circle', x, y, radius };
}

function boxCollisionShape(x, y, width, height) {
  return { type: 'box', x: x - width / 2, y: y - height / 2, w: width, h: height };
}

function entityCollisionShape(entity) {
  if (entity?.getCollisionShape) return entity.getCollisionShape();
  return circleCollisionShape(entity.x, entity.y, entity.radius || 0);
}

function collisionShapesOverlap(a, b) {
  if (!a || !b) return false;

  if (Array.isArray(a)) return a.some((shape) => collisionShapesOverlap(shape, b));
  if (Array.isArray(b)) return b.some((shape) => collisionShapesOverlap(a, shape));

  if (a.type === 'circle' && b.type === 'circle') {
    const radius = a.radius + b.radius;
    return distSq(a.x, a.y, b.x, b.y) < radius * radius;
  }

  if (a.type === 'box' && b.type === 'box') {
    return rectsOverlap(a, b);
  }

  const circle = a.type === 'circle' ? a : b;
  const box = a.type === 'box' ? a : b;
  const closest = closestPointToRect(circle.x, circle.y, box);
  return distSq(circle.x, circle.y, closest.x, closest.y) < circle.radius * circle.radius;
}

function pointInCollisionShape(x, y, shape) {
  if (!shape) return false;
  if (shape.type === 'box') return pointInRect(x, y, shape);
  if (shape.type === 'circle') return distSq(x, y, shape.x, shape.y) <= shape.radius * shape.radius;
  return false;
}

function entitiesOverlap(a, b) {
  return collisionShapesOverlap(entityCollisionShape(a), entityCollisionShape(b));
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  if (length < 0.00001) return null;
  return { x: x / length, y: y / length, length };
}

function angleDelta(target, current) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function lerpAngle(current, target, amount) {
  return current + angleDelta(target, current) * clamp(amount, 0, 1);
}

function formatMultiplier(multiplier) {
  const rounded = Math.round(multiplier * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function localAngleToWorld(angle, universe) {
  return Math.atan2(Math.sin(angle) * universe.scale, Math.cos(angle) * universe.scale);
}

function worldAngleToLocal(angle, universe) {
  return Math.atan2(Math.sin(angle) / universe.scale, Math.cos(angle) / universe.scale);
}

function rayRectRange(origin, dir, rect) {
  const epsilon = 0.00001;
  let tMin = -Infinity;
  let tMax = Infinity;

  if (Math.abs(dir.x) < epsilon) {
    if (origin.x < rect.x || origin.x > rect.x + rect.w) return null;
  } else {
    const tx1 = (rect.x - origin.x) / dir.x;
    const tx2 = (rect.x + rect.w - origin.x) / dir.x;
    tMin = Math.max(tMin, Math.min(tx1, tx2));
    tMax = Math.min(tMax, Math.max(tx1, tx2));
  }

  if (Math.abs(dir.y) < epsilon) {
    if (origin.y < rect.y || origin.y > rect.y + rect.h) return null;
  } else {
    const ty1 = (rect.y - origin.y) / dir.y;
    const ty2 = (rect.y + rect.h - origin.y) / dir.y;
    tMin = Math.max(tMin, Math.min(ty1, ty2));
    tMax = Math.min(tMax, Math.max(ty1, ty2));
  }

  if (tMax < tMin) return null;
  return { tMin, tMax };
}

function rayEnterRect(origin, dir, rect, minT = 0.001) {
  const range = rayRectRange(origin, dir, rect);
  if (!range || range.tMax < minT) return null;
  const t = Math.max(range.tMin, minT);
  if (t > range.tMax) return null;

  return {
    t,
    x: origin.x + dir.x * t,
    y: origin.y + dir.y * t
  };
}

function rayExitRect(origin, dir, rect) {
  const range = rayRectRange(origin, dir, rect);
  if (!range || range.tMax < 0) return null;
  const t = pointInRect(origin.x, origin.y, rect) ? range.tMax : Math.max(range.tMin, 0);

  return {
    t,
    x: origin.x + dir.x * t,
    y: origin.y + dir.y * t
  };
}

function rayCircleHit(origin, dir, circle, radius, minT = 0, maxT = Infinity) {
  const dx = origin.x - circle.x;
  const dy = origin.y - circle.y;
  const b = dx * dir.x + dy * dir.y;
  const c = dx * dx + dy * dy - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const t1 = -b - root;
  const t2 = -b + root;
  const t = t1 >= minT ? t1 : t2;
  if (t < minT || t > maxT) return null;
  
  return { t, x: origin.x + dir.x * t, y: origin.y + dir.y * t };
}