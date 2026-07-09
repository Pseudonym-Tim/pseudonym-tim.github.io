// Slow, durable enemy ship that fires a three-shot spread...
class ShotgunEnemy extends Enemy {
  constructor(game, universe, x, y) {
    super(game, universe, x, y, {
      enemyType: 'shotgun',
      maxHp: 10,
      accel: 48,
      accelPerRound: 1.7,
      maxSpeed: 72,
      maxSpeedPerRound: 2.1,
      fireDelayMin: 4.6,
      fireDelayMax: 6.6,
      firePressure: 0.035,
      bulletSpeed: 178,
      bulletMaxWraps: 1,
      sprite: pixelArt.enemyShotgun,
      spriteScale: 1.22
    });
  }

  firePrimaryWeapon() {
    for (const spread of [-0.18, 0, 0.18]) {
      this.fireAtPlayer(spread, this.bulletSpeed, this.bulletMaxWraps);
    }
  }
}