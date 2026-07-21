// Projectile creation and wrapped-shot tracking...
Object.assign(Game.prototype, {
  spawnBullet(universe, x, y, vx, vy, owner, scoreMultiplier, options = {}) {
    if (options.playSound !== false) {
      this.sound.play('shoot');
    }

    const bullet = new Bullet(this, universe, x, y, vx, vy, owner, scoreMultiplier, options);
    this.bullets.push(bullet);
    return bullet;
  },

  recordWrapShotHit(bullet) {
    if (bullet?.owner !== 'player') {
      return;
    }

    const totalWraps = bullet.wrapCount || 0;

    if (totalWraps > 0) {
      this.highestWrapShotCount = Math.max(this.highestWrapShotCount, totalWraps);
    }

    const multiUniversalWraps = bullet.multiUniversalWrapCount || 0;

    if (multiUniversalWraps > 0) {
      this.wrapShotHits += 1;

      // Keep every rewarded multi-universal wrap shot until its boss is defeated...
      this.multiverseWrapShotMultiplier += bullet.scoreMultiplier || 1;
    }
  }
});