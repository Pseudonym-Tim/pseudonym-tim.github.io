// Player collisions...
Object.assign(Game.prototype, {
  checkPlayerCollisions() {
    const u = this.player.universe;

    for (const pickup of u.hullPickups) {
      if (pickup.collected) {
        continue;
      }

      if (entitiesOverlap(this.player, pickup)) {
        pickup.collect();
      }
    }

    if (this.player.dashing) {
      return;
    }

    for (const asteroid of u.asteroids) {
      if (asteroid.dead) {
        continue;
      }

      if (entitiesOverlap(this.player, asteroid)) {
        const dx = this.player.x - asteroid.x;
        const dy = this.player.y - asteroid.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.player.takeDamage((dx / len) * 200, (dy / len) * 200);
        this.player.x += (dx / len) * 8;
        this.player.y += (dy / len) * 8;
      }
    }

    for (const enemy of u.enemies) {
      if (enemy.dead || enemy.expired) {
        continue;
      }

      if (entitiesOverlap(this.player, enemy)) {
        if (enemy.enemyType === 'boss') {
          this.hp = 1;
          this.player.takeDamage(0, 300);
          return;
        }

        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.player.takeDamage((dx / len) * 220, (dy / len) * 220);
        enemy.takeDamage(1, 1);
      }
    }
  }
});