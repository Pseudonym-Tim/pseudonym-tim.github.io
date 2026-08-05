// Random universe collapse lifecycle...
Object.assign(Game.prototype, {
  maybeStartUniverseCollapse(universe) {
    if (!this.running || !this.encounterActive || this.roundEnding || this.transitioning || this.bossActive || this.bossPending || !this.universes.includes(universe)) {
      return false;
    }

    if (universe.collapseCountdown !== null || universe.collapseClosing) {
      return false;
    }

    if (this.pendingEnemySpawns.some((spawn) => spawn.universe === universe)) {
      return false;
    }

    // Never remove last stable universe, we don't want a softlock...
    const stableUniverses = this.universes.filter((candidate) => candidate.collapseCountdown === null && !candidate.collapseClosing);

    if (stableUniverses.length <= 1 || this.canEndRoundFromThreats() || Math.random() > UNIVERSE_COLLAPSE_CHANCE) {
      return false;
    }

    if (this.draggingUniverse === universe) {
      this.stopDraggingUniverse();
    }

    if (this.selectedUniverse === universe) {
      this.clearUniverseReplacementSelection();
    }

    return universe.startCollapseCountdown(UNIVERSE_COLLAPSE_COUNTDOWN);
  },

  destroyEntitiesInUniverse(universe) {
    let clearedThreats = false;

    for (const enemy of universe.enemies) {
      enemy.dead = true;
      enemy.expired = true;
      clearedThreats = this.clearEnemyThreat(enemy) || clearedThreats;
    }

    for (const asteroid of universe.asteroids) {
      asteroid.dead = true;
      asteroid.expired = true;
    }

    for (const debris of universe.shipDebris) {
      debris.dead = true;
    }

    for (const pickup of universe.hullPickups) {
      pickup.collected = true;
    }

    universe.enemies = [];
    universe.asteroids = [];
    universe.shipDebris = [];
    universe.hullPickups = [];

    const canceledPendingSpawns = this.pendingEnemySpawns.filter((spawn) => spawn.universe === universe).length;
    this.pendingEnemySpawns = this.pendingEnemySpawns.filter((spawn) => spawn.universe !== universe);

    if (canceledPendingSpawns > 0) {
      this.releasePendingThreat(canceledPendingSpawns);
    }

    this.bullets = this.bullets.filter((bullet) => bullet.universe !== universe);
    this.rockets = this.rockets.filter((rocket) => rocket.universe !== universe);
    this.floatingTexts = this.floatingTexts.filter((text) => text.universe !== universe);
    this.explosions = this.explosions.filter((effect) => effect.universe !== universe);
    this.laserFlash = this.laserFlash.filter((flash) => flash.universe !== universe);

    if (this.laserAim?.segments.some((segment) => segment.universe === universe) || this.laserAim?.locks.some((lock) => lock.universe === universe)) {
      this.laserAim = null;
      this.laserCharging = false;
      this.timeScale = 1;
    }

    if (clearedThreats || canceledPendingSpawns > 0) {
      this.updateStabilityFromThreats();
      this.tryEndRoundFromThreats();
    }
  },

  instantKillPlayerInUniverse(universe) {
    if (!this.running || !this.player || this.player.universe !== universe) {
      return false;
    }

    this.hp = 0;
    this.orbitals = [];
    this.blockedShipCollisions = new Set();
    this.orbitalCollisionCooldowns = new Map();
    this.sound.play('explosion');
    this.gameOver();
    return true;
  },

  reindexUniverses() {
    this.universes.forEach((universe, index) => {
      universe.id = index + 1;
      universe.setLabel();
    });
  },

  async closeCollapsingUniverse(universe) {
    if (!this.universes.includes(universe) || !universe.collapseClosing) {
      return;
    }

    universe.messageOverlay.classList.remove('collapse-warning');
    universe.messageOverlay.classList.add('hidden');
    await this.shrinkUniverse(universe, UNIVERSE_COLLAPSE_SHRINK_DURATION);

    if (!this.universes.includes(universe) || !universe.collapseClosing) {
      return;
    }

    this.destroyEntitiesInUniverse(universe);
    const playerKilled = this.instantKillPlayerInUniverse(universe);
    this.universes = this.universes.filter((candidate) => candidate !== universe);
    universe.element.remove();
    universe.collapseClosing = false;
    this.reindexUniverses();

    if (!playerKilled && this.running) {
      this.resolveUniverseLayoutIfNeeded();
      this.updateStabilityFromThreats();
    }
  }
});
