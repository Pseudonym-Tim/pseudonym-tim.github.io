// Destructible dreadnought homing missile...
class HomingRocket extends Damageable {
  constructor(game, universe, x, y, vx, vy) {
    super(game, universe, x, y, 10);
    this.hp = 3;
    this.maxHp = 3;
    this.owner = 'enemy';
    this.velX = vx;
    this.velY = vy;
    this.speed = 205;
    this.turnRate = 2.15;
    this.life = 0;
    this.smokeTimer = 0;
    this.smoke = [];
  }

  update(dt) {
    this.life += dt;
    this.healthBarTimer = Math.max(0, this.healthBarTimer - dt);
    this.updateDamageFlash(dt);
    const player = this.game.player;
    const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
    const currentAngle = Math.atan2(this.velY, this.velX);
    const angle = currentAngle + clamp(angleDelta(targetAngle, currentAngle), -this.turnRate * dt, this.turnRate * dt);
    const launchSpeed = Math.hypot(this.velX, this.velY);
    const speed = Math.min(this.speed, launchSpeed + 75 * dt);
    this.velX = Math.cos(angle) * speed;
    this.velY = Math.sin(angle) * speed;
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    this.smokeTimer -= dt;

    if (this.smokeTimer <= 0) {
      this.smokeTimer += 0.035;
      this.smoke.push({ x: this.x - Math.cos(angle) * 12, y: this.y - Math.sin(angle) * 12, age: 0, life: rand(0.38, 0.62), size: rand(4, 8) });
    }

    for (const puff of this.smoke) {
      puff.age += dt;
    }

    this.smoke = this.smoke.filter((puff) => puff.age < puff.life);

    if (this.life > 9 || this.x < -40 || this.x > this.universe.width + 40 || this.y < -40 || this.y > this.universe.height + 40) {
      this.dead = true;
    }
  }

  takeDamage(amount, source) {
    if (this.dead || source?.owner !== 'player') {
      return false;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.healthBarTimer = 0.55;
    this.triggerDamageFlash();
    this.game.sound.play('hitHurt');
    if (this.hp <= 0) { this.explode(); }

    return true;
  }

  explode() {
    if (this.dead) { return; }
    
    this.dead = true;
    this.game.spawnExplosion(this.universe, this.x, this.y, { size: 48, soundEffect: 'explosion', velX: this.velX * 0.06, velY: this.velY * 0.06 });
  }

  draw() {
    const ctx = this.universe.ctx;

    for (const puff of this.smoke) {
      const t = puff.age / puff.life;
      ctx.fillStyle = `rgba(160, 174, 184, ${0.48 * (1 - t)})`;
      const size = pixelSnap(puff.size * (1 + t));
      ctx.fillRect(pixelSnap(puff.x - size / 2), pixelSnap(puff.y - size / 2), size, size);
    }

    const sprite = pixelArt.bossRocket;

    if (!sprite?.ready) { return; }

    const angleFromUp = (Math.atan2(this.velY, this.velX) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const directionFrame = Math.round(angleFromUp / (Math.PI * 2) * 8) % 8;
    const thrustFrame = Math.floor(this.game.spriteClock * 12) % 2;

    ctx.save();
    ctx.translate(pixelSnap(this.x), pixelSnap(this.y));

    // Very cool sprite-based rotation frame stuff...
    drawPixelArt(ctx, sprite, {
      animation: `direction-${directionFrame}-thrust-${thrustFrame}`,
      time: this.game.spriteClock,
      scale: 3,
      flashAlpha: this.getDamageFlashAlpha(),
      dropShadow: true
    });

    ctx.restore();
    this.drawHealthBar(ctx);
  }

  drawHealthBar(ctx) {
    if (this.healthBarTimer <= 0 || this.hp <= 0) {
      return;
    }

    const width = 24;
    const height = 3;
    const x = pixelSnap(this.x - width / 2);
    const y = pixelSnap(this.y - 21);
    const ratio = clamp(this.hp / this.maxHp, 0, 1);
    const fade = clamp(this.healthBarTimer / 0.2, 0, 1);

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(3, 7, 18, 0.9)';
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = '#ff4d8d';
    ctx.fillRect(x, y, pixelSnap(width * ratio), height);
    ctx.restore();
  }
}