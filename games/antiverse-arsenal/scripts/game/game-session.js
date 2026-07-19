// Game session...
Object.assign(Game.prototype, {
  start() {
    for (const u of this.universes) {
      u.element.remove();
    }

    this.universes = [];
    this.bullets = [];
    this.floatingTexts = [];
    this.explosions = [];
    this.powerups = [];
    this.round = 1;
    this.multiverse = 1;
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
    this.hitStopTimer = 0;
    this.hitSlowTimer = 0;
    this.hitSlowScale = 1;
    this.hp = MAX_PLAYER_HULL;
    this.maxHull = MAX_PLAYER_HULL;
    this.score = 0;
    this.wrapShotHits = 0;
    this.highestWrapShotCount = 0;
    this.spawnTimer = UNIVERSE_INTERVAL;
    this.roundEnding = false;
    this.paused = false;
    pauseOverlay.classList.add('hidden');
    controlsPanel.classList.add('hidden');
    this.draggingUniverse = null;
    document.body.classList.remove('window-dragging');
    this.clearAllInput();
    this.invulnerable = false;
    this.debugInvulnerable = false;
    this.debugShowCollisions = false;
    this.running = true;
    this.timeScale = 1;
    this.laserCharging = false;
    this.laserAim = null;
    this.laserFlash = [];
    this.laserCooldown = 0;
    this.roundGraceActive = false;
    this.transitioning = false;
    this.bossActive = false;
    this.bossPending = false;
    this.bossDefeated = false;
    this.bossUniverse = null;
    this.boss = null;
    this.bossEncounterCount = 0;
    this.wrappingDisabled = false;
    this.universeThemes = this.createUniverseThemes();
    this.scale = this.computeScale();
    gameoverOverlay.classList.add('hidden');
    powerupOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    controlsPanel.classList.add('hidden');

    const firstSlot = this.randomUniversePosition();
    const u = this.createUniverse(firstSlot.x, firstSlot.y, true);
    this.player = new Player(this, u, LOGICAL_W / 2, LOGICAL_H / 2);
    this.spawnAsteroids(this.getRoundAsteroidSpawnCount(), [u]);
    this.maybeSpawnHullPickup(u);
    this.growUniverse(u);
    this.beginRoundGrace(u, 3);
    this.lastTime = performance.now();
    this.updateHUD();
    const loopToken = ++this.loopToken;
    requestAnimationFrame((t) => this.loop(t, loopToken));
  },

  quitGame() {
    this.running = false;
    this.loopToken += 1;
    this.paused = false;
    this.clearAllInput();
    this.unlockFullscreenEscape();

    if (document.exitFullscreen && this.isFullscreenActive()) {
      document.exitFullscreen().catch(() => {});
    }

    window.open('', '_self');
    window.close();

    setTimeout(() => { if (!window.closed) { window.location.replace('about:blank'); } }, 80);
  },

  gameOver() {
    this.running = false;
    this.loopToken += 1;
    this.paused = false;
    pauseOverlay.classList.add('hidden');
    controlsPanel.classList.add('hidden');
    this.clearAllInput();
    this.highscore = Math.max(this.highscore, Math.floor(this.score));
    localStorage.setItem('antiverseHighscore', String(this.highscore));
    finalScoreEl.textContent = formatText('gameover.score', { score: Math.floor(this.score) });
    finalHighscoreEl.textContent = formatText('gameover.highscore', { highscore: Math.floor(this.highscore) });
    finalMultiverseEl.textContent = formatText('gameover.multiverse', { count: this.multiverse });
    finalWrapHitsEl.textContent = formatText('gameover.wrapHits', { hits: this.wrapShotHits });
    finalHighestWrapShotEl.textContent = formatText('gameover.highestWrapShot', { count: this.highestWrapShotCount });
    gameoverOverlay.classList.remove('hidden');
  }
});