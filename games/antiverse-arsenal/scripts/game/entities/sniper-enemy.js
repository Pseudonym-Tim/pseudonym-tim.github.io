// A precise long-range ship that telegraphs a powerful bullet before releasing it...
class SniperEnemy extends Enemy {
  constructor(game, universe, x, y) {
    super(game, universe, x, y, {
      enemyType: 'sniper',
      maxHp: 10,
      accel: 52,
      accelPerRound: 1.8,
      maxSpeed: 90,
      maxSpeedPerRound: 2.4,
      fireDelayMin: 3.6,
      fireDelayMax: 4.4,
      firePressure: 0.03,
      bulletSpeed: 650,
      bulletMaxWraps: 1,
      shotLeading: 2,
      maxLeadTime: 3,
      aimError: 0.008,
      avoidanceSkill: 0.9,
      avoidanceLookAhead: 3,
      sprite: pixelArt.enemyChargeSniper,
      spritePixelScale: 2
    });

    this.chargeDuration = 1;
    this.chargeTimer = 0;
  }

  steerTowardPlayer(dt) {
    super.steerTowardPlayer(dt);

    // The ship's nose, telegraph, and bullet all share this leading aim direction...
    const leadAngle = this.getPlayerInterceptAngle(this.bulletSpeed);
    const aimResponsiveness = 1 - Math.exp(-this.aimResponsiveness * dt);
    this.angle = lerpAngle(this.angle, leadAngle, aimResponsiveness);
  }

  updateWeapon(dt) {
    if (this.chargeTimer > 0) {
      this.chargeTimer -= dt;

      if (this.chargeTimer <= 0) {
        this.fireChargedShot();
        this.resetFireTimer();
      }

      return;
    }

    this.fireTimer -= dt;

    if (this.fireTimer <= 0) {
      this.chargeTimer = this.chargeDuration;
    }
  }

  fireChargedShot() {
    // Recalculate at release so a moving player is led from their latest velocity...
    const angle = this.getPlayerInterceptAngle(this.bulletSpeed);

    // Passing the entire known universe as arguments...
    // BUT THAT'S TOTALLY OKAY BECAUSE THIS IS A NICE LITTLE WRAPPER FUNCTION, RIGHT?
    this.game.spawnBullet(this.universe, this.x + Math.cos(angle) * this.radius, this.y + Math.sin(angle) * this.radius, Math.cos(angle) * this.bulletSpeed + this.velX * 0.2, Math.sin(angle) * this.bulletSpeed + this.velY * 0.2, 'enemy', 1, { damage: 3, maxWraps: this.bulletMaxWraps });
  }

  draw(ctx) {
    if (this.chargeTimer > 0) {
      this.drawTargetingIndicator(ctx);
    }

    super.draw(ctx);
  }

  drawTargetingIndicator(ctx) {
    const localDirection = normalizeVector(Math.cos(this.angle), Math.sin(this.angle));
    const worldStart = this.universe.localToWorld(this.x, this.y);

    const worldDirection = normalizeVector(Math.cos(localAngleToWorld(this.angle, this.universe)), Math.sin(localAngleToWorld(this.angle, this.universe)));

    const worldEnd = rayExitRect(worldStart, worldDirection, this.universe.getCanvasRect());

    if (!localDirection || !worldEnd) {
      return;
    }

    const end = this.universe.worldToLocal(worldEnd.x, worldEnd.y);
    const charge = clamp(1 - this.chargeTimer / this.chargeDuration, 0, 1);
    const pulse = 1 + Math.sin(this.game.spriteClock * 18) * 0.08;

    ctx.save();
    ctx.globalAlpha = 0.38 + charge * 0.45;
    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 2 + charge;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(this.x + localDirection.x * (this.radius + 5), this.y + localDirection.y * (this.radius + 5));
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(pixelSnap(end.x), pixelSnap(end.y));
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#fff1a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9 + charge * 5, 0, Math.PI * 2);
    ctx.moveTo(-17, 0);
    ctx.lineTo(-6, 0);
    ctx.moveTo(6, 0);
    ctx.lineTo(17, 0);
    ctx.moveTo(0, -17);
    ctx.lineTo(0, -6);
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 17);
    ctx.stroke();
    ctx.restore();
  }
}
