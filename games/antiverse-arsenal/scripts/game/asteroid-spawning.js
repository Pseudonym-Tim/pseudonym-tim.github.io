// Round asteroid spawning logic...
Object.assign(Game.prototype, {
  totalPrimaryAsteroids(choices = this.universes) {
    return choices.reduce((total, universe) => {
      const livePrimaryAsteroids = universe.asteroids.filter(
        (asteroid) => asteroid.primary && !asteroid.dead
      ).length;

      return total + livePrimaryAsteroids;
    }, 0);
  },

  getRoundAsteroidTarget() {
    return clamp(2 + Math.floor((this.round - 1) / 2), 2, MAX_PRIMARY_ASTEROIDS);
  },

  getRoundAsteroidSpawnCount() {
    return clamp(1 + Math.floor((this.round - 1) / 3), 1, 3);
  },

  spawnAsteroids(count, choices = this.universes) {
    for (let i = 0; i < count; i++) {
      const u = choices[Math.floor(Math.random() * choices.length)];
      const pos = this.safePosition(u, 130, { enemyDistance: 80, asteroidDistance: 95 });
      const asteroid = new Asteroid(this, u, pos.x, pos.y, 2);
      asteroid.primary = true;
      u.asteroids.push(asteroid);
    }
  }
});