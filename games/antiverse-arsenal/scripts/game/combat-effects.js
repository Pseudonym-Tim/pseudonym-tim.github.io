// Combat effects...
Object.assign(Game.prototype, {
  spawnShipDebris(universe, source, options = {}) {
    if (!universe || !source) {
      return null;
    }

    const debris = new DestroyedShipDebris(this, universe, source, options);
    universe.shipDebris.push(debris);
    return debris;
  },

  spawnExplosion(universe, x, y, options = {}) {
    if (!universe) {
      return null;
    }

    if (options.soundEffect && options.playSound !== false) {
      this.sound.play(options.soundEffect);
    }

    const explosion = new ExplosionFX(this, universe, x, y, options);
    this.explosions.push(explosion);
    return explosion;
  },

  spawnWarpParticles(universe, x, y, options = {}) {
    if (!universe) {
      return null;
    }

    const burst = new WarpParticleFX(this, universe, x, y, options);
    this.explosions.push(burst);
    return burst;
  }
});