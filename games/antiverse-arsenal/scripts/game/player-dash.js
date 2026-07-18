// Player dash...
Object.assign(Game.prototype, {
  canStartDash() {
    return Boolean(this.running && this.player && !this.player.dashing && this.player.dashCooldown <= 0 && !this.draggingUniverse && !this.transitioning && !this.isShopOpen());
  },

  playerOverlapsDashObstacle(player = this.player) {
    if (!player?.universe) {
      return false;
    }

    const universe = player.universe;

    for (const asteroid of universe.asteroids) {
      if (asteroid.dead) {
        continue;
      }

      if (entitiesOverlap(player, asteroid)) {
        return true;
      }
    }

    for (const enemy of universe.enemies) {
      if (enemy.dead || enemy.expired) {
        continue;
      }

      if (entitiesOverlap(player, enemy)) {
        return true;
      }
    }

    return false;
  },

  applyDashDamage(player = this.player) {
    if (!player?.dashing || !player.universe) {
      return;
    }

    const universe = player.universe;
    const hitSet = player.dashHitEntities;

    for (const asteroid of universe.asteroids) {
      if (asteroid.dead || hitSet.has(asteroid)) {
        continue;
      }

      const dashShape = circleCollisionShape(player.x, player.y, player.radius + 2);

      if (collisionShapesOverlap(dashShape, entityCollisionShape(asteroid))) {
        hitSet.add(asteroid);
        asteroid.takeDamage(DASH_DAMAGE, 1);
      }
    }

    for (const enemy of universe.enemies) {
      if (enemy.dead || enemy.expired || hitSet.has(enemy)) {
        continue;
      }

      const dashShape = circleCollisionShape(player.x, player.y, player.radius + 2);

      if (collisionShapesOverlap(dashShape, entityCollisionShape(enemy))) {
        hitSet.add(enemy);
        enemy.takeDamage(DASH_DAMAGE, 1);
      }
    }
  },

  pushDashToSafety(player = this.player) {
    if (!player?.universe) {
      return;
    }

    let steps = 0;

    while (this.playerOverlapsDashObstacle(player) && steps < 180) {
      player.prevX = player.x;
      player.prevY = player.y;
      player.x += player.dashDirX * 4;
      player.y += player.dashDirY * 4;
      this.wrapEntity(player, { sameUniverse: true, countWrap: false, scoreMultiplier: false });
      this.applyDashDamage(player);
      steps += 1;
    }

    if (this.playerOverlapsDashObstacle(player)) {
      const safe = this.safeWarpPosition(player.universe);
      player.x = safe.x;
      player.y = safe.y;
    }
  }
});