// Safe spawn-position selection...
Object.assign(Game.prototype, {
  safePosition(u, minPlayerDistance = 100, spacing = {}) {
    const enemyDistance = spacing.enemyDistance ?? 0;
    const asteroidDistance = spacing.asteroidDistance ?? 0;

    for (let attempt = 0; attempt < 80; attempt++) {
      const x = rand(40, LOGICAL_W - 40);
      const y = rand(40, LOGICAL_H - 40);

      if (this.player && this.player.universe === u && distSq(x, y, this.player.x, this.player.y) <= minPlayerDistance * minPlayerDistance) {
        continue;
      }

      let spaced = true;

      if (enemyDistance > 0) {
        for (const enemy of u.enemies) {
          if (!enemy.dead && distSq(x, y, enemy.x, enemy.y) < enemyDistance * enemyDistance) {
            spaced = false;
            break;
          }
        }
      }

      if (!spaced) {
        continue;
      }

      if (asteroidDistance > 0) {
        for (const asteroid of u.asteroids) {
          const min = asteroidDistance + asteroid.radius;

          if (!asteroid.dead && distSq(x, y, asteroid.x, asteroid.y) < min * min) {
            spaced = false;
            break;
          }
        }
      }

      if (spaced) {
        return { x, y };
      }
    }

    return { x: rand(40, LOGICAL_W - 40), y: rand(40, LOGICAL_H - 40) };
  }
});