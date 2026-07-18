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
          player.takeDamage(this.velX, this.velY);
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