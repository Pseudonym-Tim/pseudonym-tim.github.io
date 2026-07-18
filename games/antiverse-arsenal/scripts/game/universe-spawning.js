// Timed universe spawning...
Object.assign(Game.prototype, {
  spawnNewUniverse(enemyCount) {
    if (this.universes.length >= MAX_UNIVERSES || !this.running || this.roundEnding || this.incursionDeploying) {
      return false;
    }

    this.incursionDeploying = true;
    const pos = this.findSpawnLocation();
    const universe = this.createUniverse(pos.x, pos.y, true);

    // (Keep the materialization point stable, explicitly relocate any older window occupying before grow anim makes overlap visible)...
    this.makeRoomForSpawn(universe);
    
    this.showMessage(formatText('message.universeMaterializing', { id: universe.id }), 900);

    // Stagger enemies in from off-screen...
    this.scheduleEnemyWave(enemyCount, universe);
    this.roundIncursionDeployed += 1;
    this.spawnAsteroids(this.getRoundAsteroidSpawnCount(), [universe]);
    this.maybeSpawnHullPickup(universe);
    this.updateStabilityFromThreats();
    this.flashMessage(formatText('message.incursionEntering', { current: this.roundIncursionDeployed, total: this.roundIncursionTotal, universe: universe.id }), 1000);

    this.growUniverse(universe).then(() => {
      if (!this.running || this.roundEnding || !this.universes.includes(universe)) {
        this.incursionDeploying = false;
        return;
      }

      this.incursionDeploying = false;

      if (this.incursionQueue.length > 0) {
        this.scheduleNextIncursion();
      } else {
        this.announceFinalIncursion();
      }
    });

    return true;
  },

  updateSpawnCountdown(dt) {
    if (this.bossDefeated && this.round === BOSS_ROUND && !this.roundEnding) {
      spawnBanner.textContent = formatText('message.bossDefeated');
      nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: formatText('status.clear') });
      spawnBanner.classList.remove('warning');
      return;
    }

    if (this.bossActive || this.bossPending) {
      spawnBanner.textContent = this.bossActive ? formatText('message.bossStatus') : formatText('message.bossDetected');
      nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: formatText('status.final') });
      spawnBanner.classList.add('warning');
      return;
    }

    if (this.roundEnding || this.isShopOpen() || this.transitioning) {
      return;
    }

    if (this.roundGraceActive || !this.encounterActive) {
      spawnBanner.textContent = formatText('message.incursionSignaturesForming');
      nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: formatText('status.forming') });
      return;
    }

    if (this.incursionDeploying || this.pendingEnemySpawns.length > 0) {
      spawnBanner.textContent = formatText('message.universeMaterializingStatus');
      nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: formatText('status.deploying') });
      return;
    }

    if (this.incursionQueue.length > 0) {
      const liveEnemies = this.liveEnemyCount();

      if (liveEnemies === 0) {
        this.spawnTimer = Math.min(this.spawnTimer, EMPTY_FIELD_INCURSION_DELAY);
      }

      const pressureScale = liveEnemies >= 7 ? 0.82 : liveEnemies >= 4 ? 0.92 : 1;
      this.spawnTimer = Math.max(0, this.spawnTimer - dt * pressureScale);
      const seconds = Math.ceil(this.spawnTimer);
      spawnBanner.innerHTML = formatText('message.nextIncursionIn', { seconds: `<span id="spawn-timer">${seconds}</span>` });
      nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: `${seconds}s` });
      spawnBanner.classList.toggle('warning', seconds <= 3);

      if (this.spawnTimer <= 0) {
        const incursion = this.incursionQueue.shift();

        if (!this.spawnNewUniverse(incursion.enemyCount)) {
          this.incursionQueue.unshift(incursion);
        }
      }

      return;
    }

    this.announceFinalIncursion();
    const threatsCleared = this.roundThreatTotal > 0 && this.roundThreatCleared >= this.roundThreatTotal;
    const fieldClear = this.liveEnemyCount() === 0 && threatsCleared && this.roundPendingThreat <= 0;

    if (!fieldClear) {
      this.encounterClearTimer = 0;
      spawnBanner.textContent = formatText('message.finalIncursionStatus');
      nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: formatText('status.final') });
      spawnBanner.classList.add('warning');
      return;
    }

    this.encounterClearTimer = Math.min(ENCOUNTER_CLEAR_DURATION, this.encounterClearTimer + dt);
    const remaining = Math.max(0, ENCOUNTER_CLEAR_DURATION - this.encounterClearTimer);
    spawnBanner.textContent = formatText('message.stabilizingSector', { seconds: remaining.toFixed(1) });
    nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: formatText('status.clear') });
    spawnBanner.classList.remove('warning');

    if (this.encounterClearTimer >= ENCOUNTER_CLEAR_DURATION) {
      if (this.shouldStartBossEncounter()) {
        this.startBossEncounter();
      } else {
        this.endRound();
      }
    }
  }
});