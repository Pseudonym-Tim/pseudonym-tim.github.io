// Enemy selection, wave scheduling, and spawning...
Object.assign(Game.prototype, {
  spawnEnemies(count, choices = this.universes) {
    for (let i = 0; i < count; i++) {
      const u = choices[Math.floor(Math.random() * choices.length)];
      const pos = this.safePosition(u, 96, { enemyDistance: 100, asteroidDistance: 42 });
      this.spawnEnemy(u, pos.x, pos.y);
    }

    this.updateStabilityFromThreats();
  },

  chooseEnemyClass() {
    const difficulty = Math.max(0, this.round - 1);
    const weights = [
      { EnemyClass: NormalEnemy, weight: Math.max(35, 100 - difficulty * 9) },
      { EnemyClass: KamikazeEnemy, weight: Math.max(0, (difficulty - 1) * 6) },
      { EnemyClass: ShotgunEnemy, weight: Math.max(0, difficulty * 5) },
      { EnemyClass: MachineGunEnemy, weight: Math.max(0, difficulty * 4) },
      { EnemyClass: DoubleShotEnemy, weight: Math.max(0, (difficulty - 1) * 5) },
      { EnemyClass: SniperEnemy, weight: Math.max(0, (difficulty - 2) * 3) }
    ];

    const total = weights.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;

    for (const item of weights) {
      roll -= item.weight;

      if (roll <= 0) {
        return item.EnemyClass;
      }
    }

    return NormalEnemy;
  },

  spawnEnemy(universe, x, y) {
    const EnemyClass = this.chooseEnemyClass();
    const enemy = new EnemyClass(this, universe, x, y);
    this.releasePendingThreat(1);
    this.registerEnemyThreat(enemy);
    universe.enemies.push(enemy);
    this.updateStabilityFromThreats();
    return enemy;
  },

  scheduleEnemyWave(count, universe, initialDelay = ENEMY_SPAWN_WARNING_DURATION, interval = 0.75) {
    const preferredSides = this.distributedSides(count);

    for (let i = 0; i < count; i++) {
      const spawn = {
        universe,
        delay: Math.max(ENEMY_SPAWN_WARNING_DURATION, initialDelay) + i * interval,
        warningDuration: ENEMY_SPAWN_WARNING_DURATION,
        sequence: i,
        preferredSide: preferredSides[i]
      };

      this.assignPendingEnemySpawnPosition(spawn, preferredSides[i]);
      this.pendingEnemySpawns.push(spawn);
    }
  },

  isEnemySpawnSideClear(universe, side) {
    if (!universe || !this.universes.includes(universe)) {
      return false;
    }

    const source = universe.getRect();
    const clearance = ENEMY_SPAWN_EDGE_CLEARANCE * (universe.scale || 1);

    for (const other of this.universes) {
      if (other === universe) {
        continue;
      }

      const rect = other.getRect();
      const verticalOverlap = Math.min(source.y + source.h, rect.y + rect.h) - Math.max(source.y, rect.y);
      const horizontalOverlap = Math.min(source.x + source.w, rect.x + rect.w) - Math.max(source.x, rect.x);

      if (side === 0 && verticalOverlap > 0 && rect.x + rect.w <= source.x) {
        if (source.x - (rect.x + rect.w) < clearance) {
          return false;
        }
      } else if (side === 1 && verticalOverlap > 0 && rect.x >= source.x + source.w) {
        if (rect.x - (source.x + source.w) < clearance) {
          return false;
        }
      } else if (side === 2 && horizontalOverlap > 0 && rect.y + rect.h <= source.y) {
        if (source.y - (rect.y + rect.h) < clearance) {
          return false;
        }
      } else if (side === 3 && horizontalOverlap > 0 && rect.y >= source.y + source.h) {
        if (rect.y - (source.y + source.h) < clearance) {
          return false;
        }
      }
    }

    return true;
  },

  availableEnemySpawnSides(universe) {
    return [0, 1, 2, 3].filter((side) => this.isEnemySpawnSideClear(universe, side));
  },

  assignPendingEnemySpawnPosition(spawn, preferredSide = spawn?.preferredSide) {
    const universe = spawn?.universe;
    const availableSides = this.availableEnemySpawnSides(universe);

    if (availableSides.length === 0) {
      return false;
    }

    let side = Number.isInteger(preferredSide) && availableSides.includes(preferredSide) ? preferredSide : availableSides[Math.floor(Math.random() * availableSides.length)];

    if (spawn.side !== undefined && availableSides.includes(spawn.side)) {
      side = spawn.side;
    }

    const f = spawn.side === side && Number.isFinite(spawn.f) ? spawn.f : rand(0.08, 0.92);
    const margin = ENEMY_OFFSCREEN_SPAWN_MARGIN;
    let x;
    let y;

    if (side === 0) {
      x = -margin;
      y = 50 + f * (universe.height - 100);
    } else if (side === 1) {
      x = universe.width + margin;
      y = 50 + f * (universe.height - 100);
    } else if (side === 2) {
      x = 50 + f * (universe.width - 100);
      y = -margin;
    } else {
      x = 50 + f * (universe.width - 100);
      y = universe.height + margin;
    }

    spawn.side = side;
    spawn.f = f;
    spawn.x = x;
    spawn.y = y;
    return true;
  },

  ensurePendingEnemySpawnPosition(spawn) {
    if (!spawn?.universe || !this.universes.includes(spawn.universe)) {
      return false;
    }

    if (Number.isInteger(spawn.side) && this.isEnemySpawnSideClear(spawn.universe, spawn.side)) {
      return true;
    }

    spawn.side = undefined;
    spawn.f = undefined;
    return this.assignPendingEnemySpawnPosition(spawn, spawn.preferredSide);
  },

  updatePendingEnemySpawns(dt) {
    for (let i = this.pendingEnemySpawns.length - 1; i >= 0; i--) {
      const spawn = this.pendingEnemySpawns[i];
      spawn.delay -= dt;

      if (!this.ensurePendingEnemySpawnPosition(spawn)) {
        spawn.delay = Math.max(spawn.delay, 0.15);
        continue;
      }

      if (spawn.delay > 0) {
        continue;
      }

      this.pendingEnemySpawns.splice(i, 1);

      if (!this.running || this.roundEnding || !this.universes.includes(spawn.universe)) {
        continue;
      }

      this.spawnEnemyFromOffscreen(spawn);
    }
  },

  spawnEnemiesFromOffscreen(count, universe) {
    this.scheduleEnemyWave(count, universe, ENEMY_SPAWN_WARNING_DURATION, 0.75);
  },

  spawnEnemyFromOffscreen(spawn) {
    if (!this.ensurePendingEnemySpawnPosition(spawn)) {
      return null;
    }

    const { universe, x, y } = spawn;
    const sequence = spawn.sequence || 0;

    const enemy = this.spawnEnemy(universe, x, y);
    const targetAngle = (Math.PI * 2 * sequence) / 5 + rand(-0.18, 0.18);
    const targetRadiusX = rand(95, 185);
    const targetRadiusY = rand(70, 135);
    const targetX = universe.width / 2 + Math.cos(targetAngle) * targetRadiusX;
    const targetY = universe.height / 2 + Math.sin(targetAngle) * targetRadiusY;
    const dir = normalizeVector(targetX - x, targetY - y) || { x: 1, y: 0 };
    const entrySpeed = rand(75, 125);
    enemy.velX = dir.x * entrySpeed;
    enemy.velY = dir.y * entrySpeed;
    enemy.angle = Math.atan2(dir.y, dir.x);
    enemy.fireTimer = rand(2.8, 4.4);
    enemy.offscreenEntryTimer = 2.4;
    return enemy;
  },

  drawPendingEnemySpawnWarnings(universe) {
    const ctx = universe?.ctx;

    if (!ctx) {
      return;
    }

    for (const spawn of this.pendingEnemySpawns) {
      if (spawn.universe !== universe || spawn.delay <= 0 || spawn.delay > (spawn.warningDuration || ENEMY_SPAWN_WARNING_DURATION)) {
        continue;
      }

      if (!this.ensurePendingEnemySpawnPosition(spawn)) {
        continue;
      }

      const warningDuration = spawn.warningDuration || ENEMY_SPAWN_WARNING_DURATION;
      const elapsed = warningDuration - spawn.delay;
      const visible = Math.floor(elapsed * ENEMY_SPAWN_WARNING_BLINK_RATE) % 2 === 0;

      if (!visible) {
        continue;
      }

      const inset = 24;
      let x = clamp(spawn.x, inset, universe.width - inset);
      let y = clamp(spawn.y, inset, universe.height - inset);

      if (spawn.side === 0) {
        x = inset;
      } else if (spawn.side === 1) {
        x = universe.width - inset;
      } else if (spawn.side === 2) {
        y = inset;
      } else if (spawn.side === 3) {
        y = universe.height - inset;
      }

      const warningX = pixelSnap(x);
      const warningY = pixelSnap(y);
      ctx.save();
      ctx.font = '32px "Press Start 2P", "Lucida Console", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000';
      ctx.fillText('!', warningX - 2, warningY + 2);
      ctx.fillStyle = '#ff4d5a';
      ctx.fillText('!', warningX, warningY);
      ctx.restore();
    }
  },

  distributedSides(count) {
    const start = Math.floor(Math.random() * 4);
    const sides = [];

    for (let i = 0; i < count; i++) {
      sides.push((start + i) % 4);
    }

    for (let i = sides.length - 1; i > 0; i--) {
      if (Math.random() < 0.35) {
        const j = Math.floor(Math.random() * (i + 1));
        [sides[i], sides[j]] = [sides[j], sides[i]];
      }
    }

    return sides;
  }
});