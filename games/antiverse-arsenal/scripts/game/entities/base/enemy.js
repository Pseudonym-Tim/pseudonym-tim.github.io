// Shared base enemy ship class...
class Enemy extends Damageable {
  constructor(game, universe, x, y, config = {}) {
    super(game, universe, x, y, config.radius ?? 12);
    this.enemyType = config.enemyType || 'normal';
    this.maxHp = config.maxHp ?? 5;
    this.hp = this.maxHp;
    this.healthBarTimer = 0;
    this.accel = config.accel ?? 78;
    this.accelPerRound = config.accelPerRound ?? 3;
    this.maxSpeed = config.maxSpeed ?? 105;
    this.maxSpeedPerRound = config.maxSpeedPerRound ?? 4;
    this.fireDelayMin = config.fireDelayMin ?? 2.35;
    this.fireDelayMax = config.fireDelayMax ?? 4.0;
    this.firePressure = config.firePressure ?? 0.08;
    this.bulletSpeed = config.bulletSpeed ?? 195;
    this.bulletMaxWraps = config.bulletMaxWraps ?? MAX_WRAPS;
    this.color = config.color || '#ff4d5a';
    this.sprite = config.sprite || pixelArt.enemyNormal;
    this.spriteScale = config.spriteScale ?? 1.1;
    this.fireTimer = rand(this.fireDelayMin, this.fireDelayMax);
    this.angle = Math.random() * Math.PI * 2;
    this.avoidanceX = 0;
    this.avoidanceY = 0;
    this.maxWraps = Infinity;
  }

  update(dt) {
    this.healthBarTimer = Math.max(0, this.healthBarTimer - dt);
    this.updateDamageFlash(dt);
    this.steerTowardPlayer(dt);
    this.updateWeapon(dt);
    this.move(dt);
  }

  steerTowardPlayer(dt) {
    const player = this.game.player;
    const me = this.universe.localToWorld(this.x, this.y);
    const them = player.universe.localToWorld(player.x, player.y);
    const dx = them.x - me.x;
    const dy = them.y - me.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    this.angle = Math.atan2(dy, dx);

    const avoidance = this.getEnemyAvoidance();
    const avoidanceSmoothing = 1 - Math.exp(-7.5 * dt);
    this.avoidanceX += (avoidance.x - this.avoidanceX) * avoidanceSmoothing;
    this.avoidanceY += (avoidance.y - this.avoidanceY) * avoidanceSmoothing;

    const accel = this.accel + this.game.round * this.accelPerRound;
    this.velX += (dx / distance) * accel * dt;
    this.velY += (dy / distance) * accel * dt;

    this.velX += this.avoidanceX * accel * 1.45 * dt;
    this.velY += this.avoidanceY * accel * 1.45 * dt;
    
    const speed = Math.hypot(this.velX, this.velY);
    const maxSpeed = this.maxSpeed + this.game.round * this.maxSpeedPerRound;

    if (speed > maxSpeed) {
      this.velX = (this.velX / speed) * maxSpeed;
      this.velY = (this.velY / speed) * maxSpeed;
    }
  }

  updateWeapon(dt) {
    this.fireTimer -= dt;

    if (this.fireTimer <= 0) {
      this.resetFireTimer();
      this.firePrimaryWeapon();
    }
  }

  resetFireTimer() {
    const roundPressure = Math.min(0.9, this.game.round * this.firePressure);
    this.fireTimer = rand(this.fireDelayMin, this.fireDelayMax) - roundPressure;
  }

  firePrimaryWeapon() {
    this.fireAtPlayer(0, this.bulletSpeed, this.bulletMaxWraps);
  }

  fireAtPlayer(angleOffset = 0, speed = this.bulletSpeed, maxWraps = this.bulletMaxWraps) {
    const player = this.game.player;
    const me = this.universe.localToWorld(this.x, this.y);
    const them = player.universe.localToWorld(player.x, player.y);
    const angle = Math.atan2(them.y - me.y, them.x - me.x) + angleOffset;

    this.game.spawnBullet(
      this.universe,
      this.x + Math.cos(angle) * this.radius,
      this.y + Math.sin(angle) * this.radius,
      Math.cos(angle) * speed + this.velX * 0.2,
      Math.sin(angle) * speed + this.velY * 0.2,
      'enemy',
      1,
      { maxWraps }
    );
  }

  getEnemyAvoidance() {
    const desiredSpacing = this.radius * 5.4;
    const desiredSpacingSq = desiredSpacing * desiredSpacing;
    let pushX = 0;
    let pushY = 0;

    for (const other of this.universe.enemies) {
      if (other === this || other.dead || other.expired) continue;

      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const dSq = dx * dx + dy * dy;
      if (dSq >= desiredSpacingSq) continue;

      if (dSq <= 0.0001) {
        pushX += Math.cos(this.angle) * 0.35;
        pushY += Math.sin(this.angle) * 0.35;
        continue;
      }

      const distance = Math.sqrt(dSq);
      const closeness = 1 - distance / desiredSpacing;
      const softPush = closeness * closeness;
      pushX += (dx / distance) * softPush;
      pushY += (dy / distance) * softPush;
    }

    const pushLength = Math.hypot(pushX, pushY);
    if (pushLength > 1) {
      pushX /= pushLength;
      pushY /= pushLength;
    }

    return { x: pushX, y: pushY };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);
    this.drawShip(ctx);
    ctx.restore();
    this.drawHealthBar(ctx);
  }

  drawShip(ctx) {
    const sprite = this.sprite?.ready ? this.sprite : pixelArt.enemyNormal;
    drawPixelArt(ctx, sprite, this.radius * 3.1, {
      time: this.game.spriteClock,
      scale: this.spriteScale,
      flashAlpha: this.getDamageFlashAlpha()
    });
  }

  drawHealthBar(ctx) {
    if (this.healthBarTimer <= 0 || this.hp <= 0 || this.hp >= this.maxHp) return;

    const alpha = clamp(this.healthBarTimer / 0.55, 0, 1);
    const width = 32;
    const height = 5;
    const x = this.x - width / 2;
    const y = this.y - this.radius - 20;
    const fillWidth = width * clamp(this.hp / this.maxHp, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(3, 7, 18, 0.88)';
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = this.color;
    ctx.fillRect(x, y, fillWidth, height);
    ctx.strokeStyle = 'rgba(255, 225, 225, 0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
    ctx.restore();
  }
}