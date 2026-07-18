// Hull pickup placement/spawning...
Object.assign(Game.prototype, {
  maybeSpawnHullPickup(universe) {
    if (!universe || universe.hullPickups.length > 0 || Math.random() > HULL_PICKUP_SPAWN_CHANCE) {
      return null;
    }

    const inset = HULL_PICKUP_EDGE_INSET;
    let best = null;
    let bestClearance = -Infinity;

    for (let attempt = 0; attempt < 80; attempt++) {
      const x = rand(inset, LOGICAL_W - inset);
      const y = rand(inset, LOGICAL_H - inset);
      let clearance = Infinity;

      if (this.player && this.player.universe === universe) {
        clearance = Math.min(clearance, Math.sqrt(distSq(x, y, this.player.x, this.player.y)) - 72);
      }

      for (const enemy of universe.enemies) {
        if (!enemy.dead) {
          clearance = Math.min(clearance, Math.sqrt(distSq(x, y, enemy.x, enemy.y)) - enemy.radius - 30);
        }
      }

      for (const asteroid of universe.asteroids) {
        if (!asteroid.dead) {
          clearance = Math.min(clearance, Math.sqrt(distSq(x, y, asteroid.x, asteroid.y)) - asteroid.radius - 24);
        }
      }

      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = { x, y };
      }

      if (clearance >= 0) {
        break;
      }
    }

    if (!best) {
      return null;
    }

    const pickup = new HullPickup(this, universe, best.x, best.y);
    universe.hullPickups.push(pickup);
    return pickup;
  }
});