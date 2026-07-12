// Damage/wrapping base class...
class Damageable {
  constructor(game, universe, x, y, radius) {
    this.game = game;
    this.universe = universe;
    this.x = x;
    this.y = y;
    this.velX = 0;
    this.velY = 0;
    this.radius = radius;
    this.hp = 1;
    this.maxHp = 1;
    this.healthBarTimer = 0;
    this.damageFlashTimer = 0;
    this.damageFlashDuration = 0.16;
    this.dead = false;
    this.wrapCount = 0;
    this.maxWraps = MAX_WRAPS;
    this.killMultiplier = 1;
  }

  getCollisionShape() {
    return circleCollisionShape(this.x, this.y, this.radius);
  }

  takeDamage(amount, multiplier = 1) {
    if (this.dead) return;
    this.hp -= amount;
    this.game.sound.play('hitHurt');

    this.healthBarTimer = this instanceof Asteroid ? 2 : 3;
    this.triggerDamageFlash();

    if (this.hp <= 0) {
      this.hp = 0;

      if (this instanceof Asteroid)
      {
        this.game.sound.play('explosion');
      }

      // (Score the kill from the projectile that actually delivered the final hit)...
      this.killMultiplier = Math.max(1, multiplier || 1);
      this.dead = true;
    }
  }

  triggerDamageFlash(duration = this.damageFlashDuration) {
    this.damageFlashTimer = Math.max(this.damageFlashTimer, duration);
  }

  updateDamageFlash(dt) {
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
  }

  getDamageFlashAlpha() {
    return clamp(this.damageFlashTimer / this.damageFlashDuration, 0, 1);
  }

  move(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.velX * dt;
    this.y += this.velY * dt;
    if (this.offscreenEntryTimer > 0) {
      this.offscreenEntryTimer = Math.max(0, this.offscreenEntryTimer - dt);
      if (this.x >= this.radius && this.x <= LOGICAL_W - this.radius && this.y >= this.radius && this.y <= LOGICAL_H - this.radius) {
        this.offscreenEntryTimer = 0;
      }
    } else {
      this.game.wrapEntity(this, { sameUniverse: true, countWrap: true, scoreMultiplier: false });
    }
  }
}