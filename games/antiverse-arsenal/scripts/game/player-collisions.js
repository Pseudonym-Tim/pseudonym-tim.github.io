// Player collisions...
Object.assign(Game.prototype, {
  isBulletBlockedByOrbital(bullet) {
    if (bullet.universe !== this.player.universe || (bullet.owner === 'player' && bullet.age < bullet.orbitalIgnoreTime)) {
      return false;
    }

    return this.orbitals.some((orbital) => orbital.blocks(bullet));
  },

  updateOrbitals(dt) {
    this.blockedShipCollisions.clear();
    
    for (const [entity, cooldown] of this.orbitalCollisionCooldowns) {
      const remainingCooldown = cooldown - dt;
      if (remainingCooldown > 0) {
        this.orbitalCollisionCooldowns.set(entity, remainingCooldown);
      } else {
        this.orbitalCollisionCooldowns.delete(entity);
      }
    }

    for (const orbital of this.orbitals) {
      orbital.update(dt);

      for (const asteroid of this.player.universe.asteroids) {
        if (!asteroid.dead && orbital.blocks(asteroid)) {
          this.bounceEntityFromOrbital(asteroid, orbital);
        }
      }

      for (const enemy of this.player.universe.enemies) {
        if (!enemy.dead && !enemy.expired && orbital.blocks(enemy)) {
          this.bounceEntityFromOrbital(enemy, orbital);
        }
      }
    }
  },

  bounceEntityFromOrbital(entity, orbital) {
    let dx = entity.x - orbital.x;
    let dy = entity.y - orbital.y;
    let distance = Math.hypot(dx, dy);

    if (distance < 0.001) {
      dx = orbital.x - this.player.x;
      dy = orbital.y - this.player.y;
      distance = Math.max(1, Math.hypot(dx, dy));
    }

    const normalX = dx / distance;
    const normalY = dy / distance;
    orbital.absorbImpact(normalX, normalY);
    const separation = orbital.radius + entity.radius - distance + 1;
    entity.x += normalX * Math.max(0, separation);
    entity.y += normalY * Math.max(0, separation);

    const velocityIntoOrbital = entity.velX * normalX + entity.velY * normalY;
    if (velocityIntoOrbital < 0) {
      entity.velX -= velocityIntoOrbital * normalX * 2;
      entity.velY -= velocityIntoOrbital * normalY * 2;
    }

    entity.velX += normalX * ORBITAL_BOUNCE_SPEED;
    entity.velY += normalY * ORBITAL_BOUNCE_SPEED;

    if (!this.orbitalCollisionCooldowns.has(entity)) {
      entity.takeDamage(ORBITAL_COLLISION_DAMAGE, 1);
      this.orbitalCollisionCooldowns.set(entity, ORBITAL_COLLISION_DAMAGE_COOLDOWN);
    }

    const playerDX = entity.x - this.player.x;
    const playerDY = entity.y - this.player.y;
    const playerDistance = Math.max(0.001, Math.hypot(playerDX, playerDY));
    const playerSeparation = this.player.radius + entity.radius - playerDistance + 1;

    if (playerSeparation > 0) {
      entity.x += (playerDX / playerDistance) * playerSeparation;
      entity.y += (playerDY / playerDistance) * playerSeparation;
    }

    this.blockedShipCollisions.add(entity);
  },

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
      if (asteroid.dead || this.blockedShipCollisions.has(asteroid)) {
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
      if (enemy.dead || enemy.expired || this.blockedShipCollisions.has(enemy)) {
        continue;
      }

      if (entitiesOverlap(this.player, enemy)) {
        if (enemy.enemyType === 'boss') {
          this.hp = 1;
          this.player.takeDamage(0, 300);
          return;
        }

        if (enemy.enemyType === 'kamikaze') {
          enemy.detonate();
          continue;
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