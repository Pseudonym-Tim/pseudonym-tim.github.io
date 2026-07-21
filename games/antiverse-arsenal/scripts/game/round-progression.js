// Round transition and progression...
Object.assign(Game.prototype, {
  removeEnemiesInUniverse(universe) {
    for (const enemy of universe.enemies) {
      enemy.dead = true;
      enemy.expired = true;
    }

    universe.enemies = [];
  },

  async playRoundTransition(survivor) {
    this.transitioning = true;
    this.keys = {};
    this.draggingUniverse = null;
    this.timeScale = 1;
    this.showMessage(formatText('message.universesCollapsing'), 900);
    await Promise.all(this.universes.map((u) => this.shrinkUniverse(u)));

    if (!this.running) {
      return;
    }

    for (const u of [...this.universes]) {
      if (u !== survivor) {
        u.element.remove();
      }
    }

    this.universes = [survivor];
    survivor.id = 1;
    survivor.setLabel();
    this.removeEnemiesInUniverse(survivor);
    this.pendingEnemySpawns = [];
    survivor.asteroids = survivor.asteroids.filter((a) => !a.dead);
    survivor.setPosition(survivor.x, survivor.y);
    this.bullets = [];

    this.showMessage(formatText('message.entryUniverseReconstituting'), 900);
    await this.growUniverse(survivor);

    if (!this.running) {
      return;
    }

    this.transitioning = false;
    this.keys = {};
  },

  beginRoundGrace(universe, enemyCount) {
    const token = ++this.startToken;
    const round = this.round;
    this.removeEnemiesInUniverse(universe);
    this.roundGraceActive = true;
    this.prepareRoundEncounter(enemyCount);
    this.showMessage(formatText('message.roundBegins', { round, incursions: this.roundIncursionTotal }), 1800);

    const releaseEnemies = () => {
      if (!this.running || token !== this.startToken || this.round !== round) {
        return;
      }

      if (this.isShopOpen() || this.transitioning) {
        setTimeout(releaseEnemies, 100);
        return;
      }

      this.roundGraceActive = false;
      this.encounterActive = true;
      this.spawnEnemiesFromOffscreen(enemyCount, universe);
      this.roundIncursionDeployed = 1;
      this.updateStabilityFromThreats();
      this.flashMessage(formatText('message.incursionEntering', { current: 1, total: this.roundIncursionTotal, universe: universe.id }), 1000);
      this.scheduleNextIncursion();
    };

    setTimeout(releaseEnemies, 4000);
  },

  endRound(options = {}) {
    if (this.roundEnding) {
      return;
    }

    this.roundEnding = true;
    this.timeScale = Math.min(this.timeScale, 0.18);

    if (options.showStabilizedMessage !== false) {
      this.showMessage(formatText('message.sectorStabilized'), 1300);
    }

    setTimeout(async () => {
      if (!this.running) {
        return;
      }

      const completedRound = this.round;
      const shopReady = completedRound >= SHOP_ROUND_INTERVAL;

      await Promise.all(this.universes.map((universe) => this.shrinkUniverse(universe)));

      if (!this.running) {
        return;
      }

      this.round = shopReady ? ROUND_RESET_AFTER_SHOP : completedRound + 1;

      this.stability = 0;
      this.roundThreatTotal = 0;
      this.roundThreatCleared = 0;
      this.roundPendingThreat = 0;
      this.incursionQueue = [];
      this.roundIncursionTotal = 0;
      this.roundIncursionDeployed = 0;
      this.incursionDeploying = false;
      this.pendingEnemySpawns = [];
      this.encounterActive = false;
      this.finalIncursionAnnounced = false;
      this.encounterClearTimer = 0;
      this.spawnTimer = Infinity;
      this.roundEnding = false;
      this.transitioning = true;
      this.bossActive = false;
      this.bossPending = false;
      this.bossDefeated = false;
      this.bossUniverse = null;
      this.boss = null;

      const startFreshRound = async () => {
        if (!this.running) {
          return;
        }

        const freshUniverse = await this.createFreshRoundUniverse();
        if (!this.running) {
          return;
        }

        this.wrappingDisabled = false;
        this.timeScale = 1;
        this.transitioning = false;
        this.beginRoundGrace(freshUniverse, clamp(2 + this.round, 3, 7));
      };

      if (shopReady) {
        await this.showMultiverseComplete();

        if (!this.running) {
          return;
        }

        this.multiverse += 1;

        this.showMessage(formatText('message.traderDetected'), 1200);

        setTimeout(() => {
          if (!this.running) {
            return;
          }

          this.showPowerupSelection(startFreshRound);
        }, 1250);
      } else {
        await startFreshRound();
      }
    }, 1250);
  },

  showMultiverseComplete() {
    const token = this.loopToken;
    const multiplier = this.multiverseWrapShotMultiplier;
    const earnings = Math.round(multiplier * CASH_PER_WRAP_MULTIPLIER);
    const moneyBeforeReward = this.money;
    this.keys = {};
    multiverseCompleteTitle.textContent = formatText('multiverseComplete.title', { value: this.multiverse });
    multiverseCompleteWraps.textContent = formatText('multiverseComplete.wraps', { multiplier: formatMultiplier(multiplier) });
    multiverseCompleteCash.textContent = formatText('multiverseComplete.cash', { cash: 0 });
    multiverseCompleteContinueButton.textContent = formatText('multiverseComplete.continue');
    multiverseCompleteContinueButton.disabled = true;
    multiverseCompleteOverlay.classList.remove('hidden');

    return new Promise((resolve) => {
      const startedAt = performance.now();
      const duration = 1200;

      const updateCount = (now) => {
        if (token !== this.loopToken) {
          return;
        }

        const progress = Math.min(1, (now - startedAt) / duration);
        const displayedCash = Math.round(earnings * progress);
        this.money = moneyBeforeReward + displayedCash;
        multiverseCompleteCash.textContent = formatText('multiverseComplete.cash', { cash: displayedCash });

        if (progress < 1) {
          requestAnimationFrame(updateCount);
          return;
        }

        multiverseCompleteContinueButton.disabled = false;
        multiverseCompleteContinueButton.focus();
      };

      const continueToShop = () => {
        if (token !== this.loopToken) {
          return;
        }

        multiverseCompleteContinueButton.removeEventListener('click', continueToShop);
        multiverseCompleteOverlay.classList.add('hidden');
        this.multiverseWrapShotMultiplier = 0;
        resolve();
      };

      multiverseCompleteContinueButton.addEventListener('click', continueToShop);
      requestAnimationFrame(updateCount);
    });
  },

  async createFreshRoundUniverse() {
    for (const universe of [...this.universes]) {
      universe.element.remove();
    }

    this.universes = [];
    this.bullets = [];
    this.floatingTexts = [];
    this.explosions = [];

    const slot = this.randomUniversePosition();
    const freshUniverse = this.createUniverse(slot.x, slot.y, true);
    this.player.universe = freshUniverse;
    this.player.velX = 0;
    this.player.velY = 0;
    this.player.warpCooldown = 0;
    this.player.dashCooldown = 0;
    this.player.dashing = false;
    this.player.dashHitEntities.clear();

    while (this.totalPrimaryAsteroids() < this.getRoundAsteroidTarget()) {
      this.spawnAsteroids(1, [freshUniverse]);
    }

    this.maybeSpawnHullPickup(freshUniverse);
    const safe = this.safeWarpPosition(freshUniverse);
    this.player.x = safe.x;
    this.player.y = safe.y;

    await this.growUniverse(freshUniverse);
    return freshUniverse;
  }
});