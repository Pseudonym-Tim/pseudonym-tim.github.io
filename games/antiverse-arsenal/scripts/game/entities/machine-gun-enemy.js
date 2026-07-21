// Fast enemy ship that fires short machine-gun bursts...
class MachineGunEnemy extends Enemy {
  constructor(game, universe, x, y) {
    super(game, universe, x, y, {
      enemyType: 'machinegun',
      maxHp: 5,
      accel: 112,
      accelPerRound: 4.8,
      maxSpeed: 152,
      maxSpeedPerRound: 5.8,
      fireDelayMin: 1.35,
      fireDelayMax: 2.2,
      firePressure: 0.065,
      bulletSpeed: 225,
      bulletMaxWraps: 1,
      shotLeading: 0.94,
      maxLeadTime: 2.1,
      aimError: 0.022,
      avoidanceSkill: 0.96,
      avoidanceLookAhead: 1.8,
      sprite: pixelArt.enemyMachineGun,
      spritePixelScale: 2
    });

    this.burstShotsRemaining = 0;
    this.burstShotTimer = 0;
  }

  updateWeapon(dt) {
    if (this.burstShotsRemaining > 0) {
      this.burstShotTimer -= dt;

      while (this.burstShotsRemaining > 0 && this.burstShotTimer <= 0) {
        this.fireAtPlayer(0, this.bulletSpeed, this.bulletMaxWraps);
        this.burstShotsRemaining -= 1;
        this.burstShotTimer += 0.13;
      }
    }

    super.updateWeapon(dt);
  }

  firePrimaryWeapon() {
    this.burstShotsRemaining = 5;
    this.burstShotTimer = 0;
  }
}
