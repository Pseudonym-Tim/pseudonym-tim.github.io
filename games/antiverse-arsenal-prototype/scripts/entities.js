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
    this.fireRate = 0.24;
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
  }

  update(dt) {
    const keys = this.game.keys;
    const firing = Boolean(keys.Space);
    const moveX = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const moveY = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    const movement = normalizeVector(moveX, moveY);

    const aimAngle = this.game.getMouseAimAngle();

    if (aimAngle !== null && !this.dashing) {
      const aimResponsiveness = 1 - Math.exp(-28 * dt);
      this.angle = lerpAngle(this.angle, aimAngle, aimResponsiveness);
    }

    this.cooldown -= dt;
    this.warpCooldown = Math.max(0, this.warpCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.blink = Math.max(0, this.blink - dt);

    if (this.dashing) {
      this.updateDash(dt);
      return;
    }

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
      this.fire();
      this.cooldown = this.fireRate;
    }

    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    this.game.wrapEntity(this, { sameUniverse: true, countWrap: false, scoreMultiplier: false });
  }

  getDashDirection() {
    const keys = this.game.keys;
    const moveX = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const moveY = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
    return normalizeVector(moveX, moveY);
  }

  tryDash() {
    if (!this.game.canStartDash() || this.dashing || this.dashCooldown > 0) return false;
    const direction = this.getDashDirection();
    if (!direction) return false;
    this.dashDirX = direction.x;
    this.dashDirY = direction.y;
    this.dashElapsed = 0;
    this.dashHitEntities = new Set();
    this.dashing = true;
    this.velX = this.dashDirX * DASH_SPEED;
    this.velY = this.dashDirY * DASH_SPEED;
    this.angle = Math.atan2(this.dashDirY, this.dashDirX);
    this.game.flashMessage(formatText('message.phaseDash'), 260);
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
    if (!this.dashing) return;
    this.dashing = false;
    this.dashCooldown = DASH_COOLDOWN;
    const carrySpeed = 300 + this.extraThrust * 0.3;
    this.velX = this.dashDirX * carrySpeed;
    this.velY = this.dashDirY * carrySpeed;
    this.dashHitEntities.clear();
  }

  fire() {
    const baseMult = 1;
    const aimAngle = this.angle;
    const hasMultiShot = this.game.hasPowerup('multi');
    const angles = hasMultiShot ? [aimAngle, aimAngle - 0.2, aimAngle + 0.2] : [aimAngle];

    angles.forEach((angle) => {
      const x = this.x + Math.cos(angle) * (this.radius + 3);
      const y = this.y + Math.sin(angle) * (this.radius + 3);
      const vx = Math.cos(angle) * BULLET_SPEED + this.velX * 0.15;
      const vy = Math.sin(angle) * BULLET_SPEED + this.velY * 0.15;
      this.game.spawnBullet(this.universe, x, y, vx, vy, 'player', baseMult, {
        maxWraps: hasMultiShot ? 1 : MAX_WRAPS
      });
    });
  }

  draw(ctx) {
    if (this.blink > 0 && Math.floor(this.blink * 16) % 2 === 0) return;
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

    drawPixelArt(ctx, pixelArt.player, this.radius * 3.1, {
      alpha: this.dashing ? 1 : 0.9,
      time: this.game.spriteClock,
      scale: 1.1
    });

    ctx.restore();
  }
}

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
    this.dead = false;
    this.wrapCount = 0;
    this.maxWraps = MAX_WRAPS;
    this.killMultiplier = 1;
  }

  takeDamage(amount, multiplier = 1) {
    if (this.dead) return;
    this.hp -= amount;
    this.healthBarTimer = 3;
    if (this.hp <= 0) {
      this.hp = 0;
      // (Score the kill from the projectile that actually delivered the final hit)...
      this.killMultiplier = Math.max(1, multiplier || 1);
      this.dead = true;
    }
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

class Enemy extends Damageable {
  constructor(game, universe, x, y) {
    super(game, universe, x, y, 12);
    this.maxHp = 5;
    this.hp = this.maxHp;
    this.healthBarTimer = 0;
    this.fireTimer = rand(2.0, 3.6);
    this.angle = Math.random() * Math.PI * 2;
    this.maxWraps = Infinity;
  }

  update(dt) {
    this.healthBarTimer = Math.max(0, this.healthBarTimer - dt);
    const player = this.game.player;
    const me = this.universe.localToWorld(this.x, this.y);
    const them = player.universe.localToWorld(player.x, player.y);
    const dx = them.x - me.x;
    const dy = them.y - me.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    this.angle = Math.atan2(dy, dx);

    const accel = 78 + this.game.round * 3;
    this.velX += (dx / distance) * accel * dt;
    this.velY += (dy / distance) * accel * dt;

    const speed = Math.hypot(this.velX, this.velY);
    const maxSpeed = 105 + this.game.round * 4;

    if (speed > maxSpeed) {
      this.velX = (this.velX / speed) * maxSpeed;
      this.velY = (this.velY / speed) * maxSpeed;
    }

    this.fireTimer -= dt;

    if (this.fireTimer <= 0) {
      const roundPressure = Math.min(0.9, this.game.round * 0.08);
      this.fireTimer = rand(2.35, 4.0) - roundPressure;
      this.fireAtPlayer();
    }

    this.move(dt);
  }

  fireAtPlayer() {
    const player = this.game.player;
    const me = this.universe.localToWorld(this.x, this.y);
    const them = player.universe.localToWorld(player.x, player.y);
    const angle = Math.atan2(them.y - me.y, them.x - me.x);
    const speed = 195;

    this.game.spawnBullet(
      this.universe,
      this.x + Math.cos(angle) * this.radius,
      this.y + Math.sin(angle) * this.radius,
      Math.cos(angle) * speed + this.velX * 0.2,
      Math.sin(angle) * speed + this.velY * 0.2,
      'enemy',
      1
    );
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);

    drawPixelArt(ctx, pixelArt.enemy, this.radius * 3.1, { 
      time: this.game.spriteClock,
      scale: 1.1
    });
    
    ctx.restore();

    if (this.healthBarTimer > 0 && this.hp > 0 && this.hp < this.maxHp) {
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
      ctx.fillStyle = 'rgba(255, 77, 90, 0.95)';
      ctx.fillRect(x, y, fillWidth, height);
      ctx.strokeStyle = 'rgba(255, 225, 225, 0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
      ctx.restore();
    }
  }
}

class HullPickup {
  constructor(game, universe, x, y) {
    this.game = game;
    this.universe = universe;
    this.x = x;
    this.y = y;
    this.radius = 15;
    this.age = Math.random() * Math.PI * 2;
    this.collected = false;
  }

  update(dt) {
    this.age += dt;
  }

  collect() {
    if (this.collected || this.game.hp >= MAX_PLAYER_HULL) return false;
    this.collected = true;
    const restored = MAX_PLAYER_HULL - this.game.hp;
    this.game.hp = MAX_PLAYER_HULL;
    this.game.addFloatingText(this.universe, this.x, this.y - 20, formatText('float.fullRepair', { amount: restored }), '#72f7ff', 1.08);
    this.game.flashMessage(formatText('message.hullRestored'), 750);
    return true;
  }

  draw(ctx) {
    const pulse = 1 + Math.sin(this.age * 3.5) * 0.08;
    const glow = 0.55 + Math.sin(this.age * 2.7) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.globalAlpha = 0.2 + glow * 0.22;
    ctx.fillStyle = '#72f7ff';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.scale(pulse, pulse);
    drawPixelArt(ctx, pixelArt.hullPickup, this.radius * 2.0, { time: this.game.spriteClock });
    ctx.restore();
  }
}

class Asteroid extends Damageable {
  constructor(game, universe, x, y, size = 3) {
    const radius = size === 3 ? 34 : size === 2 ? 22 : 13;
    super(game, universe, x, y, radius);
    this.size = size;
    this.hp = 1;
    this.seed = Math.random() * 999;
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(20, 62);
    this.velX = Math.cos(angle) * speed;
    this.velY = Math.sin(angle) * speed;
    this.spin = rand(-1.4, 1.4);
    this.rotation = rand(0, Math.PI * 2);
  }

  update(dt) {
    this.rotation += this.spin * dt;
    this.move(dt);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    drawPixelArt(ctx, pixelArt.asteroid, this.radius * 2.25, { time: this.game.spriteClock });
    ctx.restore();
  }
}

class FloatingText {
  constructor(game, universe, x, y, text, color = '#ffd25c', scale = 1) {
    this.game = game;
    this.universe = universe;
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.scale = scale;
    this.age = 0;
    this.life = 1.05;
    this.velX = rand(-10, 10);
    this.velY = rand(-44, -30);
    this.dead = false;
  }

  update(dt) {
    this.age += dt;
    this.x += this.velX * dt;
    this.y += this.velY * dt;
    this.velY += 16 * dt;
    if (this.age >= this.life) this.dead = true;
  }

  draw() {
    if (!this.universe || !this.universesIncludes()) return;
    const ctx = this.universe.ctx;
    const t = clamp(this.age / this.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.font = `${Math.round(16 * this.scale)}px "Lucida Console", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    ctx.fillStyle = this.color;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }

  universesIncludes() {
    return this.game.universes.includes(this.universe);
  }
}