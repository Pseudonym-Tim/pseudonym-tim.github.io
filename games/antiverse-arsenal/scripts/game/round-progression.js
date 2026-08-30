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
    this.clearUniverseReplacementSelection();
    this.transitioning = true;
    this.keys = {};
    this.draggingUniverse = null;
    this.timeScale = 1;
    this.transitionTimeScale = ROUND_TRANSITION_TIME_SCALE;
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
    this.rockets = [];

    this.showMessage(formatText('message.entryUniverseReconstituting'), 900);
    await this.growUniverse(survivor);

    if (!this.running) {
      return;
    }

    this.transitioning = false;
    this.transitionTimeScale = 1;
    this.keys = {};
  },

  beginRoundGrace(universe, enemyCount) {
    const token = ++this.startToken;
    const round = this.round;
    this.removeEnemiesInUniverse(universe);
    this.roundGraceActive = true;
    this.prepareRoundEncounter(enemyCount);
    this.showMessage(formatText('message.roundBegins', { round }), 1800);

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
      universe.showIncursionWarning();
      this.scheduleNextIncursion();
    };

    setTimeout(releaseEnemies, 4000);
  },

  preparePostRoundState(completedRound) {
    const shopReady = completedRound === SHOP_ROUND;
    const multiverseComplete = completedRound >= BOSS_ROUND;

    this.lastCompletedRound = completedRound;
    this.round = multiverseComplete ? ROUND_RESET_AFTER_BOSS : completedRound + 1;
    this.startToken += 1;
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
    this.roundGraceActive = false;
    this.roundEnding = false;
    this.timeScale = 1;
    this.transitionTimeScale = ROUND_TRANSITION_TIME_SCALE;
    this.transitioning = true;
    this.bossActive = false;
    this.bossPending = false;
    this.bossDefeated = false;
    this.bossUniverse = null;
    this.boss = null;

    return { shopReady, multiverseComplete };
  },

  collectShopIncome() {
    const wrapBonus = Math.round(this.multiverseWrapShotMultiplier * CASH_PER_WRAP_MULTIPLIER);
    const totalIncome = BASE_SHOP_INCOME + wrapBonus;
    this.money += totalIncome;
    this.multiverseStats.cashEarned += totalIncome;
    this.multiverseWrapShotMultiplier = 0;

    return {
      base: BASE_SHOP_INCOME,
      bonus: wrapBonus,
      total: totalIncome
    };
  },

  async startPreparedRound(options = {}) {
    if (!this.running) {
      return;
    }

    if (this.music.currentTrack !== 'normal') {
      void this.music.play('normal', true);
    }

    const freshUniverse = await this.createFreshRoundUniverse(options.instant ? 0 : 720);
    if (!this.running) {
      return;
    }

    this.wrappingDisabled = false;
    this.timeScale = 1;
    this.transitionTimeScale = 1;
    this.transitioning = false;

    if (this.round === BOSS_ROUND) {
      this.startBossEncounter({ instant: options.instantBoss === true });
      return;
    }

    this.beginRoundGrace(freshUniverse, clamp(2 + this.round, 3, 7));
  },

  endRound(options = {}) {
    if (this.roundEnding) {
      return;
    }

    this.roundEnding = true;
    this.transitionTimeScale = ROUND_TRANSITION_TIME_SCALE;

    if (options.showStabilizedMessage !== false) {
      this.showMessage(formatText('message.sectorStabilized'), 1300);
    }

    setTimeout(async () => {
      if (!this.running) {
        return;
      }

      const completedRound = this.round;
      const completedMultiverse = this.multiverse;
      this.lastCompletedRound = completedRound;

      await Promise.all(this.universes.map((universe) => this.shrinkUniverse(universe)));

      if (!this.running) {
        return;
      }

      const multiverseComplete = completedRound >= BOSS_ROUND;

      if (multiverseComplete) {
        this.holdTimelineAtCompletedBoss = true;
      }

      const { shopReady } = this.preparePostRoundState(completedRound);

      if (multiverseComplete) {
        await this.showMultiverseComplete(completedMultiverse);

        if (!this.running) {
          return;
        }

        this.holdTimelineAtCompletedBoss = false;
        this.updateHUD();
        this.multiverse += 1;
        this.resetMultiverseStats();
        await this.startPreparedRound();
      } else if (shopReady) {
        const income = this.collectShopIncome();
        this.showMessage(formatText('message.traderDetected'), 1200);

        setTimeout(() => {
          if (!this.running) {
            return;
          }

          this.showPowerupSelection(() => this.startPreparedRound(), income);
        }, 1250);
      } else {
        await this.startPreparedRound();
      }
    }, 1250);
  },

  resetMultiverseStats() {
    this.multiverseStats = {
      cashEarned: 0,
      cashSpent: 0,
      wrapShotHits: 0,
      highestWrapShotCount: 0
    };
  },

  showMultiverseComplete(completedMultiverse) {
    const token = this.loopToken;
    const stats = this.multiverseStats;
    const netCash = stats.cashEarned - stats.cashSpent;
    this.keys = {};

    multiverseCompleteTitle.textContent = formatText('multiverseComplete.title', { value: completedMultiverse });
    multiverseCompleteEarned.textContent = `+$${Math.floor(stats.cashEarned)}`;
    multiverseCompleteSpent.textContent = stats.cashSpent > 0 ? `-$${Math.floor(stats.cashSpent)}` : '$0';
    multiverseCompleteNet.textContent = netCash === 0 ? '$0' : `${netCash > 0 ? '+' : '-'}$${Math.abs(Math.floor(netCash))}`;
    multiverseCompleteNet.classList.toggle('stat-positive', netCash >= 0);
    multiverseCompleteNet.classList.toggle('stat-negative', netCash < 0);
    multiverseCompleteWrapHits.textContent = String(stats.wrapShotHits);
    multiverseCompleteBestWrap.textContent = formatText('multiverseComplete.wrapValue', { count: stats.highestWrapShotCount });
    multiverseCompleteContinueButton.textContent = formatText('multiverseComplete.continue');
    multiverseCompleteContinueButton.disabled = false;
    multiverseCompleteOverlay.classList.remove('hidden');
    multiverseCompleteContinueButton.focus();
    void this.music.play('multiverseComplete', true, { fadeInSeconds: 0.8 });

    return new Promise((resolve) => {
      const continueToNextMultiverse = async () => {
        if (token !== this.loopToken) {
          return;
        }

        multiverseCompleteContinueButton.disabled = true;
        await this.music.fadeOut(0.8);

        if (token !== this.loopToken) {
          return;
        }

        multiverseCompleteOverlay.classList.add('hidden');
        resolve();
      };

      multiverseCompleteContinueButton.addEventListener('click', continueToNextMultiverse, { once: true });
    });
  },

  async createFreshRoundUniverse(growDuration = 720) {
    for (const universe of [...this.universes]) {
      universe.element.remove();
    }

    this.universes = [];
    this.bullets = [];
    this.rockets = [];
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
    this.player.stunTimer = 0;
    this.player.stunDuration = 0;

    while (this.totalPrimaryAsteroids() < this.getRoundAsteroidTarget()) {
      this.spawnAsteroids(1, [freshUniverse]);
    }

    this.maybeSpawnHullPickup(freshUniverse);
    const safe = this.safeWarpPosition(freshUniverse);
    this.player.x = safe.x;
    this.player.y = safe.y;

    await this.growUniverse(freshUniverse, growDuration);
    return freshUniverse;
  }
});