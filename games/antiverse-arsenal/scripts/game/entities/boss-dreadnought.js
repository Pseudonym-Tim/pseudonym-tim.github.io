// Simple boss ship with two independently damageable launchers...
class DreadnoughtBoss extends Enemy {
  constructor(game, universe) {
    super(game, universe, universe.width / 2, -130, {
      enemyType: 'boss',
      radius: 190,
      maxHp: 120,
      accel: 0,
      maxSpeed: 0,
      fireDelayMin: 0.32,
      fireDelayMax: 0.58,
      bulletSpeed: 235,
      bulletMaxWraps: 0
    });

    this.name = formatText('boss.dreadnought.name');
    this.spriteScale = 1;
    this.angle = 0;
    this.y = -150;
    this.targetY = 155;
    this.entrySpeed = 72;
    this.moveTargetX = this.x;
    this.moveTimer = 0.6;
    this.tilt = 0;
    this.maxTilt = 0.05;
    this.aiMode = 'align';
    this.aiTimer = 5;

    this.parts = [
      { id: 'leftLauncher', name: formatText('boss.part.leftLauncher'), offsetX: -145, offsetY: 0, radius: 50, width: 100, height: 160, maxHp: 60, hp: 60, destroyed: false, fireTimer: 0.45 },
      { id: 'rightLauncher', name: formatText('boss.part.rightLauncher'), offsetX: 145, offsetY: 0, radius: 50, width: 100, height: 160, maxHp: 60, hp: 60, destroyed: false, fireTimer: 0.65 }
    ];

    this.coreShotguns = [
      { offsetX: -42, offsetY: 96, fireTimer: 1.1 },
      { offsetX: 42, offsetY: 96, fireTimer: 1.65 }
    ];

    this.maxHp = 120;
    this.hp = this.maxHp;
    this.healthBarTimer = Infinity;
    this.damageFlashDuration = 0.12;
    this.spriteState = 'intact';
  }

  update(dt) {
    this.healthBarTimer = Infinity;
    this.updateDamageFlash(dt);

    if (this.y < this.targetY) {
      this.prevX = this.x;
      this.prevY = this.y;
      this.y = Math.min(this.targetY, this.y + this.entrySpeed * dt);
      return;
    }

    this.updateMovement(dt);
    this.updateLaunchers(dt);
    this.updateCoreShotguns(dt);
  }

  updateMovement(dt) {
    this.aiTimer -= dt;

    if (this.allLaunchersDestroyed()) {
      const player = this.game.player;
      this.aiMode = 'align';
      this.aiTimer = 5;
      this.moveTargetX = clamp(player.x, this.radius + 20, this.universe.width - this.radius - 20);
    } else if (this.aiMode === 'align') {
      const player = this.game.player;
      this.moveTargetX = clamp(player.x, this.radius + 20, this.universe.width - this.radius - 20);

      if (this.aiTimer <= 0) {
        this.aiMode = 'random';
        this.aiTimer = rand(1.6, 3.1);
        this.moveTimer = 0;
      }
    } else {
      this.moveTimer -= dt;

      if (this.moveTimer <= 0 || Math.abs(this.x - this.moveTargetX) < 7) {
        this.moveTimer = rand(0.55, 1.2);
        this.moveTargetX = clamp(this.universe.width / 2 + rand(-250, 250), this.radius + 20, this.universe.width - this.radius - 20);
      }

      if (this.aiTimer <= 0) {
        this.aiMode = 'align';
        this.aiTimer = 5;
      }
    }

    const response = 1 - Math.exp(-2.2 * dt);
    this.velX += (this.moveTargetX - this.x) * response * 2.1;
    this.velX *= Math.exp(-2.8 * dt);
    this.prevX = this.x;
    this.prevY = this.y;
    this.x = clamp(this.x + this.velX * dt, this.radius, this.universe.width - this.radius);

    const targetTilt = clamp(this.velX * 0.0022, -this.maxTilt, this.maxTilt);
    const tiltResponse = 1 - Math.exp(-5.8 * dt);
    this.tilt += (targetTilt - this.tilt) * tiltResponse;
  }

  updateLaunchers(dt) {
    for (const part of this.parts) {
      if (part.destroyed) {
        continue;
      }

      part.fireTimer -= dt;
      if (part.fireTimer > 0) {
        continue;
      }

      part.fireTimer = rand(0.28, 0.56);
      this.fireLauncher(part);
    }
  }

  updateCoreShotguns(dt) {
    for (const gun of this.coreShotguns) {
      gun.fireTimer -= dt;
      if (gun.fireTimer > 0) {
        continue;
      }

      gun.fireTimer = this.allLaunchersDestroyed() ? rand(0.65, 1.2) : rand(1.15, 2.15);
      this.fireCoreShotgun(gun);
    }
  }

  allLaunchersDestroyed() {
    return this.parts.every((part) => part.destroyed);
  }

  fireLauncher(part) {
    const baseX = this.x + part.offsetX;
    const baseY = this.y + part.offsetY + 30;
    const aim = Math.PI / 2 + rand(-0.34, 0.34);
    const spread = 0.13;

    for (const offset of [-spread, spread]) {
      const angle = aim + offset;

      // Passing the entire known universe as arguments...
      // BUT THAT'S TOTALLY OKAY BECAUSE THIS IS A NICE LITTLE WRAPPER FUNCTION, RIGHT?
      this.game.spawnBullet(this.universe, baseX + Math.cos(angle) * 18, baseY + Math.sin(angle) * 18, Math.cos(angle) * this.bulletSpeed + this.velX * 0.08, Math.sin(angle) * this.bulletSpeed, 'enemy', 1, { maxWraps: 0 });
    }
  }

  fireCoreShotgun(gun) {
    const baseX = this.x + gun.offsetX;
    const baseY = this.y + gun.offsetY;
    const aim = Math.PI / 2 + rand(-0.18, 0.18);

    for (const spread of [-0.24, 0, 0.24]) {
      const angle = aim + spread + rand(-0.055, 0.055);
      const speed = rand(250, 310);

      // Passing the entire known universe as arguments...
      // BUT THAT'S TOTALLY OKAY BECAUSE THIS IS A NICE LITTLE WRAPPER FUNCTION, RIGHT?
      this.game.spawnBullet(this.universe, baseX + Math.cos(angle) * 16, baseY + Math.sin(angle) * 16, Math.cos(angle) * speed + this.velX * 0.05, Math.sin(angle) * speed, 'enemy', 1, { maxWraps: 0, sprite: pixelArt.bossShotgunBullet, spriteScale: 1.15 });
    }
  }

  getCoreCollisionShape() {
    return boxCollisionShape(this.x, this.y + 8, 170, 248);
  }

  getCollisionShape() {
    return [this.getCoreCollisionShape(), ...this.parts.filter((part) => !part.destroyed).map((part) => this.getPartCollisionShape(part))];
  }

  getPartCollisionShape(part) {
    return boxCollisionShape(this.x + part.offsetX, this.y + part.offsetY, part.width, part.height);
  }

  getPartAt(x, y, radius = 0) {
    let best = null;
    let bestArea = Infinity;
    const hitShape = radius > 0 ? circleCollisionShape(x, y, radius) : null;

    for (const part of this.parts) {
      if (part.destroyed) {
        continue;
      }

      const partShape = this.getPartCollisionShape(part);
      const hit = hitShape ? collisionShapesOverlap(hitShape, partShape) : pointInCollisionShape(x, y, partShape);

      if (!hit) {
        continue;
      }

      const area = part.width * part.height;

      if (area < bestArea) {
        best = part;
        bestArea = area;
      }
    }

    return best;
  }

  takeDamage(amount, multiplier = 1, hitX = this.x, hitY = this.y, hitRadius = 0) {
    if (this.dead) {
      return;
    }

    const part = this.getPartAt(hitX, hitY, hitRadius);

    if (part) {
      part.hp = Math.max(0, part.hp - amount);
      this.healthBarTimer = Infinity;
      this.triggerDamageFlash();
      this.game.sound.play('hitHurt');
      
      if (part.hp <= 0 && !part.destroyed) {
        this.destroyPart(part, multiplier);
      }

      return;
    }

    const hitShape = hitRadius > 0 ? circleCollisionShape(hitX, hitY, hitRadius) : null;
    const coreShape = this.getCoreCollisionShape();
    const hitCore = hitShape ? collisionShapesOverlap(hitShape, coreShape) : pointInCollisionShape(hitX, hitY, coreShape);

    if (!hitCore) {
      return;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.healthBarTimer = Infinity;
    this.triggerDamageFlash();
    this.game.sound.play('hitHurt');

    if (this.hp <= 0) {
      this.killMultiplier = Math.max(1, multiplier || 1);
      this.dead = true;
    }
  }

  destroyPart(part, multiplier = 1) {
    part.destroyed = true;
    this.spriteState = this.getDamageSpriteState();

    for (let i = 0; i < 8; i++) {
      // Passing the entire known universe as arguments...
      // BUT THAT'S TOTALLY OKAY BECAUSE THIS IS A NICE LITTLE WRAPPER FUNCTION, RIGHT?
      this.game.spawnExplosion(this.universe, this.x + part.offsetX + rand(-part.radius, part.radius), this.y + part.offsetY + rand(-part.radius, part.radius), {
        size: rand(22, 48),
        soundEffect: i === 0 ? 'explosion' : null,
        velX: rand(-35, 35),
        velY: rand(-20, 50)
      });
    }

    this.hp = Math.max(0, this.hp - 25);
    this.game.addFloatingText(this.universe, this.x + part.offsetX, this.y + part.offsetY - 34, `${part.name} DISABLED -25 CORE`, '#ffcf7a');
    this.killMultiplier = Math.max(this.killMultiplier || 1, multiplier || 1);

    if (this.hp <= 0) {
      this.killMultiplier = Math.max(1, multiplier || 1);
      this.dead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);
    this.drawBossSprite(ctx);
    ctx.restore();
    this.drawPartHealthBars(ctx);
    this.drawBossHealthBar(ctx);
  }

  getDamageSpriteState() {
    const leftBroken = this.parts.find((part) => part.id === 'leftLauncher')?.destroyed;
    const rightBroken = this.parts.find((part) => part.id === 'rightLauncher')?.destroyed;
    
    if (leftBroken && rightBroken) {
      return 'bothLaunchersBroken';
    }

    if (leftBroken) {
      return 'leftLauncherBroken';
    }

    if (rightBroken) {
      return 'rightLauncherBroken';
    }

    return 'intact';
  }

  drawBossSprite(ctx) {
    const state = this.spriteState || this.getDamageSpriteState();
    const sprites = pixelArt.bossDreadnought || {};
    const sprite = sprites[state] || sprites.intact;

    const drawWidth = 384 * this.spriteScale;
    const drawHeight = 264 * this.spriteScale;

    drawPixelArtFrame(ctx, sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight, { time: this.game.spriteClock, flashAlpha: this.getDamageFlashAlpha() });
  }

  drawPartHealthBars(ctx) {
    for (const part of this.parts) {
      if (part.destroyed) {
        continue;
      }

      const width = 48;
      const x = this.x + part.offsetX - width / 2;
      const y = this.y + part.offsetY + part.height / 2 + 8;
      const ratio = clamp(part.hp / part.maxHp, 0, 1);
      ctx.save();
      ctx.fillStyle = 'rgba(3, 7, 18, 0.88)';
      ctx.fillRect(x - 1, y - 1, width + 2, 6);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x, y, width * ratio, 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(x - 0.5, y - 1.5, width + 1, 7);
      ctx.restore();
    }
  }

  drawBossHealthBar(ctx) {
    const width = Math.min(620, this.universe.width - 80);
    const x = (this.universe.width - width) / 2;
    const y = 18;
    const ratio = clamp(this.hp / this.maxHp, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(3, 7, 18, 0.86)';
    ctx.fillRect(x - 3, y - 3, width + 6, 24);
    ctx.fillStyle = '#3d1430';
    ctx.fillRect(x, y, width, 14);
    ctx.fillStyle = '#ff4d8d';
    ctx.fillRect(x, y, width * ratio, 14);
    ctx.strokeStyle = '#ffd6e7';
    ctx.strokeRect(x - 0.5, y - 0.5, width + 1, 15);
    const hpText = formatText('boss.hp', { name: this.name, hp: Math.ceil(this.hp), maxHp: this.maxHp });
    const hpTextX = Math.round(this.universe.width / 2);
    const hpTextY = Math.round(y + 35);
    ctx.font = '16px "Press Start 2P", "Lucida Console", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.fillText(hpText, hpTextX - 2, hpTextY + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(hpText, hpTextX, hpTextY);
    ctx.restore();
  }
}