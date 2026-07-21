// A close-to-medium range fighter that fires two leading shots in parallel...
class DoubleShotEnemy extends Enemy {
  constructor(game, universe, x, y) {
    super(game, universe, x, y, {
      enemyType: 'double-shot',
      maxHp: 7,
      accel: 60,
      accelPerRound: 3.8,
      maxSpeed: 126,
      maxSpeedPerRound: 4.8,
      fireDelayMin: 2.55,
      fireDelayMax: 3.45,
      firePressure: 0.075,
      bulletSpeed: 235,
      bulletMaxWraps: 1,
      shotLeading: 0.96,
      maxLeadTime: 2.15,
      aimError: 0.018,
      avoidanceSkill: 0.9,
      avoidanceLookAhead: 1.7,
      sprite: pixelArt.enemyDoubleShot,
      spritePixelScale: 2
    });

    this.shotSpacing = 16;
  }
  
  steerTowardPlayer(dt) {
    super.steerTowardPlayer(dt);

    // The ship's nose, telegraph, and bullet all share this leading aim direction...
    const leadAngle = this.getPlayerInterceptAngle(this.bulletSpeed);
    const aimResponsiveness = 1 - Math.exp(-this.aimResponsiveness * dt);
    this.angle = lerpAngle(this.angle, leadAngle, aimResponsiveness);
  }

  firePrimaryWeapon() {
    const angle = this.angle;
    const forwardX = Math.cos(angle);
    const forwardY = Math.sin(angle);
    const sideX = -forwardY;
    const sideY = forwardX;
    const muzzleDistance = this.radius;

    for (const side of [-1, 1]) {
      this.game.spawnBullet(this.universe, this.x + forwardX * muzzleDistance + sideX * this.shotSpacing * side, this.y + forwardY * muzzleDistance + sideY * this.shotSpacing * side, forwardX * this.bulletSpeed + this.velX * 0.2, forwardY * this.bulletSpeed + this.velY * 0.2, 'enemy', 1, { maxWraps: this.bulletMaxWraps });
    }
  }
}
