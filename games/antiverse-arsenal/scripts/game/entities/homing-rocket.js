// Destructible homing rockets...
class HomingRocket extends Damageable {
  constructor(game, universe, x, y, vx, vy, owner = 'enemy') {
    super(game, universe, x, y, 10);
    this.hp = 3;
    this.maxHp = 3;
    this.owner = owner;
    this.velX = vx;
    this.velY = vy;
    this.speed = owner === 'player' ? 285 : 205;
    this.turnRate = 2.15;
    this.separationRadius = 78;
    this.separationStrength = 1.15;
    this.life = 0;
    this.smokeTimer = 0;
    this.smoke = [];
  }

  update(dt) {
    this.life += dt;
    this.healthBarTimer = Math.max(0, this.healthBarTimer - dt);
    this.updateDamageFlash(dt);
    const target = this.owner === 'player' ? this.findPlayerTarget() : this.game.player;
    let targetX = target ? target.x - this.x : this.velX;
    let targetY = target ? target.y - this.y : this.velY;
    const targetDistance = Math.hypot(targetX, targetY) || 1;
    targetX /= targetDistance;
    targetY /= targetDistance;

    // Blend flock separation into homing so salvo approaches on distinct paths...
    let separationX = 0;
    let separationY = 0;

    for (const rocket of this.game.rockets) {
      if (rocket === this || rocket.dead || rocket.owner !== this.owner || rocket.universe !== this.universe) { continue; }

      const dx = this.x - rocket.x;
      const dy = this.y - rocket.y;
      const distance = Math.hypot(dx, dy);
      
      if (distance <= 0 || distance >= this.separationRadius) { continue; }

      const proximity = 1 - distance / this.separationRadius;
      separationX += dx / distance * proximity;
      separationY += dy / distance * proximity;
    }

    const desiredX = targetX + separationX * this.separationStrength;
    const desiredY = targetY + separationY * this.separationStrength;
    const targetAngle = Math.atan2(desiredY, desiredX);
    const currentAngle = Math.atan2(this.velY, this.velX);
    const angle = currentAngle + clamp(angleDelta(targetAngle, currentAngle), -this.turnRate * dt, this.turnRate * dt);
    const launchSpeed = Math.hypot(this.velX, this.velY);
    const speed = Math.min(this.speed, launchSpeed + 75 * dt);
    this.velX = Math.cos(angle) * speed;
    this.velY = Math.sin(angle) * speed;
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    if (this.owner === 'player') {
      this.checkEnemyHit();
    }

    this.smokeTimer -= dt;

    if (this.smokeTimer <= 0) {
      this.smokeTimer += 0.035;
      this.smoke.push({ x: this.x - Math.cos(angle) * 12, y: this.y - Math.sin(angle) * 12, age: 0, life: rand(0.38, 0.62), size: rand(4, 8) });
    }

    for (const puff of this.smoke) {
      puff.age += dt;
    }

    this.smoke = this.smoke.filter((puff) => puff.age < puff.life);

    if (this.life > 9 || this.x < -20 || this.x > this.universe.width + 20 || this.y < -20 || this.y > this.universe.height + 20) {
      this.explode();
    }
  }

  findPlayerTarget() {
    let closest = null;
    let closestDistance = Infinity;

    for (const enemy of this.universe.enemies) {
      if (enemy.dead || enemy.expired) { continue; }
      const distance = Math.hypot(enemy.x - this.x, enemy.y - this.y);

      if (distance < closestDistance) {
        closest = enemy;
        closestDistance = distance;
      }
    }

    return closest;
  }

  checkEnemyHit() {
    for (const enemy of this.universe.enemies) {
      if (enemy.dead || enemy.expired) { continue; }

      if (entitiesOverlap(this, enemy)) {
        enemy.registerHit(1);
        enemy.takeDamage(HOMING_ROCKET_DAMAGE, 1);
        this.explode();
        return;
      }
    }
  }

  takeDamage(amount, source) {
    if (this.owner !== 'enemy' || this.dead || source?.owner !== 'player') {
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

    const sprite = this.owner === 'player' && pixelArt.playerRocket ? pixelArt.playerRocket : pixelArt.bossRocket;

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