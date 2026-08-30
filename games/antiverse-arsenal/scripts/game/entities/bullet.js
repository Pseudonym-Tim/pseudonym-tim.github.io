// Bullet projectiles...
class Bullet {
  constructor(game, universe, x, y, vx, vy, owner, scoreMultiplier, options = {}) {
    this.game = game;
    this.universe = universe;
    this.x = x;
    this.y = y;
    this.velX = vx;
    this.velY = vy;
    this.owner = owner;
    this.radius = options.radius ?? 3;
    this.damage = options.damage ?? 1;
    this.age = 0;
    this.dead = false;
    this.wrapCount = 0;
    this.maxWraps = options.maxWraps ?? MAX_WRAPS;
    this.scoreMultiplier = scoreMultiplier || 1;
    this.multiUniversalWrapCount = 0;
    this.sprite = options.sprite || null;
    this.spritePixelScale = options.spritePixelScale ?? 3;
    this.orbitalIgnoreTime = options.orbitalIgnoreTime ?? 0;
    this.sourceName = options.sourceName || '';
    this.readabilityGlowFactor = 0;
  }

  update(dt) {
    let remainingDt = dt;
    let safetySteps = 0;

    while (remainingDt > 0.000001 && !this.dead && safetySteps < 2048) {
      const speed = Math.max(1, Math.hypot(this.velX, this.velY));
      const stepDt = Math.min(remainingDt, 8 / speed);
      this.age += stepDt;
      this.prevX = this.x;
      this.prevY = this.y;
      this.x += this.velX * stepDt;
      this.y += this.velY * stepDt;
      this.updateReadabilityGlow(stepDt);
      remainingDt -= stepDt;
      safetySteps += 1;

      this.checkHits();

      if (!this.dead) {
        const universeEntrySpeedMultiplier = this.owner === 'player' ? PLAYER_MULTIVERSE_BULLET_SPEED_MULTIPLIER : ENEMY_MULTIVERSE_BULLET_SPEED_MULTIPLIER;
        this.game.wrapEntity(this, { sameUniverse: true, countWrap: true, scoreMultiplier: true, universeEntrySpeedMultiplier });
      }
    }
  }

  getCollisionShape() {
    return circleCollisionShape(this.x, this.y, this.radius);
  }

  checkHits() {
    const player = this.game.player;

    if (this.game.isBulletBlockedByOrbital(this)) {
      this.dead = true;
      return;
    }

    if (this.universe === player.universe && !player.dashing) {
      const canHitOwner = this.owner === 'player' && this.age > 0.42;

      if (this.owner === 'enemy' || canHitOwner) {
        if (collisionShapesOverlap(this.getCollisionShape(), entityCollisionShape(player))) {
          const cause = canHitOwner ? (this.wrapCount > 0 ? 'ownWrappedProjectile' : 'ownProjectile') : 'enemyProjectile';
          player.takeDamage(this.velX, this.velY, this.damage, cause, this.sourceName);
          this.dead = true;
          return;
        }
      }
    }

    for (const asteroid of this.universe.asteroids) {
      if (collisionShapesOverlap(this.getCollisionShape(), entityCollisionShape(asteroid))) {
        asteroid.takeDamage(this.damage, 1);
        this.dead = true;
        return;
      }
    }

    if (this.owner === 'player') {
      for (const rocket of this.game.rockets) {
        if (!rocket.dead && rocket.universe === this.universe && collisionShapesOverlap(this.getCollisionShape(), rocket.getCollisionShape())) {
          if (rocket.takeDamage(this.damage, this)) {
            this.dead = true;
            return;
          }
        }
      }

      for (const enemy of this.universe.enemies) {
        if (collisionShapesOverlap(this.getCollisionShape(), entityCollisionShape(enemy))) {
          enemy.takeDamage(this.damage, this.scoreMultiplier, this.x, this.y, this.radius);
          this.game.recordWrapShotHit(this);
          enemy.registerHit(this.scoreMultiplier);
          this.dead = true;
          return;
        }
      }
    }
  }

  getWrapGlowTargetFactor() {
    if (this.wrapCount >= this.maxWraps) {
      return 0;
    }

    const direction = normalizeVector(this.velX, this.velY);

    if (!direction) {
      return 0;
    }

    const source = this.universe;
    // Clamp to the canvas so the factor stays at full strength during the tiny
    // radius-sized interval where the projectile center has crossed the seam but wrapping
    // waits for the whole projectile to leave the source canvas...
    const probeX = clamp(this.x, 0, source.width);
    const probeY = clamp(this.y, 0, source.height);
    const worldPosition = source.localToWorld(probeX, probeY);
    const worldDirection = normalizeVector(direction.x * source.scale, direction.y * source.scale);
    const exit = rayExitRect(worldPosition, worldDirection, source.getCanvasRect());

    if (!exit) {
      return 0;
    }

    const localDistanceToExit = Math.max(0, exit.t / source.scale);
    const proximity = clamp(1 - localDistanceToExit / BULLET_READABILITY_GLOW_WRAP_FADE_DISTANCE, 0, 1);

    // Smoothstep keeps glow fully dormant until the approach, then ramps without
    // a visible pop as the projectile closes on the seam...
    return proximity * proximity * (3 - 2 * proximity);
  }

  updateReadabilityGlow(dt) {
    const target = this.getWrapGlowTargetFactor();

    if (target >= this.readabilityGlowFactor) {
      // Fade-in is driven directly by boundary proximity, so even very fast projectiles reach
      // their full speed-based warning intensity by the time they hit the seam...
      this.readabilityGlowFactor = target;
    } else {
      // After a wrap (or if a projectile moves away from its projected exit), ease the same
      // aura back to zero instead of snapping it off...
      const amount = 1 - Math.exp(-BULLET_READABILITY_GLOW_LERP_RATE * Math.max(0, dt));
      this.readabilityGlowFactor += (target - this.readabilityGlowFactor) * amount;
    }

    if (target === 0 && this.readabilityGlowFactor < 0.001) {
      this.readabilityGlowFactor = 0;
    }
  }

  getReadabilityGlow() {
    const speed = Math.hypot(this.velX, this.velY);
    const speedRatio = clamp((speed - BULLET_READABILITY_GLOW_MIN_SPEED) / (BULLET_READABILITY_GLOW_MAX_SPEED - BULLET_READABILITY_GLOW_MIN_SPEED), 0, 1);

    // Faster projectiles get a larger/brighter screen-blended aura so their danger is legible at a glance...
    const targetAlpha = BULLET_READABILITY_GLOW_MIN_ALPHA + (BULLET_READABILITY_GLOW_MAX_ALPHA - BULLET_READABILITY_GLOW_MIN_ALPHA) * speedRatio;

    return {
      alpha: targetAlpha * this.readabilityGlowFactor,
      radius: BULLET_READABILITY_GLOW_MIN_RADIUS + (BULLET_READABILITY_GLOW_MAX_RADIUS - BULLET_READABILITY_GLOW_MIN_RADIUS) * speedRatio
    };
  }

  drawReadabilityGlowAt(ctx, x, y) {
    const glowSettings = this.getReadabilityGlow();

    if (!glowSettings) {
      return;
    }

    const [red, green, blue] = this.owner === 'player' ? [143, 255, 143] : [255, 121, 94];
    const drawX = pixelSnap(x);
    const drawY = pixelSnap(y);
    const { alpha, radius } = glowSettings;

    if (alpha <= 0.0001) {
      return;
    }

    const glow = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, radius);

    glow.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${alpha})`);
    glow.addColorStop(0.18, `rgba(${red}, ${green}, ${blue}, ${alpha * 0.7})`);
    glow.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = glow;
    ctx.fillRect(drawX - radius, drawY - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  drawReadabilityGlow(ctx) {
    this.drawReadabilityGlowAt(ctx, this.x, this.y);
  }

  getWrappedGlowProjection() {
    const direction = normalizeVector(this.velX, this.velY);

    // There is no projected glow when the next boundary crossing will destroy the projectile...
    if (!direction || this.wrapCount >= this.maxWraps) {
      return null;
    }

    const source = this.universe;
    const glowSettings = this.getReadabilityGlow();
    const worldPosition = source.localToWorld(this.x, this.y);
    const worldDirection = normalizeVector(direction.x * source.scale, direction.y * source.scale);
    const exit = rayExitRect(worldPosition, worldDirection, source.getCanvasRect());

    if (!exit) {
      return null;
    }

    const worldDistanceToExit = Math.hypot(exit.x - worldPosition.x, exit.y - worldPosition.y);
    const sourceGlowWorldRadius = glowSettings.radius * source.scale;

    // Only draw the continuation once the bullet's real aura reaches the seam. This is the
    // warning: The aura itself crosses first, rather than a separate border light appearing...
    if (worldDistanceToExit > sourceGlowWorldRadius) {
      return null;
    }

    const sourceExit = source.worldToLocal(exit.x, exit.y);
    const hit = this.game.findRaycastUniverse(exit.x, exit.y, worldDirection, source);
    const target = hit?.universe || source;
    let targetEntry;

    if (hit) {
      targetEntry = target.worldToLocal(hit.x, hit.y);
    } else {
      const hitLeft = sourceExit.x <= 0.001;
      const hitRight = sourceExit.x >= source.width - 0.001;
      const hitTop = sourceExit.y <= 0.001;
      const hitBottom = sourceExit.y >= source.height - 0.001;

      targetEntry = {
        x: hitLeft ? target.width : hitRight ? 0 : sourceExit.x,
        y: hitTop ? target.height : hitBottom ? 0 : sourceExit.y
      };
    }

    const targetDirection = normalizeVector(worldDirection.x / target.scale, worldDirection.y / target.scale) || direction;
    const targetDistanceToEntry = worldDistanceToExit / target.scale;

    return {
      universe: target,
      // Keep the glow center outside the destination by exactly the bullet's remaining distance
      // to the source seam. As it approaches, progressively more of the same radial glow becomes
      // visible in the destination canvas, when the center crosses, normal projectile drawing takes over...
      x: targetEntry.x - targetDirection.x * targetDistanceToEntry,
      y: targetEntry.y - targetDirection.y * targetDistanceToEntry
    };
  }

  drawWrappedReadabilityGlow() {
    const projection = this.getWrappedGlowProjection();

    if (!projection) {
      return;
    }

    this.drawReadabilityGlowAt(projection.universe.ctx, projection.x, projection.y);
  }

  draw() {
    const ctx = this.universe.ctx;
    this.drawWrappedReadabilityGlow();
    this.drawReadabilityGlow(ctx);
    ctx.save();
    ctx.translate(pixelSnap(this.x), pixelSnap(this.y));
    ctx.rotate(Math.atan2(this.velY, this.velX) + Math.PI / 2);
    const defaultImage = this.owner === 'player' ? pixelArt.playerBullet : pixelArt.enemyBullet;
    const image = this.sprite?.ready ? this.sprite : defaultImage;
    drawPixelArt(ctx, image, { time: this.game.spriteClock, pixelScale: this.spritePixelScale });
    ctx.restore();
  }
}