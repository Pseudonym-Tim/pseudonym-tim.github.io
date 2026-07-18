// Enemy threat accounting and round-clear detection...
Object.assign(Game.prototype, {
  registerEnemyThreat(enemy) {
    if (enemy.threatCounted) {
      return;
    }

    enemy.threatCounted = true;
    enemy.threatCleared = false;
    this.roundThreatTotal += 1;
  },

  clearEnemyThreat(enemy) {
    if (!enemy.threatCounted || enemy.threatCleared) {
      return false;
    }

    enemy.threatCleared = true;
    this.roundThreatCleared += 1;
    return true;
  },

  liveEnemyCount() {
    return this.universes.reduce((sum, universe) => {
      return sum + universe.enemies.filter((enemy) => !enemy.dead && !enemy.expired).length;
    }, 0);
  },

  updateStabilityFromThreats() {
    const totalPlannedThreat = this.roundThreatTotal + this.roundPendingThreat;

    if (totalPlannedThreat <= 0) {
      this.stability = 0;
      return;
    }

    this.stability = clamp((this.roundThreatCleared / totalPlannedThreat) * 100, 0, 100);
  },

  canEndRoundFromThreats() {
    return this.encounterActive && this.incursionQueue.length === 0 && !this.incursionDeploying && this.roundPendingThreat <= 0 && this.roundIncursionDeployed >= this.roundIncursionTotal && this.roundThreatTotal > 0 && this.roundThreatCleared >= this.roundThreatTotal && this.liveEnemyCount() === 0 && !this.roundGraceActive && !this.transitioning;
  },

  tryEndRoundFromThreats() {
    // The encounter director checks completion continuously, because kill events can be sneaky bastards...
    // This keeps the final battlefield-clear grace period from being skipped...
    this.updateStabilityFromThreats();

    if (!this.canEndRoundFromThreats()) {
      this.encounterClearTimer = 0;
    }
  }
});