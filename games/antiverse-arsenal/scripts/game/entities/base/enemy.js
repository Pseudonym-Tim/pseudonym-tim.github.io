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
    this.spritePixelScale = config.spritePixelScale ?? 2;
    this.leavesDebris = config.leavesDebris ?? true;
    this.fireTimer = rand(this.fireDelayMin, this.fireDelayMax);
    this.angle = Math.random() * Math.PI * 2;
    this.roll = 0;
    this.ignoreRoll = config.ignoreRoll ?? false;
    this.maxRoll = config.maxRoll ?? 0.48;
    this.aimResponsiveness = config.aimResponsiveness ?? 8.5;
    this.shotLeading = clamp(config.shotLeading ?? 0.65, 0, 1);
    this.maxLeadTime = config.maxLeadTime ?? 1.8;
    this.aimError = config.aimError ?? 0.045;
    this.aimBias = rand(-this.aimError, this.aimError);
    this.avoidanceSkill = clamp(config.avoidanceSkill ?? 0.75, 0, 1);
    this.avoidanceLookAhead = config.avoidanceLookAhead ?? 1.35;
    this.asteroidCollisionCooldown = 0;
    this.rollResponsiveness = config.rollResponsiveness ?? 9.5;
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
    this.handleAsteroidCollisions(dt);
  }

  registerHit(multiplier = 1) {
    if (this.expired) {
      return;
    }

    this.game.awardPoints(ENEMY_HIT_SCORE, multiplier, this.universe, this.x, this.y - 14, '#fff3a3');
  }

  onDestroyed() {
    if (!this.expired) {
      this.universe.triggerDamageShake();

      if (this.leavesDebris) {
        // Holy function parameters Batman!
        // TODO: Don't hardcode dreadnought boss stuff here...
        this.game.spawnShipDebris(this.universe, this, this.enemyType === 'boss' ? {
          initialRotation: this.tilt,
          sprite: pixelArt.bossDreadnought?.[this.spriteState || this.getDamageSpriteState()] || pixelArt.bossDreadnought?.intact,
          spritePixelScale: this.spritePixelScale,
          isBoss: true
        } : { initialRotation: this.angle + Math.PI / 2 });
      }
    }

    this.game.spawnExplosion(this.universe, this.x, this.y, { soundEffect: 'explosion', size: this.radius * 4.4, velX: this.velX * 0.08, velY: this.velY * 0.08 });
    this.game.clearEnemyThreat(this);

    if (this === this.game.boss || this.enemyType === 'boss') {
      this.game.finishBossEncounter();
      return;
    }

    if (!this.destroyedByAsteroid) {
      this.game.awardPoints(ENEMY_SCORE, Math.max(1, this.killMultiplier || 1), this.universe, this.x, this.y + 8, '#ffd25c');
    }

    this.game.tryEndRoundFromThreats();
  }

  steerTowardPlayer(dt) {
    const player = this.game.player;
    const me = this.universe.localToWorld(this.x, this.y);
    const them = player.universe.localToWorld(player.x, player.y);
    const dx = them.x - me.x;
    const dy = them.y - me.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const aimAngle = Math.atan2(dy, dx);
    const turnDelta = angleDelta(aimAngle, this.angle);
    const aimResponsiveness = 1 - Math.exp(-this.aimResponsiveness * dt);
    this.angle = lerpAngle(this.angle, aimAngle, aimResponsiveness);

    if (this.ignoreRoll) {
      this.roll = 0;
    } else {
      const rollResponsiveness = 1 - Math.exp(-this.rollResponsiveness * dt);
      const targetRoll = clamp(turnDelta * 1.35, -this.maxRoll, this.maxRoll);
      this.roll += (targetRoll - this.roll) * rollResponsiveness;
    }

    const avoidance = this.getEnemyAvoidance();
    const avoidanceSmoothing = 1 - Math.exp(-7.5 * dt);
    this.avoidanceX += (avoidance.x - this.avoidanceX) * avoidanceSmoothing;
    this.avoidanceY += (avoidance.y - this.avoidanceY) * avoidanceSmoothing;

    const accel = this.accel + this.game.round * this.accelPerRound;
    this.velX += (dx / distance) * accel * dt;
    this.velY += (dy / distance) * accel * dt;

    const avoidanceForce = 1.5 + this.avoidanceSkill * 2.5;
    this.velX += this.avoidanceX * accel * avoidanceForce * dt;
    this.velY += this.avoidanceY * accel * avoidanceForce * dt;

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
    const angle = this.getPlayerInterceptAngle(speed) + angleOffset;

    // Passing the entire known universe as arguments...
    // BUT THAT'S TOTALLY OKAY BECAUSE THIS IS A NICE LITTLE WRAPPER FUNCTION, RIGHT?
    this.game.spawnBullet(this.universe, this.x + Math.cos(angle) * this.radius, this.y + Math.sin(angle) * this.radius, Math.cos(angle) * speed + this.velX * 0.2, Math.sin(angle) * speed + this.velY * 0.2, 'enemy', 1, { maxWraps });
  }

  getPlayerInterceptAngle(projectileSpeed) {
    const player = this.game.player;
    const me = this.universe.localToWorld(this.x, this.y);
    const them = player.universe.localToWorld(player.x, player.y);
    const shooterScale = this.universe.scale || 1;
    const playerScale = player.universe.scale || 1;
    const relativeX = them.x - me.x;
    const relativeY = them.y - me.y;
    const projectileWorldSpeed = Math.max(1, projectileSpeed * shooterScale);
    const targetVX = player.velX * playerScale * this.shotLeading;
    const targetVY = player.velY * playerScale * this.shotLeading;
    const inheritedVX = this.velX * shooterScale * 0.2;
    const inheritedVY = this.velY * shooterScale * 0.2;
    const velocityX = targetVX - inheritedVX;
    const velocityY = targetVY - inheritedVY;
    const a = velocityX * velocityX + velocityY * velocityY - projectileWorldSpeed * projectileWorldSpeed;
    const b = 2 * (relativeX * velocityX + relativeY * velocityY);
    const c = relativeX * relativeX + relativeY * relativeY;
    let interceptTime = 0;

    if (Math.abs(a) < 0.0001) {
      interceptTime = b < -0.0001 ? -c / b : 0;
    } else {
      const discriminant = b * b - 4 * a * c;

      if (discriminant >= 0) {
        const root = Math.sqrt(discriminant);
        const first = (-b - root) / (2 * a);
        const second = (-b + root) / (2 * a);
        interceptTime = first > 0 && second > 0 ? Math.min(first, second) : Math.max(first, second, 0);
      }
    }

    interceptTime = clamp(interceptTime, 0, this.maxLeadTime);
    return Math.atan2(relativeY + targetVY * interceptTime, relativeX + targetVX * interceptTime) + this.aimBias;
  }

  getEnemyAvoidance() {
    let pushX = 0;
    let pushY = 0;

    for (const other of this.universe.enemies) {
      if (other === this || other.dead || other.expired) {
        continue;
      }

      const result = this.getObstacleAvoidance(other, this.radius + other.radius + 42, this.avoidanceLookAhead);
      pushX += result.x * result.weight;
      pushY += result.y * result.weight;
    }

    for (const asteroid of this.universe.asteroids) {
      if (asteroid.dead || asteroid.expired) {
        continue;
      }

      const clearance = this.radius + asteroid.radius + 35 + this.avoidanceSkill * 45;
      const result = this.getObstacleAvoidance(asteroid, clearance, this.avoidanceLookAhead + this.avoidanceSkill * 1.15);
      pushX += result.x * result.weight * (1.4 + this.avoidanceSkill * 2.4);
      pushY += result.y * result.weight * (1.4 + this.avoidanceSkill * 2.4);
    }

    const pushLength = Math.hypot(pushX, pushY);

    if (pushLength > 1) {
      pushX /= pushLength;
      pushY /= pushLength;
    }

    return { x: pushX * this.avoidanceSkill, y: pushY * this.avoidanceSkill };
  }

  getObstacleAvoidance(obstacle, clearance, lookAhead) {
    const relativeX = obstacle.x - this.x;
    const relativeY = obstacle.y - this.y;
    const relativeVX = (obstacle.velX || 0) - this.velX;
    const relativeVY = (obstacle.velY || 0) - this.velY;
    const relativeSpeedSq = relativeVX * relativeVX + relativeVY * relativeVY;
    const closestTime = relativeSpeedSq > 0.01 ? clamp(-(relativeX * relativeVX + relativeY * relativeVY) / relativeSpeedSq, 0, lookAhead) : 0;
    const closestX = relativeX + relativeVX * closestTime;
    const closestY = relativeY + relativeVY * closestTime;
    const closestDistance = Math.hypot(closestX, closestY);

    if (closestDistance >= clearance) {
      return { x: 0, y: 0, weight: 0 };
    }

    const fallbackX = Math.cos(this.angle + Math.PI / 2);
    const fallbackY = Math.sin(this.angle + Math.PI / 2);
    const inverseDistance = 1 / Math.max(0.001, closestDistance);
    const urgency = 1 - closestDistance / clearance;
    const timeUrgency = 1 - closestTime / Math.max(0.001, lookAhead);

    return {
      x: closestDistance > 0.001 ? -closestX * inverseDistance : fallbackX,
      y: closestDistance > 0.001 ? -closestY * inverseDistance : fallbackY,
      weight: urgency * urgency * (1.2 + timeUrgency)
    };
  }

  handleAsteroidCollisions(dt) {
    this.asteroidCollisionCooldown = Math.max(0, this.asteroidCollisionCooldown - dt);

    for (const asteroid of this.universe.asteroids) {
      if (asteroid.dead || !entitiesOverlap(this, asteroid)) {
        continue;
      }

      const dx = this.x - asteroid.x;
      const dy = this.y - asteroid.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const normalX = Math.abs(dx) + Math.abs(dy) > 0.001 ? dx / distance : Math.cos(this.angle + Math.PI / 2);
      const normalY = Math.abs(dx) + Math.abs(dy) > 0.001 ? dy / distance : Math.sin(this.angle + Math.PI / 2);
      const overlap = this.radius + asteroid.radius - distance;
      this.x += normalX * Math.max(0, overlap + 1);
      this.y += normalY * Math.max(0, overlap + 1);
      this.velX += normalX * (80 + asteroid.size * 25);
      this.velY += normalY * (80 + asteroid.size * 25);

      if (this.asteroidCollisionCooldown <= 0) {
        this.takeDamage(Math.max(1, asteroid.size - 1), 1);
        this.destroyedByAsteroid = this.dead;
        this.asteroidCollisionCooldown = 0.45;
      }
      
      break;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(pixelSnap(this.x), pixelSnap(this.y));
    ctx.rotate(this.angle + Math.PI / 2);
    this.drawShip(ctx);
    ctx.restore();
    this.drawHealthBar(ctx);
  }

  drawShip(ctx) {
    const sprite = this.sprite?.ready ? this.sprite : pixelArt.enemyNormal;
    drawPixelArt(ctx, sprite, { time: this.game.spriteClock, pixelScale: this.spritePixelScale, flashAlpha: this.getDamageFlashAlpha() });
  }

  drawHealthBar(ctx) {
    if (this.healthBarTimer <= 0 || this.hp <= 0 || this.hp >= this.maxHp) {
      return;
    }

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
