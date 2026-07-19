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
    this.spriteScale = options.spriteScale ?? 1;
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
      remainingDt -= stepDt;
      safetySteps += 1;

      this.checkHits();

      if (!this.dead) {
        this.game.wrapEntity(this, { sameUniverse: true, countWrap: true, scoreMultiplier: true });
      }
    }
  }

  getCollisionShape() {
    return circleCollisionShape(this.x, this.y, this.radius);
  }

  checkHits() {
    const player = this.game.player;

    if (this.universe === player.universe && !player.dashing) {
      const canHitOwner = this.owner === 'player' && this.age > 0.42;

      if (this.owner === 'enemy' || canHitOwner) {
        if (collisionShapesOverlap(this.getCollisionShape(), entityCollisionShape(player))) {
          player.takeDamage(this.velX, this.velY, this.damage);
          this.dead = true;
          return;
        }
      }
    }

    for (const asteroid of this.universe.asteroids) {
      if (collisionShapesOverlap(this.getCollisionShape(), entityCollisionShape(asteroid))) {
        asteroid.takeDamage(this.damage, this.scoreMultiplier);
        this.game.recordWrapShotHit(this);
        this.dead = true;
        return;
      }
    }

    if (this.owner === 'player') {
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

  getWrapWarning() {
    const direction = normalizeVector(this.velX, this.velY);

    // The final wrap deliberately has no preview...
    if (!direction || this.wrapCount >= this.maxWraps - 1) {
      return null;
    }

    const source = this.universe;
    const worldPosition = source.localToWorld(this.x, this.y);
    const worldDirection = normalizeVector(direction.x * source.scale, direction.y * source.scale);
    const exit = rayExitRect(worldPosition, worldDirection, source.getCanvasRect());

    if (!exit) {
      return null;
    }

    const distance = Math.hypot(exit.x - worldPosition.x, exit.y - worldPosition.y) / source.scale;

    if (distance > WRAP_WARNING_DISTANCE) {
      return null;
    }

    const approach = 1 - distance / WRAP_WARNING_DISTANCE;
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

    const targetDirection = normalizeVector(worldDirection.x / target.scale, worldDirection.y / target.scale);
    const travelDistance = 24;

    const slideAlongBorder = (point, universe, localDirection) => {
      const onVerticalBorder = point.x <= 0.001 || point.x >= universe.width - 0.001;
      const offset = approach * travelDistance;

      // Warning lights remain on their border and only slide along tangent so you can judge what direction they're travelling roughly...
      // (Vertical borders follow vertical movement, while horizontal borders follow horizontal movement)...
      return onVerticalBorder
        ? { x: point.x, y: point.y + localDirection.y * offset }
        : { x: point.x + localDirection.x * offset, y: point.y };
    };

    return {
      // Each wrap softens the remaining warning so old repeated shots become less distracting..
      alpha: Math.pow(approach, 1.15) * (1 - this.wrapCount / this.maxWraps),
      lights: [
        { universe: source, ...slideAlongBorder(sourceExit, source, direction) },
        { universe: target, ...slideAlongBorder(targetEntry, target, targetDirection) }
      ]
    };
  }

  drawWrapWarning() {
    const warning = this.getWrapWarning();

    if (!warning) {
      return;
    }

    const [red, green, blue] = this.owner === 'player' ? [143, 255, 143] : [255, 121, 94];
    const intensity = clamp(warning.alpha * 0.2, 0, 1);
    const radius = 30 + intensity * 20;

    for (const light of warning.lights) {
      const ctx = light.universe.ctx;
      const x = clamp(light.x, WRAP_WARNING_INSET, light.universe.width - WRAP_WARNING_INSET);
      const y = clamp(light.y, WRAP_WARNING_INSET, light.universe.height - WRAP_WARNING_INSET);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);

      glow.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${intensity})`);
      glow.addColorStop(0.18, `rgba(${red}, ${green}, ${blue}, ${intensity * 0.7})`);
      glow.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    }
  }

  draw() {
    const ctx = this.universe.ctx;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.velY, this.velX) + Math.PI / 2);
    const defaultImage = this.owner === 'player' ? pixelArt.playerBullet : pixelArt.enemyBullet;
    const image = this.sprite?.ready ? this.sprite : defaultImage;
    drawPixelArt(ctx, image, 16, { time: this.game.spriteClock, scale: this.spriteScale });
    ctx.restore();
  }
}