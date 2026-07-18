// Incursions...
Object.assign(Game.prototype, {
  getIncursionEnemyCount(index = 0) {
    const base = clamp(2 + Math.floor(this.round * 0.75), 2, 6);
    const variation = Math.random() < 0.35 + Math.min(0.25, this.round * 0.025) ? 1 : 0;
    return clamp(base + variation + (index >= 2 && this.round >= 4 ? 1 : 0), 2, 7);
  },

  getAdditionalIncursionCount() {
    return clamp(1 + Math.floor(this.round / 2), 1, MAX_UNIVERSES - 1);
  },

  prepareRoundEncounter(initialEnemyCount) {
    const additional = this.getAdditionalIncursionCount();

    this.incursionQueue = [];

    for (let i = 0; i < additional; i++) {
      this.incursionQueue.push({ enemyCount: this.getIncursionEnemyCount(i) });
    }

    this.roundIncursionTotal = 1 + this.incursionQueue.length;
    this.roundIncursionDeployed = 0;
    this.roundPendingThreat = initialEnemyCount + this.incursionQueue.reduce((sum, item) => sum + item.enemyCount, 0);
    this.incursionDeploying = false;
    this.encounterActive = false;
    this.finalIncursionAnnounced = false;
    this.encounterClearTimer = 0;
    this.spawnTimer = Infinity;
    this.updateStabilityFromThreats();
  },

  releasePendingThreat(count) {
    this.roundPendingThreat = Math.max(0, this.roundPendingThreat - count);
  },

  nextIncursionDelay() {
    const roundAcceleration = Math.min(1.0, this.round * 0.08);

    return rand(Math.max(3.2, INCURSION_DELAY_MIN - roundAcceleration), Math.max(5.0, INCURSION_DELAY_MAX - roundAcceleration));
  },

  scheduleNextIncursion() {
    if (this.incursionQueue.length <= 0) {
      this.announceFinalIncursion();
      return;
    }

    this.spawnTimer = this.nextIncursionDelay();
  },

  announceFinalIncursion() {
    if (this.finalIncursionAnnounced) {
      return;
    }

    this.finalIncursionAnnounced = true;
    this.flashMessage(formatText('message.finalIncursion'), 1500);
  }
});