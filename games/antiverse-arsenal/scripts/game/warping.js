// Aiming, wrapping, and warping behavior...
Object.assign(Game.prototype, {
  getMouseAimAngle() {
    if (!this.player?.universe) return null;
    const origin = this.player.universe.localToWorld(this.player.x, this.player.y);
    const dx = this.mouseX - origin.x;
    const dy = this.mouseY - origin.y;
    if (Math.hypot(dx, dy) < 2) return null;
    return worldAngleToLocal(Math.atan2(dy, dx), this.player.universe);
  },

  wrapEntity(entity, options = {}) {
    const u = entity.universe;
    const radius = entity.radius || 0;
    const outLeft = entity.x < -radius;
    const outRight = entity.x > u.width + radius;
    const outTop = entity.y < -radius;
    const outBottom = entity.y > u.height + radius;

    if (!(outLeft || outRight || outTop || outBottom)) return false;

    if (options.countWrap) {
      entity.wrapCount = (entity.wrapCount || 0) + 1;

      if (entity.wrapCount > (entity.maxWraps || MAX_WRAPS)) {
        entity.expired = true;
        entity.dead = true;
        return true;
      }

      if (options.scoreMultiplier && entity.scoreMultiplier !== undefined) {
        entity.scoreMultiplier += 1 + (this.hasPowerup('lucky') ? 0.5 : 0);
      }
    }

    const fallbackDirection = normalizeVector(
      (outRight ? 1 : 0) - (outLeft ? 1 : 0),
      (outBottom ? 1 : 0) - (outTop ? 1 : 0)
    );

    const velocityDirection = normalizeVector(entity.velX || 0, entity.velY || 0);
    const previousWorld = u.localToWorld(entity.prevX ?? clamp(entity.x, 0, u.width), entity.prevY ?? clamp(entity.y, 0, u.height));
    const currentWorld = u.localToWorld(entity.x, entity.y);
    const frameDirection = normalizeVector(currentWorld.x - previousWorld.x, currentWorld.y - previousWorld.y);
    const direction = velocityDirection || frameDirection || fallbackDirection || { x: 1, y: 0 };

    const sourceRect = u.getCanvasRect();
    const sourceExit = rayExitRect(previousWorld, direction, sourceRect);
    const clampedLocalX = clamp(entity.x, 0, u.width);
    const clampedLocalY = clamp(entity.y, 0, u.height);
    const clampedWorldExit = u.localToWorld(clampedLocalX, clampedLocalY);
    const worldExit = sourceExit || clampedWorldExit;
    const hit = this.findRaycastUniverse(worldExit.x, worldExit.y, direction, u);
    const target = hit?.universe || (options.sameUniverse ? u : null);

    if (!target) {
      entity.dead = true;
      return true;
    }

    if (target !== u && entity.owner === 'player') {
      entity.multiUniversalWrapCount = (entity.multiUniversalWrapCount || 0) + 1;
    }

    if (target === u) {
      if (outLeft) entity.x = u.width - radius;
      if (outRight) entity.x = radius;
      if (outTop) entity.y = u.height - radius;
      if (outBottom) entity.y = radius;
    } else {
      const inset = Math.max(2, radius * target.scale + 2);

      const targetLocal = target.worldToLocal(
        hit.x + direction.x * inset,
        hit.y + direction.y * inset
      );

      entity.universe = target;
      entity.x = clamp(targetLocal.x, radius + 1, target.width - radius - 1);
      entity.y = clamp(targetLocal.y, radius + 1, target.height - radius - 1);
    }

    return true;
  },

  findRaycastUniverse(worldX, worldY, direction, exclude) {
    const hit = findRaycastFrame(this.universes, worldX, worldY, direction, exclude);
    return hit ? { universe: hit.frame, x: hit.x, y: hit.y, t: hit.t } : null;
  },

  findNearestUniverse(worldX, worldY, exclude) {
    return findNearestFrame(this.universes, worldX, worldY, exclude);
  },

  tryWarpTo(universe, x, y) {
    if (this.paused || !this.player || this.player.warpCooldown > 0 || !this.universes.includes(universe)) return;
    this.player.universe = universe;
    this.player.x = clamp(x, this.player.radius, universe.width - this.player.radius);
    this.player.y = clamp(y, this.player.radius, universe.height - this.player.radius);
    this.player.velX *= 0.35;
    this.player.velY *= 0.35;
    this.player.warpCooldown = 3.5;
    this.flashMessage(formatText('message.warpedToUniverse', { id: universe.id }), 650);
  },

  safeWarpPosition(universe) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = rand(40, universe.width - 40);
      const y = rand(40, universe.height - 40);
      let safe = true;

      for (const enemy of universe.enemies) {
        if (distSq(x, y, enemy.x, enemy.y) < 70 * 70) { safe = false; break; }
      }

      if (!safe) continue;

      for (const asteroid of universe.asteroids) {
        const min = asteroid.radius + this.player.radius + 24;
        if (distSq(x, y, asteroid.x, asteroid.y) < min * min) { safe = false; break; }
      }

      if (safe) return { x, y };
    }
    return { x: universe.width / 2, y: universe.height / 2 };
  }
});