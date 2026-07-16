// Player laser ability...
Object.assign(Game.prototype, {
  getLaserPlan() {
    const player = this.player;
    if (!player?.universe) return null;

    const angle = player.angle;
    const baseLocalDir = normalizeVector(Math.cos(angle), Math.sin(angle));
    const baseWorldAngle = localAngleToWorld(angle, player.universe);
    const worldDir = normalizeVector(Math.cos(baseWorldAngle), Math.sin(baseWorldAngle));
    if (!baseLocalDir || !worldDir) return null;

    const plan = { segments: [], locks: [] };
    let universe = player.universe;
    let localDir = { ...baseLocalDir };

    let startLocal = {
      x: player.x + localDir.x * (player.radius + 4),
      y: player.y + localDir.y * (player.radius + 4)
    };

    let wraps = 0;

    while (wraps <= MAX_WRAPS && universe) {
      const startWorld = universe.localToWorld(startLocal.x, startLocal.y);
      const exitWorld = rayExitRect(startWorld, worldDir, universe.getCanvasRect());

      if (!exitWorld) break;

      const rawEndLocal = universe.worldToLocal(exitWorld.x, exitWorld.y);

      const endLocal = {
        x: clamp(rawEndLocal.x, 0, universe.width),
        y: clamp(rawEndLocal.y, 0, universe.height)
      };

      const segment = { universe, from: { ...startLocal }, to: endLocal, wraps };
      plan.segments.push(segment);

      const segDx = endLocal.x - startLocal.x;
      const segDy = endLocal.y - startLocal.y;
      const segLen = Math.max(1, Math.hypot(segDx, segDy));
      const segDir = { x: segDx / segLen, y: segDy / segLen };

      for (const enemy of universe.enemies) {
        if (enemy.dead || enemy.expired || plan.locks.some((lock) => lock.enemy === enemy)) continue;
        const hit = rayCircleHit(startLocal, segDir, enemy, enemy.radius + LASER_LOCK_RADIUS, 0, segLen);
        if (hit) plan.locks.push({ enemy, universe, wraps, x: enemy.x, y: enemy.y, t: hit.t });
      }

      if (wraps >= MAX_WRAPS) break;

      const next = this.findRaycastUniverse(exitWorld.x + worldDir.x * 2, exitWorld.y + worldDir.y * 2, worldDir, universe);
      wraps += 1;

      if (next) {
        universe = next.universe;
        const inset = Math.max(3, 5 * universe.scale);
        startLocal = universe.worldToLocal(next.x + worldDir.x * inset, next.y + worldDir.y * inset);
        localDir = { ...baseLocalDir };
        continue;
      }

      const edgeInset = 0.5;

      startLocal = {
        x: rawEndLocal.x <= 0 ? universe.width - edgeInset : rawEndLocal.x >= universe.width ? edgeInset : clamp(rawEndLocal.x, edgeInset, universe.width - edgeInset),
        y: rawEndLocal.y <= 0 ? universe.height - edgeInset : rawEndLocal.y >= universe.height ? edgeInset : clamp(rawEndLocal.y, edgeInset, universe.height - edgeInset)
      };

      localDir = { ...baseLocalDir };
    }

    plan.locks.sort((a, b) => a.wraps - b.wraps || a.t - b.t);
    return plan;
  },

  updateLaser(dt) {
    this.laserCooldown = Math.max(0, this.laserCooldown - dt);
    const active = this.running && !this.isShopOpen() && !this.transitioning && !this.draggingUniverse && this.laserCooldown <= 0 && this.isLaserControlHeld();
    this.laserCharging = active;
    this.laserAim = active ? this.getLaserPlan() : null;
    if (active) this.timeScale = LASER_CHARGE_TIME_SCALE;
    else if (!this.draggingUniverse) this.timeScale = 1;

    for (let i = this.laserFlash.length - 1; i >= 0; i--) {
      this.laserFlash[i].life -= dt;
      if (this.laserFlash[i].life <= 0) this.laserFlash.splice(i, 1);
    }
  },

  releaseLaser() {
    if (!this.laserCharging || !this.laserAim?.locks.length) {
      this.laserCharging = false;
      this.laserAim = null;
      if (!this.draggingUniverse) this.timeScale = 1;
      return;
    }

    const plan = this.laserAim;
    this.sound.play('laserBeam');
    const hitEnemies = new Set();

    for (const lock of plan.locks) {
      if (lock.enemy.dead || lock.enemy.expired || hitEnemies.has(lock.enemy)) continue;
      hitEnemies.add(lock.enemy);
      lock.enemy.takeDamage(LASER_DAMAGE, 1 + lock.wraps);
      this.onEnemyHit(lock.enemy, 1 + lock.wraps);
      const laserText = lock.wraps > 0 ? formatText('float.laserWraps', { wraps: lock.wraps }) : formatText('float.laser');
      this.addFloatingText(lock.universe, lock.enemy.x, lock.enemy.y - 18, laserText, '#ff4df0');
    }

    for (const segment of plan.segments) {
      if (segment.universe !== this.player.universe) continue;
      const segDx = segment.to.x - segment.from.x;
      const segDy = segment.to.y - segment.from.y;
      const segLen = Math.max(1, Math.hypot(segDx, segDy));
      const segDir = { x: segDx / segLen, y: segDy / segLen };
      const startsAtMuzzle = distSq(segment.from.x, segment.from.y, this.player.x, this.player.y) < (this.player.radius + 8) ** 2;
      const hit = rayCircleHit(segment.from, segDir, this.player, this.player.radius + 3, startsAtMuzzle ? 20 : 0, segLen);
      
      if (hit) {
        this.playerHit(-segDir.x * 260, -segDir.y * 260);
        break;
      }
    }

    this.laserCooldown = LASER_COOLDOWN;
    this.laserFlash = plan.segments.map((segment) => ({ ...segment, life: 0.18, maxLife: 0.18 }));
    this.triggerHitStop(0.035, 0.18, 0.32);
    this.laserCharging = false;
    this.laserAim = null;
    if (!this.draggingUniverse) this.timeScale = 1;
  },

  drawLaserPlan(plan) {
    if (!plan) return;

    for (const segment of plan.segments) {
      const ctx = segment.universe.ctx;
      ctx.save();
      ctx.globalAlpha = Math.max(0.16, 0.72 - segment.wraps * 0.12);
      ctx.strokeStyle = '#ff4df0';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(segment.from.x, segment.from.y);
      ctx.lineTo(segment.to.x, segment.to.y);
      ctx.stroke();
      ctx.restore();
    }

    for (const lock of plan.locks) this.drawLaserReticle(lock);
  },

  drawLaserReticle(lock) {
    const ctx = lock.universe.ctx;
    const pulse = 1 + Math.sin(this.spriteClock * 18) * 0.08;
    ctx.save();
    ctx.translate(lock.x, lock.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#fffb8f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, lock.enemy.radius + 10, 0, Math.PI * 2);
    ctx.moveTo(-lock.enemy.radius - 16, 0);
    ctx.lineTo(-lock.enemy.radius - 5, 0);
    ctx.moveTo(lock.enemy.radius + 5, 0);
    ctx.lineTo(lock.enemy.radius + 16, 0);
    ctx.moveTo(0, -lock.enemy.radius - 16);
    ctx.lineTo(0, -lock.enemy.radius - 5);
    ctx.moveTo(0, lock.enemy.radius + 5);
    ctx.lineTo(0, lock.enemy.radius + 16);
    ctx.stroke();
    ctx.restore();

    const wrapText = `${lock.wraps}/${MAX_WRAPS} WRAP`;
    const wrapTextX = Math.round(lock.x);
    const wrapTextY = Math.round(lock.y - lock.enemy.radius - 22);
    ctx.save();
    ctx.font = '16px "Press Start 2P", "Lucida Console", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.fillText(wrapText, wrapTextX - 2, wrapTextY + 2);
    ctx.fillStyle = '#fffb8f';
    ctx.fillText(wrapText, wrapTextX, wrapTextY);
    ctx.restore();
  },

  drawLaserFlashes() {
    for (const flash of this.laserFlash) {
      const ctx = flash.universe.ctx;
      const alpha = clamp(flash.life / flash.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(flash.from.x, flash.from.y);
      ctx.lineTo(flash.to.x, flash.to.y);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = '#ff4df0';
      ctx.lineWidth = 15;
      ctx.stroke();
      ctx.restore();
    }
  }
});