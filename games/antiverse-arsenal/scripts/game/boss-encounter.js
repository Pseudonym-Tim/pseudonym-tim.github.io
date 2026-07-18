// Boss encounter logic...
Object.assign(Game.prototype, {
  shouldStartBossEncounter() {
    return this.round === BOSS_ROUND && !this.bossActive && !this.bossPending && !this.bossDefeated;
  },

  startBossEncounter() {
    if (!this.running || this.bossActive || this.bossPending) {
      return;
    }

    const universe = this.player.universe;
    this.prepareBossSummonUniverse(universe);
    this.bossPending = true;
    this.encounterClearTimer = 0;
    this.spawnTimer = Infinity;
    this.showMessage(formatText('message.bossDetected'), 2200);
    spawnBanner.textContent = formatText('message.bossStatus');
    spawnBanner.classList.add('warning');

    setTimeout(async () => {
      if (!this.running || this.round !== BOSS_ROUND || !this.bossPending) {
        return;
      }

      await this.expandUniverseForBoss(universe);
      if (!this.running || this.round !== BOSS_ROUND || !this.bossPending) {
        return;
      }

      this.activateBossEncounter(universe);
    }, 900);
  },

  prepareBossSummonUniverse(universe) {
    if (!universe || !this.universes.includes(universe)) {
      return;
    }

    for (const other of [...this.universes]) {
      if (other !== universe) {
        other.element.remove();
      }
    }

    this.universes = [universe];
    universe.id = 1;
    universe.setLabel();
    this.bullets = this.bullets.filter((bullet) => bullet.universe === universe);
    this.pendingEnemySpawns = [];
    this.incursionQueue = [];
    this.incursionDeploying = false;
    this.roundPendingThreat = 0;
    this.roundIncursionTotal = Math.max(1, this.roundIncursionTotal);
    this.roundIncursionDeployed = this.roundIncursionTotal;
  },

  async expandUniverseForBoss(universe, duration = 1150) {
    if (!universe || !this.universes.includes(universe)) {
      return;
    }

    const startW = universe.width;
    const startH = universe.height;
    const start = performance.now();

    while (this.running && this.bossPending) {
      const elapsed = performance.now() - start;
      const t = clamp(elapsed / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const width = Math.round(startW + (BOSS_LOGICAL_W - startW) * eased);
      const height = Math.round(startH + (BOSS_LOGICAL_H - startH) * eased);
      universe.setLogicalSize(width, height);
      universe.setPosition((window.innerWidth - universe.cssWidth) / 2, (window.innerHeight - universe.cssHeight - universe.cssHeader) / 2);
      this.draw();

      if (t >= 1) {
        break;
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    universe.setLogicalSize(BOSS_LOGICAL_W, BOSS_LOGICAL_H);
    universe.setPosition((window.innerWidth - universe.cssWidth) / 2, (window.innerHeight - universe.cssHeight - universe.cssHeader) / 2);
    this.draw();
  },

  resetUniverseToDefaultSize(universe) {
    if (!universe || (universe.width === LOGICAL_W && universe.height === LOGICAL_H)) {
      return;
    }

    universe.setLogicalSize(LOGICAL_W, LOGICAL_H);
    universe.setPosition((window.innerWidth - universe.cssWidth) / 2, (window.innerHeight - universe.cssHeight - universe.cssHeader) / 2);

    if (this.player?.universe === universe) {
      this.player.x = clamp(this.player.x, this.player.radius, universe.width - this.player.radius);
      this.player.y = clamp(this.player.y, this.player.radius, universe.height - this.player.radius);
    }
  },

  availableBossClasses() {
    return [DreadnoughtBoss];
  },

  chooseBossClass() {
    const bosses = this.availableBossClasses();

    if (this.bossEncounterCount <= 0) {
      return DreadnoughtBoss;
    }

    return bosses[Math.floor(Math.random() * bosses.length)] || DreadnoughtBoss;
  },

  activateBossEncounter(universe) {
    if (!universe || !this.universes.includes(universe)) {
      return;
    }

    this.bossPending = false;
    this.bossActive = true;
    this.wrappingDisabled = true;
    this.bossUniverse = universe;

    // The boss gets a whole damn screen, fuck the other universes...
    for (const other of [...this.universes]) {
      if (other !== universe) {
        other.element.remove();
      }
    }

    this.universes = [universe];
    universe.id = 1;
    universe.setLabel();

    if (universe.width !== BOSS_LOGICAL_W || universe.height !== BOSS_LOGICAL_H) {
      universe.setLogicalSize(BOSS_LOGICAL_W, BOSS_LOGICAL_H);
      universe.setPosition((window.innerWidth - universe.cssWidth) / 2, (window.innerHeight - universe.cssHeight - universe.cssHeader) / 2);
    }

    this.player.universe = universe;
    this.player.x = clamp(this.player.x, this.player.radius, universe.width - this.player.radius);
    this.player.y = clamp(this.player.y, this.player.radius, universe.height - this.player.radius);

    const BossClass = this.chooseBossClass();
    const boss = new BossClass(this, universe);
    this.bossEncounterCount += 1;
    this.boss = boss;
    this.registerEnemyThreat(boss);
    universe.enemies.push(boss);
    this.updateStabilityFromThreats();
  },

  finishBossEncounter() {
    this.bossActive = false;
    this.bossPending = false;
    this.bossDefeated = true;
    this.boss = null;
    this.timeScale = Math.min(this.timeScale, 0.18);
    this.showMessage(formatText('message.bossDefeated'), 3200);
    spawnBanner.textContent = formatText('message.bossDefeated');
    nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: formatText('status.clear') });
    spawnBanner.classList.remove('warning');

    setTimeout(() => { if (this.running) { this.endRound({ showStabilizedMessage: false }); } }, 1800);
  }
});