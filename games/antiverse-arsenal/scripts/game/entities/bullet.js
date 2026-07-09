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
    this.radius = 3;
    this.age = 0;
    this.dead = false;
    this.wrapCount = 0;
    this.maxWraps = options.maxWraps ?? MAX_WRAPS;
    this.scoreMultiplier = scoreMultiplier || 1;
    this.multiUniversalWrapCount = 0;
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

  checkHits() {
    const player = this.game.player;

    if (this.universe === player.universe && !player.dashing) {
      const canHitOwner = this.owner === 'player' && this.age > 0.42;

      if (this.owner === 'enemy' || canHitOwner) {
        const r = this.radius + player.radius;

        if (distSq(this.x, this.y, player.x, player.y) < r * r) {
          this.game.playerHit(this.velX, this.velY);
          this.dead = true;
          return;
        }
      }
    }

    for (const asteroid of this.universe.asteroids) {

      const r = this.radius + asteroid.radius;

      if (distSq(this.x, this.y, asteroid.x, asteroid.y) < r * r) {
        asteroid.takeDamage(1, this.scoreMultiplier);
        this.game.recordWrapShotHit(this);
        this.dead = true;
        return;
      }
    }

    if (this.owner === 'player') {

      for (const enemy of this.universe.enemies) {

        const r = this.radius + enemy.radius;

        if (distSq(this.x, this.y, enemy.x, enemy.y) < r * r) {
          enemy.takeDamage(1, this.scoreMultiplier);
          this.game.recordWrapShotHit(this);
          this.game.onEnemyHit(enemy, this.scoreMultiplier);
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
    const image = this.owner === 'player' ? pixelArt.playerBullet : pixelArt.enemyBullet;
    drawPixelArt(ctx, image, 16, { time: this.game.spriteClock });
    ctx.restore();
  }
}