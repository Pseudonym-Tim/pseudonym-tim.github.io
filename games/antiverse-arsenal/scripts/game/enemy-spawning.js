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

  scheduleEnemyWave(count, universe, initialDelay = 0.35, interval = 0.75) {
    for (let i = 0; i < count; i++) {
      this.pendingEnemySpawns.push({ universe, delay: initialDelay + i * interval });
    }
  },

  updatePendingEnemySpawns(dt) {
    for (let i = this.pendingEnemySpawns.length - 1; i >= 0; i--) {
      const spawn = this.pendingEnemySpawns[i];
      spawn.delay -= dt;

      if (spawn.delay > 0) {
        continue;
      }

      this.pendingEnemySpawns.splice(i, 1);

      if (!this.running || this.roundEnding || !this.universes.includes(spawn.universe)) {
        continue;
      }

      this.spawnEnemyFromOffscreen(spawn.universe, i);
    }
  },

  spawnEnemiesFromOffscreen(count, universe) {
    this.scheduleEnemyWave(count, universe, 0, 0.75);
  },

  spawnEnemyFromOffscreen(universe, sequence = 0) {
    const margin = 36;
    const side = Math.floor(Math.random() * 4);
    const f = rand(0.08, 0.92);
    let x;
    let y;

    if (side === 0) {
      x = -margin;
      y = 50 + f * (LOGICAL_H - 100);
    } else if (side === 1) {
      x = LOGICAL_W + margin;
      y = 50 + f * (LOGICAL_H - 100);
    } else if (side === 2) {
      x = 50 + f * (LOGICAL_W - 100);
      y = -margin;
    } else {
      x = 50 + f * (LOGICAL_W - 100);
      y = LOGICAL_H + margin;
    }

    const enemy = this.spawnEnemy(universe, x, y);
    const targetAngle = (Math.PI * 2 * sequence) / 5 + rand(-0.18, 0.18);
    const targetRadiusX = rand(95, 185);
    const targetRadiusY = rand(70, 135);
    const targetX = LOGICAL_W / 2 + Math.cos(targetAngle) * targetRadiusX;
    const targetY = LOGICAL_H / 2 + Math.sin(targetAngle) * targetRadiusY;
    const dir = normalizeVector(targetX - x, targetY - y) || { x: 1, y: 0 };
    const entrySpeed = rand(75, 125);
    enemy.velX = dir.x * entrySpeed;
    enemy.velY = dir.y * entrySpeed;
    enemy.angle = Math.atan2(dir.y, dir.x);
    enemy.fireTimer = rand(2.8, 4.4);
    enemy.offscreenEntryTimer = 2.4;
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