// Standard enemy ship...
class NormalEnemy extends Enemy {
  constructor(game, universe, x, y) {
    super(game, universe, x, y, {
      enemyType: 'normal',
      maxHp: 5,
      accel: 78,
      accelPerRound: 3,
      maxSpeed: 105,
      maxSpeedPerRound: 4,
      fireDelayMin: 2.35,
      fireDelayMax: 4.0,
      firePressure: 0.08,
      bulletSpeed: 195,
      bulletMaxWraps: MAX_WRAPS,
      sprite: pixelArt.enemyNormal,
      spriteScale: 1.1
    });
  }
}