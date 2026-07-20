// Player entity...
class Player {
  constructor(game, universe, x, y) {
    this.game = game;
    this.universe = universe;
    this.x = x;
    this.y = y;
    this.velX = 0;
    this.velY = 0;
    this.angle = 0;
    this.radius = 11;
    this.cooldown = 0;
    this.baseFireRate = 0.24;
    this.fireRate = this.baseFireRate;
    this.burstShotsRemaining = 0;
    this.burstShotTimer = 0;
    this.wrapCount = 0;
    this.maxWraps = MAX_WRAPS;
    this.extraThrust = 0;
    this.warpCooldown = 0;
    this.dashCooldown = 0;
    this.dashing = false;
    this.dashElapsed = 0;
    this.dashDirX = 1;
    this.dashDirY = 0;
    this.dashHitEntities = new Set();
    this.blink = 0;
    this.damageFlashTimer = 0;
    this.damageFlashDuration = 0.16;
    this.roll = 0;
    this.maxRoll = 0.52;
    this.rollResponsiveness = 12;
  }

  getCollisionShape() {
    return circleCollisionShape(this.x, this.y, this.radius);
  }

  takeDamage(sourceVX = 0, sourceVY = 0, damage = 1) {
    const game = this.game;
    if (game.invulnerable || game.debugInvulnerable || this.dashing || !game.running) {
      return;
    }

    game.hp -= damage;
    game.sound.play('hitHurt');
    this.universe.triggerDamageShake();
    game.invulnerable = true;
    this.triggerDamageFlash();
    game.addFloatingText(this.universe, this.x, this.y - 18, formatText('float.hullDamage'), '#ff4d5a');
    game.triggerHitStop(0.06, 0.28, 0.24);

    setTimeout(() => { game.invulnerable = false; }, 900);

    const force = Math.max(1, Math.hypot(sourceVX, sourceVY));
    this.velX += (sourceVX / force) * 120;
    this.velY += (sourceVY / force) * 120;

    if (game.hp <= 0) {
      game.hp = 0;
      this.universe.triggerDamageShake();
      game.spawnShipDebris(this.universe, this, { initialRotation: this.angle + Math.PI / 2 });
      game.spawnExplosion(this.universe, this.x, this.y, { soundEffect: 'explosion', size: this.radius * 5.2, velX: this.velX * 0.06, velY: this.velY * 0.06 });
      game.gameOver();
    }
  }

  update(dt) {
    const keys = this.game.keys;
    const firing = Boolean(keys.Space);
    const moveX = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const moveY = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    const movement = normalizeVector(moveX, moveY);

    const aimAngle = this.game.getMouseAimAngle();

    if (aimAngle !== null && !this.dashing) {
      const turnDelta = angleDelta(aimAngle, this.angle);
      const aimResponsiveness = 1 - Math.exp(-16 * dt);
      const rollResponsiveness = 1 - Math.exp(-this.rollResponsiveness * dt);
      this.roll += (clamp(turnDelta * 1.45, -this.maxRoll, this.maxRoll) - this.roll) * rollResponsiveness;
      this.angle = lerpAngle(this.angle, aimAngle, aimResponsiveness);
    } else {
      const rollReset = 1 - Math.exp(-this.rollResponsiveness * dt);
      this.roll += (0 - this.roll) * rollReset;
    }

    this.cooldown -= dt;
    this.warpCooldown = Math.max(0, this.warpCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.blink = Math.max(0, this.blink - dt);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);

    if (this.dashing) {
      this.updateDash(dt);
      return;
    }

    this.updateBurst(dt);

    const maxSpeed = 335 + this.extraThrust * 0.55;

    if (movement) {
      const desiredVX = movement.x * maxSpeed;
      const desiredVY = movement.y * maxSpeed;
      const movementResponse = 1 - Math.exp(-(11.2 + this.extraThrust * 0.004) * dt);
      this.velX += (desiredVX - this.velX) * movementResponse;
      this.velY += (desiredVY - this.velY) * movementResponse;
    } else {
      const stopResponse = Math.exp(-13 * dt);
      this.velX *= stopResponse;
      this.velY *= stopResponse;
    }

    if (firing && !this.game.laserCharging && this.cooldown <= 0) {
      if (this.game.hasPowerup('sniper')) {
        this.fireSniperShot();
        this.cooldown = SNIPER_COOLDOWN;
      } else if (this.game.hasPowerup('burst')) {
        this.startBurst();
        this.cooldown = BURST_COOLDOWN;
      } else {
        this.fire();
        this.cooldown = this.fireRate;
      }
    }

    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    this.game.wrapEntity(this, { sameUniverse: true, countWrap: false, scoreMultiplier: false });
  }

  updateBurst(dt) {
    if (this.burstShotsRemaining <= 0) {
      return;
    }

    this.burstShotTimer -= dt;
    while (this.burstShotsRemaining > 0 && this.burstShotTimer <= 0) {
      this.fire(BURST_BULLET_SPEED);
      this.burstShotsRemaining -= 1;
      this.burstShotTimer += BURST_SHOT_INTERVAL;
    }
  }

  startBurst() {
    this.fire(BURST_BULLET_SPEED);
    this.burstShotsRemaining = BURST_SHOT_COUNT - 1;
    this.burstShotTimer = BURST_SHOT_INTERVAL;
  }

  getDashDirection() {
    const keys = this.game.keys;
    const moveX = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const moveY = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
    return normalizeVector(moveX, moveY);
  }

  tryDash() {
    if (!this.game.canStartDash() || this.dashing || this.dashCooldown > 0) {
      return false;
    }

    const direction = this.getDashDirection();
    if (!direction) {
      return false;
    }

    this.dashDirX = direction.x;
    this.dashDirY = direction.y;
    this.dashElapsed = 0;
    this.dashHitEntities = new Set();
    this.dashing = true;
    this.game.sound.play('phaseDash');
    this.velX = this.dashDirX * DASH_SPEED;
    this.velY = this.dashDirY * DASH_SPEED;
    this.angle = Math.atan2(this.dashDirY, this.dashDirX);
    this.roll = 0;
    this.game.addFloatingText(this.universe, this.x, this.y - 16, formatText('float.dash'), '#72f7ff');
    return true;
  }

  updateDash(dt) {
    let remainingDt = dt;
    let safetySteps = 0;

    while (remainingDt > 0.000001 && this.dashing && safetySteps < 512) {
      const stepDt = Math.min(remainingDt, DASH_STEP_DISTANCE / DASH_SPEED);
      this.prevX = this.x;
      this.prevY = this.y;
      this.x += this.dashDirX * DASH_SPEED * stepDt;
      this.y += this.dashDirY * DASH_SPEED * stepDt;
      this.velX = this.dashDirX * DASH_SPEED;
      this.velY = this.dashDirY * DASH_SPEED;
      this.angle = Math.atan2(this.dashDirY, this.dashDirX);
      this.roll = 0;
      this.dashElapsed += stepDt;
      remainingDt -= stepDt;
      safetySteps += 1;

      this.game.wrapEntity(this, { sameUniverse: true, countWrap: false, scoreMultiplier: false });
      this.game.applyDashDamage(this);

      if (this.dashElapsed >= DASH_MIN_DURATION && !this.game.playerOverlapsDashObstacle(this)) {
        this.endDash();
        break;
      }

      if (this.dashElapsed >= DASH_MAX_DURATION) {
        this.game.pushDashToSafety(this);
        this.endDash();
        break;
      }
    }
  }

  endDash() {
    if (!this.dashing) {
      return;
    }

    this.dashing = false;
    this.dashCooldown = DASH_COOLDOWN;
    const carrySpeed = 300 + this.extraThrust * 0.3;
    this.velX = this.dashDirX * carrySpeed;
    this.velY = this.dashDirY * carrySpeed;
    this.dashHitEntities.clear();
  }

  fire(bulletSpeed = NORMAL_BULLET_SPEED) {
    const baseMult = 1;
    const aimAngle = this.angle;
    const hasMultiShot = this.game.hasPowerup('multi');
    const hasDualShot = this.game.hasPowerup('dual');
    const angles = hasMultiShot ? [aimAngle, aimAngle - 0.2, aimAngle + 0.2] : [aimAngle];
    const dualShotOffset = 16;
    this.game.sound.play('shoot');

    angles.forEach((angle) => {
      const vx = Math.cos(angle) * bulletSpeed + this.velX * 0.15;
      const vy = Math.sin(angle) * bulletSpeed + this.velY * 0.15;
      const muzzleX = this.x + Math.cos(angle) * (this.radius + 3);
      const muzzleY = this.y + Math.sin(angle) * (this.radius + 3);
      const lateralX = -Math.sin(angle) * dualShotOffset;
      const lateralY = Math.cos(angle) * dualShotOffset;
      const offsets = hasDualShot ? [-1, 1] : [0];
      
      offsets.forEach((offset) => {
        // Passing the entire known universe as arguments...
        // BUT THAT'S TOTALLY OKAY BECAUSE THIS IS A NICE LITTLE WRAPPER FUNCTION, RIGHT?
        this.game.spawnBullet(this.universe, muzzleX + lateralX * offset, muzzleY + lateralY * offset, vx, vy, 'player', baseMult, { maxWraps: hasMultiShot ? 1 : MAX_WRAPS, playSound: false });
      });
    });
  }

  fireSniperShot() {
    const angle = this.angle;
    const x = this.x + Math.cos(angle) * (this.radius + 3);
    const y = this.y + Math.sin(angle) * (this.radius + 3);
    const vx = Math.cos(angle) * SNIPER_SPEED + this.velX * 0.08;
    const vy = Math.sin(angle) * SNIPER_SPEED + this.velY * 0.08;
    this.game.sound.play('shoot');
    this.game.spawnBullet(this.universe, x, y, vx, vy, 'player', 1, { damage: SNIPER_DAMAGE, maxWraps: 0, playSound: false, });
  }

  triggerDamageFlash(duration = this.damageFlashDuration) {
    this.damageFlashTimer = Math.max(this.damageFlashTimer, duration);
  }

  getDamageFlashAlpha() {
    return clamp(this.damageFlashTimer / this.damageFlashDuration, 0, 1);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.dashing) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#72f7ff';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(-52, 0);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(-37, 0);
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(Math.PI / 2);

    drawPixelArt(ctx, pixelArt.player, this.radius * 3.1, { alpha: this.dashing ? 1 : 0.9, time: this.game.spriteClock, scale: 1.1, flashAlpha: this.getDamageFlashAlpha() });

    ctx.restore();
  }
}