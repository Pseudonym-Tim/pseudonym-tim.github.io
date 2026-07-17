// Game-specific director...
// TODO: A lot of this code should probably be seperated out, this is really huge for no good reason...
class Game {
  constructor() {
    this.keys = {};
    this.universes = [];
    this.bullets = [];
    this.floatingTexts = [];
    this.explosions = [];
    this.sound = new SoundManager();
    this.player = null;
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.draggingUniverse = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.dragTilt = 0;
    this.dragTiltTarget = 0;
    this.dragLastMouseX = 0;
    this.dragLastMouseY = 0;
    this.dragLastMoveTime = 0;
    this.timeScale = 1;
    this.laserCharging = false;
    this.laserAim = null;
    this.laserFlash = [];
    this.laserCooldown = 0;
    this.hitStopTimer = 0;
    this.hitSlowTimer = 0;
    this.hitSlowScale = 1;
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
    this.hp = MAX_PLAYER_HULL;
    this.score = 0;
    this.wrapShotHits = 0;
    this.highestWrapShotCount = 0;
    this.highscore = Number(localStorage.getItem('antiverseHighscore') || 0);
    this.spawnTimer = UNIVERSE_INTERVAL;
    this.running = false;
    this.paused = false;
    this.roundEnding = false;
    this.invulnerable = false;
    this.debugInvulnerable = false;
    this.debugShowCollisions = false;
    this.powerups = [];
    this.spriteClock = 0;
    this.scale = this.computeScale();
    this.messageToken = 0;
    this.messageTimeout = null;
    this.messageExpiresAt = 0;
    this.messageRemainingMs = 0;
    this.startToken = 0;
    this.loopToken = 0;
    this.roundGraceActive = false;
    this.transitioning = false;
    this.bossActive = false;
    this.bossPending = false;
    this.bossDefeated = false;
    this.bossUniverse = null;
    this.boss = null;
    this.bossEncounterCount = 0;
    this.wrappingDisabled = false;
    this.universeThemes = [];
    this.initInput();
    this.initFullscreenMode();
    restartButton.addEventListener('click', () => this.start());
    resumeButton.addEventListener('click', () => this.resumeGame());
    controlsButton.addEventListener('click', () => this.showControlsPanel());
    controlsCloseButton.addEventListener('click', () => this.hideControlsPanel());
    pauseRestartButton.addEventListener('click', () => this.start());
    quitButton.addEventListener('click', () => this.quitGame());
  }

  initFullscreenMode() {
    this.enterFullscreenMode = () => {
      if (this.isFullscreenActive()) {
        this.updateFullscreenClass();
        this.lockFullscreenEscape();
        return Promise.resolve(true);
      }

      const root = document.documentElement;
      const requestFullscreen = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!requestFullscreen) {
        return Promise.resolve(false);
      }

      return Promise.resolve(requestFullscreen.call(root, { navigationUI: 'hide' }))
        .then(() => {
          this.updateFullscreenClass();
          this.lockFullscreenEscape();
          return true;
        })
        .catch(() => false);
    };

    document.addEventListener('fullscreenchange', () => {
      this.updateFullscreenClass();
      if (this.isFullscreenActive()) {
        this.lockFullscreenEscape();
      } else {
        this.unlockFullscreenEscape();
      }
    });
    document.addEventListener('webkitfullscreenchange', () => {
      this.updateFullscreenClass();
      if (this.isFullscreenActive()) {
        this.lockFullscreenEscape();
      } else {
        this.unlockFullscreenEscape();
      }
    });
    this.updateFullscreenClass();
  }

  isFullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  lockFullscreenEscape() {
    if (!this.isFullscreenActive()) {
      return;
    }

    const keyboard = navigator.keyboard;
    if (!keyboard?.lock) {
      return;
    }

    keyboard.lock(['Escape']).catch(() => {});
  }

  unlockFullscreenEscape() {
    const keyboard = navigator.keyboard;
    if (!keyboard?.unlock) {
      return;
    }

    keyboard.unlock();
  }

  updateFullscreenClass() {
    document.body.classList.toggle('fullscreen-active', this.isFullscreenActive());
  }

  canStartDash() {
    return Boolean(this.running && this.player && !this.player.dashing && this.player.dashCooldown <= 0 && !this.draggingUniverse && !this.transitioning && !this.isShopOpen());
  }

  playerOverlapsDashObstacle(player = this.player) {
    if (!player?.universe) {
      return false;
    }

    const universe = player.universe;

    for (const asteroid of universe.asteroids) {
      if (asteroid.dead) {
        continue;
      }

      if (entitiesOverlap(player, asteroid)) {
        return true;
      }
    }

    for (const enemy of universe.enemies) {
      if (enemy.dead || enemy.expired) {
        continue;
      }

      if (entitiesOverlap(player, enemy)) {
        return true;
      }
    }

    return false;
  }

  applyDashDamage(player = this.player) {
    if (!player?.dashing || !player.universe) {
      return;
    }

    const universe = player.universe;
    const hitSet = player.dashHitEntities;

    for (const asteroid of universe.asteroids) {
      if (asteroid.dead || hitSet.has(asteroid)) {
        continue;
      }

      const dashShape = circleCollisionShape(player.x, player.y, player.radius + 2);

      if (collisionShapesOverlap(dashShape, entityCollisionShape(asteroid))) {
        hitSet.add(asteroid);
        asteroid.takeDamage(DASH_DAMAGE, 1);
      }
    }

    for (const enemy of universe.enemies) {
      if (enemy.dead || enemy.expired || hitSet.has(enemy)) {
        continue;
      }

      const dashShape = circleCollisionShape(player.x, player.y, player.radius + 2);

      if (collisionShapesOverlap(dashShape, entityCollisionShape(enemy))) {
        hitSet.add(enemy);
        enemy.takeDamage(DASH_DAMAGE, 1);
      }
    }
  }

  pushDashToSafety(player = this.player) {
    if (!player?.universe) {
      return;
    }

    let steps = 0;

    while (this.playerOverlapsDashObstacle(player) && steps < 180) {
      player.prevX = player.x;
      player.prevY = player.y;
      player.x += player.dashDirX * 4;
      player.y += player.dashDirY * 4;
      this.wrapEntity(player, { sameUniverse: true, countWrap: false, scoreMultiplier: false });
      this.applyDashDamage(player);
      steps += 1;
    }

    if (this.playerOverlapsDashObstacle(player)) {
      const safe = this.safeWarpPosition(player.universe);
      player.x = safe.x;
      player.y = safe.y;
    }
  }

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
  }

  isPauseMenuOpen() {
    return !pauseOverlay.classList.contains('hidden');
  }

  isControlsPanelOpen() {
    return !controlsPanel.classList.contains('hidden');
  }

  showControlsPanel() {
    if (!this.isPauseMenuOpen()) {
      return;
    }

    controlsPanel.classList.remove('hidden');
  }

  hideControlsPanel() {
    controlsPanel.classList.add('hidden');
  }

  pauseGame() {
    if (!this.running || this.isShopOpen() || this.transitioning || this.isPauseMenuOpen()) {
      return;
    }

    this.paused = true;
    this.clearAllInput();

    if (this.draggingUniverse) {
      this.stopDraggingUniverse();
    }

    this.laserCharging = false;
    this.laserAim = null;
    this.timeScale = 1;
    pauseOverlay.classList.remove('hidden');
  }

  resumeGame() {
    if (!this.isPauseMenuOpen() || this.isControlsPanelOpen()) {
      return;
    }

    this.paused = false;
    this.clearAllInput();
    pauseOverlay.classList.add('hidden');
    controlsPanel.classList.add('hidden');
    this.lastTime = performance.now();
  }

  togglePause() {
    if (this.isControlsPanelOpen()) {
      this.hideControlsPanel();
      return;
    }

    if (this.isPauseMenuOpen()) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  removeEnemiesInUniverse(universe) {
    for (const enemy of universe.enemies) {
      enemy.dead = true;
      enemy.expired = true;
    }

    universe.enemies = [];
  }

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
  }

  getIncursionEnemyCount(index = 0) {
    const base = clamp(2 + Math.floor(this.round * 0.75), 2, 6);
    const variation = Math.random() < 0.35 + Math.min(0.25, this.round * 0.025) ? 1 : 0;
    return clamp(base + variation + (index >= 2 && this.round >= 4 ? 1 : 0), 2, 7);
  }

  getAdditionalIncursionCount() {
    return clamp(1 + Math.floor(this.round / 2), 1, MAX_UNIVERSES - 1);
  }

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
  }

  releasePendingThreat(count) {
    this.roundPendingThreat = Math.max(0, this.roundPendingThreat - count);
  }

  nextIncursionDelay() {
    const roundAcceleration = Math.min(1.0, this.round * 0.08);

    return rand(Math.max(3.2, INCURSION_DELAY_MIN - roundAcceleration), Math.max(5.0, INCURSION_DELAY_MAX - roundAcceleration));
  }

  scheduleNextIncursion() {
    if (this.incursionQueue.length <= 0) {
      this.announceFinalIncursion();
      return;
    }

    this.spawnTimer = this.nextIncursionDelay();
  }

  announceFinalIncursion() {
    if (this.finalIncursionAnnounced) {
      return;
    }

    this.finalIncursionAnnounced = true;
    this.flashMessage(formatText('message.finalIncursion'), 1500);
  }

  spawnNewUniverse(enemyCount) {
    if (this.universes.length >= MAX_UNIVERSES || !this.running || this.roundEnding || this.incursionDeploying) {
      return false;
    }

    this.incursionDeploying = true;
    const pos = this.findSpawnLocation();
    const universe = this.createUniverse(pos.x, pos.y, true);
    this.relaxUniverseLayout(universe);
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
  }

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

  shouldStartBossEncounter() {
    return this.round === BOSS_ROUND && !this.bossActive && !this.bossPending && !this.bossDefeated;
  }

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
  }

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
  }

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
  }

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
  }

  availableBossClasses() {
    return [DreadnoughtBoss];
  }

  chooseBossClass() {
    const bosses = this.availableBossClasses();

    if (this.bossEncounterCount <= 0) {
      return DreadnoughtBoss;
    }

    return bosses[Math.floor(Math.random() * bosses.length)] || DreadnoughtBoss;
  }

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
  }

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

  maybeSpawnHullPickup(universe) {
    if (!universe || universe.hullPickups.length > 0 || Math.random() > HULL_PICKUP_SPAWN_CHANCE) {
      return null;
    }

    const inset = HULL_PICKUP_EDGE_INSET;
    let best = null;
    let bestClearance = -Infinity;

    for (let attempt = 0; attempt < 80; attempt++) {
      const x = rand(inset, LOGICAL_W - inset);
      const y = rand(inset, LOGICAL_H - inset);
      let clearance = Infinity;

      if (this.player && this.player.universe === universe) {
        clearance = Math.min(clearance, Math.sqrt(distSq(x, y, this.player.x, this.player.y)) - 72);
      }

      for (const enemy of universe.enemies) {
        if (!enemy.dead) {
          clearance = Math.min(clearance, Math.sqrt(distSq(x, y, enemy.x, enemy.y)) - enemy.radius - 30);
        }
      }

      for (const asteroid of universe.asteroids) {
        if (!asteroid.dead) {
          clearance = Math.min(clearance, Math.sqrt(distSq(x, y, asteroid.x, asteroid.y)) - asteroid.radius - 24);
        }
      }

      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = { x, y };
      }

      if (clearance >= 0) {
        break;
      }
    }

    if (!best) {
      return null;
    }

    const pickup = new HullPickup(this, universe, best.x, best.y);
    universe.hullPickups.push(pickup);
    return pickup;
  }

  spawnEnemies(count, choices = this.universes) {
    for (let i = 0; i < count; i++) {
      const u = choices[Math.floor(Math.random() * choices.length)];
      const pos = this.safePosition(u, 96, { enemyDistance: 100, asteroidDistance: 42 });
      this.spawnEnemy(u, pos.x, pos.y);
    }

    this.updateStabilityFromThreats();
  }

  chooseEnemyClass() {
    const difficulty = Math.max(0, this.round - 1);
    const weights = [
      { EnemyClass: NormalEnemy, weight: Math.max(35, 100 - difficulty * 9) },
      { EnemyClass: ShotgunEnemy, weight: Math.max(0, difficulty * 5) },
      { EnemyClass: MachineGunEnemy, weight: Math.max(0, difficulty * 4) }
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
  }

  spawnEnemy(universe, x, y) {
    const EnemyClass = this.chooseEnemyClass();
    const enemy = new EnemyClass(this, universe, x, y);
    this.releasePendingThreat(1);
    this.registerEnemyThreat(enemy);
    universe.enemies.push(enemy);
    this.updateStabilityFromThreats();
    return enemy;
  }

  scheduleEnemyWave(count, universe, initialDelay = 0.35, interval = 0.75) {
    for (let i = 0; i < count; i++) {
      this.pendingEnemySpawns.push({ universe, delay: initialDelay + i * interval });
    }
  }

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
  }

  spawnEnemiesFromOffscreen(count, universe) {
    this.scheduleEnemyWave(count, universe, 0, 0.75);
  }

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
  }

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

  getRoundAsteroidTarget() {
    return clamp(2 + Math.floor((this.round - 1) / 2), 2, MAX_PRIMARY_ASTEROIDS);
  }

  getRoundAsteroidSpawnCount() {
    return clamp(1 + Math.floor((this.round - 1) / 3), 1, 3);
  }

  spawnAsteroids(count, choices = this.universes) {
    for (let i = 0; i < count; i++) {
      const u = choices[Math.floor(Math.random() * choices.length)];
      const pos = this.safePosition(u, 130, { enemyDistance: 80, asteroidDistance: 95 });
      const asteroid = new Asteroid(this, u, pos.x, pos.y, 2);
      asteroid.primary = true;
      u.asteroids.push(asteroid);
    }
  }

  safePosition(u, minPlayerDistance = 100, spacing = {}) {
    const enemyDistance = spacing.enemyDistance ?? 0;
    const asteroidDistance = spacing.asteroidDistance ?? 0;

    for (let attempt = 0; attempt < 80; attempt++) {
      const x = rand(40, LOGICAL_W - 40);
      const y = rand(40, LOGICAL_H - 40);

      if (this.player && this.player.universe === u && distSq(x, y, this.player.x, this.player.y) <= minPlayerDistance * minPlayerDistance) {
        continue;
      }

      let spaced = true;

      if (enemyDistance > 0) {
        for (const enemy of u.enemies) {
          if (!enemy.dead && distSq(x, y, enemy.x, enemy.y) < enemyDistance * enemyDistance) {
            spaced = false;
            break;
          }
        }
      }

      if (!spaced) {
        continue;
      }

      if (asteroidDistance > 0) {
        for (const asteroid of u.asteroids) {
          const min = asteroidDistance + asteroid.radius;

          if (!asteroid.dead && distSq(x, y, asteroid.x, asteroid.y) < min * min) {
            spaced = false;
            break;
          }
        }
      }

      if (spaced) {
        return { x, y };
      }
    }

    return { x: rand(40, LOGICAL_W - 40), y: rand(40, LOGICAL_H - 40) };
  }

  registerEnemyThreat(enemy) {
    if (enemy.threatCounted) {
      return;
    }

    enemy.threatCounted = true;
    enemy.threatCleared = false;
    this.roundThreatTotal += 1;
  }

  clearEnemyThreat(enemy) {
    if (!enemy.threatCounted || enemy.threatCleared) {
      return false;
    }

    enemy.threatCleared = true;
    this.roundThreatCleared += 1;
    return true;
  }

  liveEnemyCount() {
    return this.universes.reduce((sum, universe) => {
      return sum + universe.enemies.filter((enemy) => !enemy.dead && !enemy.expired).length;
    }, 0);
  }

  updateStabilityFromThreats() {
    const totalPlannedThreat = this.roundThreatTotal + this.roundPendingThreat;

    if (totalPlannedThreat <= 0) {
      this.stability = 0;
      return;
    }

    this.stability = clamp((this.roundThreatCleared / totalPlannedThreat) * 100, 0, 100);
  }

  canEndRoundFromThreats() {
    return this.encounterActive && this.incursionQueue.length === 0 && !this.incursionDeploying && this.roundPendingThreat <= 0 && this.roundIncursionDeployed >= this.roundIncursionTotal && this.roundThreatTotal > 0 && this.roundThreatCleared >= this.roundThreatTotal && this.liveEnemyCount() === 0 && !this.roundGraceActive && !this.transitioning;
  }

  tryEndRoundFromThreats() {
    // The encounter director checks completion continuously, because kill events can be sneaky bastards...
    // This keeps the final battlefield-clear grace period from being skipped...
    this.updateStabilityFromThreats();

    if (!this.canEndRoundFromThreats()) {
      this.encounterClearTimer = 0;
    }
  }

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
  }

  totalPrimaryAsteroids() {
    return this.universes.reduce((sum, u) => sum + u.asteroids.filter((a) => a.primary).length, 0);
  }

  spawnBullet(universe, x, y, vx, vy, owner, scoreMultiplier, options = {}) {
    if (options.playSound !== false) {
      this.sound.play('shoot');
    }

    const bullet = new Bullet(this, universe, x, y, vx, vy, owner, scoreMultiplier, options);
    this.bullets.push(bullet);
    return bullet;
  }

  recordWrapShotHit(bullet) {
    if (bullet?.owner !== 'player') {
      return;
    }

    const totalWraps = bullet.wrapCount || 0;

    if (totalWraps > 0) {
      this.highestWrapShotCount = Math.max(this.highestWrapShotCount, totalWraps);
    }

    const multiUniversalWraps = bullet.multiUniversalWrapCount || 0;

    if (multiUniversalWraps > 0) {
      this.wrapShotHits += 1;
    }
  }

  playerHit(sourceVX = 0, sourceVY = 0) {
    if (this.invulnerable || this.debugInvulnerable || this.player?.dashing || !this.running) {
      return;
    }

    this.hp -= 1;
    this.sound.play('hitHurt');
    this.player.universe.triggerDamageShake();
    this.invulnerable = true;
    this.player.triggerDamageFlash();
    this.addFloatingText(this.player.universe, this.player.x, this.player.y - 18, formatText('float.hullDamage'), '#ff4d5a');
    this.triggerHitStop(0.06, 0.28, 0.24);

    setTimeout(() => { this.invulnerable = false; }, 900);

    const force = Math.max(1, Math.hypot(sourceVX, sourceVY));
    this.player.velX += (sourceVX / force) * 120;
    this.player.velY += (sourceVY / force) * 120;

    if (this.hp <= 0) {
      this.hp = 0;

      this.spawnExplosion(this.player.universe, this.player.x, this.player.y, { soundEffect: 'explosion', size: this.player.radius * 5.2, velX: this.player.velX * 0.06, velY: this.player.velY * 0.06 });

      this.gameOver();
    }
  }

  debugNextRound() {
    if (!this.running || this.roundEnding) {
      return;
    }

    for (const universe of this.universes) {
      for (const enemy of universe.enemies) {
        if (!enemy.dead) {
          enemy.dead = true;
          this.clearEnemyThreat(enemy);
        }
      }

      universe.enemies = [];
    }

    this.incursionQueue = [];
    this.incursionDeploying = false;
    this.encounterActive = true;
    this.roundPendingThreat = 0;
    this.roundIncursionDeployed = this.roundIncursionTotal;
    this.roundThreatTotal = Math.max(1, this.roundThreatTotal);
    this.roundThreatCleared = this.roundThreatTotal;
    this.stability = 100;
    this.flashMessage(formatText('message.debugNextRound'), 550);
    this.endRound();
  }

  debugKillAllEnemies() {
    if (!this.running) {
      return;
    }

    let killed = 0;

    for (const universe of this.universes) {
      for (const enemy of universe.enemies) {
        if (!enemy.dead) {
          enemy.killMultiplier = Math.max(1, enemy.killMultiplier || 1);
          enemy.dead = true;
          this.onEnemyDestroyed(enemy);
          killed += 1;
        }
      }

      universe.enemies = [];
    }

    this.flashMessage(formatText('message.debugKilledEnemies', { count: killed }), 650);
  }

  debugStartBossEncounter() {
    if (!this.running || this.bossActive || this.bossPending) {
      return;
    }

    const universe = this.player?.universe || this.universes[0];

    if (!universe) {
      return;
    }

    this.round = BOSS_ROUND;
    this.bossDefeated = false;
    this.roundEnding = false;
    this.roundGraceActive = false;
    this.encounterActive = true;
    this.encounterClearTimer = 0;
    this.incursionQueue = [];
    this.incursionDeploying = false;
    this.pendingEnemySpawns = [];
    this.roundPendingThreat = 0;
    this.roundIncursionTotal = 1;
    this.roundIncursionDeployed = 1;

    this.roundThreatTotal = 0;
    this.roundThreatCleared = 0;
    this.flashMessage('DEBUG: Boss test encounter', 700);
    this.startBossEncounter();
    this.updateHUD();
  }

  toggleDebugCollisionView() {
    if (!this.running) {
      return;
    }

    this.debugShowCollisions = !this.debugShowCollisions;
    this.flashMessage(`DEBUG: Collision view ${this.debugShowCollisions ? 'ON' : 'OFF'}`, 700);
  }

  debugGiveSniperPowerup() {
    if (!this.running) {
      return;
    }

    const alreadyInstalled = this.hasPowerup('sniper');

    if (!alreadyInstalled) {
      this.applyPowerup('sniper');
    }

    const state = alreadyInstalled ? formatText('message.debugOn') : formatText('message.powerupInstalled', { name: formatText('powerups.sniper.name') });
    this.flashMessage(formatText('message.debugSniperPowerup', { state }), 750);
  }

  drawCollisionDebug() {
    if (!this.debugShowCollisions) {
      return;
    }

    for (const universe of this.universes) {
      const ctx = universe.ctx;
      ctx.save();
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      const drawEntityShape = (entity) => {
        if (!entity || entity.dead || entity.expired || entity.universe !== universe) {
          return;
        }

        this.drawCollisionShape(ctx, entityCollisionShape(entity));
      };

      if (this.player?.universe === universe) {
        drawEntityShape(this.player);
      }

      for (const asteroid of universe.asteroids) {
        drawEntityShape(asteroid);
      }

      for (const pickup of universe.hullPickups) {
        drawEntityShape(pickup);
      }

      for (const enemy of universe.enemies) {
        drawEntityShape(enemy);

        if (enemy.getPartCollisionShape && enemy.parts) {
          for (const part of enemy.parts) {
            if (!part.destroyed) {
              this.drawCollisionShape(ctx, enemy.getPartCollisionShape(part));
            }
          }
        }
      }

      for (const bullet of this.bullets) {
        drawEntityShape(bullet);
      }

      ctx.restore();
    }
  }

  drawCollisionShape(ctx, shape) {
    if (!shape) {
      return;
    }

    if (Array.isArray(shape)) {
      for (const item of shape) {
        this.drawCollisionShape(ctx, item);
      }

      return;
    }

    ctx.beginPath();

    if (shape.type === 'box') {
      ctx.rect(shape.x, shape.y, shape.w, shape.h);
    } else if (shape.type === 'circle') {
      ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
    }

    ctx.stroke();
  }

  toggleDebugInvulnerability() {
    if (!this.running) {
      return;
    }

    this.debugInvulnerable = !this.debugInvulnerable;

    if (this.debugInvulnerable) {
      this.invulnerable = false;
      this.player.damageFlashTimer = 0;
    }

    this.flashMessage(formatText('message.debugInvulnerability', { state: formatText(this.debugInvulnerable ? 'message.debugOn' : 'message.debugOff') }), 750);
    this.updateHUD();
  }

  onEnemyHit(enemy, multiplier = 1) {
    if (!enemy || enemy.expired) {
      return;
    }

    this.awardPoints(ENEMY_HIT_SCORE, multiplier, enemy.universe, enemy.x, enemy.y - 14, '#fff3a3');
  }

  onEnemyDestroyed(enemy) {
    this.spawnExplosion(enemy.universe, enemy.x, enemy.y, { soundEffect: 'explosion', size: enemy.radius * 4.4, velX: enemy.velX * 0.08, velY: enemy.velY * 0.08 });

    this.clearEnemyThreat(enemy);

    if (enemy === this.boss || enemy.enemyType === 'boss') {
      this.finishBossEncounter();
      return;
    }

    const multiplier = Math.max(1, enemy.killMultiplier || 1);
    this.awardPoints(ENEMY_SCORE, multiplier, enemy.universe, enemy.x, enemy.y + 8, '#ffd25c');
    this.tryEndRoundFromThreats();
  }

  onAsteroidDestroyed(asteroid) {
    this.spawnExplosion(asteroid.universe, asteroid.x, asteroid.y, { size: asteroid.radius * 2.35, velX: asteroid.velX * 0.05, velY: asteroid.velY * 0.05 });

    const baseScore = Math.max(1, asteroid.size) * ASTEROID_SCORE_PER_SIZE;
    this.awardPoints(baseScore, asteroid.killMultiplier || 1, asteroid.universe, asteroid.x, asteroid.y, '#aefcff');

    if (asteroid.size > 1) {
      const fragments = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < fragments; i++) {
        const fragment = new Asteroid(this, asteroid.universe, asteroid.x, asteroid.y, asteroid.size - 1);
        fragment.primary = false;
        const angle = (Math.PI * 2 * i) / fragments + rand(-0.35, 0.35);
        const speed = rand(70, 130);
        fragment.velX = Math.cos(angle) * speed + asteroid.velX * 0.25;
        fragment.velY = Math.sin(angle) * speed + asteroid.velY * 0.25;
        asteroid.universe.asteroids.push(fragment);
      }
    }
  }

  spawnExplosion(universe, x, y, options = {}) {
    if (!universe) {
      return null;
    }

    if (options.soundEffect && options.playSound !== false) {
      this.sound.play(options.soundEffect);
    }

    const explosion = new ExplosionFX(this, universe, x, y, options);
    this.explosions.push(explosion);
    return explosion;
  }

  spawnWarpParticles(universe, x, y, options = {}) {
    if (!universe) {
      return null;
    }

    const burst = new WarpParticleFX(this, universe, x, y, options);
    this.explosions.push(burst);
    return burst;
  }

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
      
      if (shopReady) {
        this.multiverse += 1;
      }

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
  }

  showPowerupSelection(afterSelection = null) {
    this.keys = {};
    powerupOptions.innerHTML = '';
    powerupOverlay.classList.remove('hidden');

    const all = [
      { id: 'rapid', name: formatText('powerups.rapid.name'), desc: formatText('powerups.rapid.desc') },
      { id: 'multi', name: formatText('powerups.multi.name'), desc: formatText('powerups.multi.desc') },
      { id: 'shield', name: formatText('powerups.shield.name'), desc: formatText('powerups.shield.desc') },
      { id: 'speed', name: formatText('powerups.speed.name'), desc: formatText('powerups.speed.desc') },
      { id: 'quantum_boost', name: formatText('powerups.quantum_boost.name'), desc: formatText('powerups.quantum_boost.desc') },
      { id: 'sniper', name: formatText('powerups.sniper.name'), desc: formatText('powerups.sniper.desc') }
    ];

    const pool = all.filter((p) => !this.powerups.includes(p.id));
    const choices = [];

    while (choices.length < 3 && pool.length) {
      choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }

    if (!choices.length) {
      powerupOverlay.classList.add('hidden');

      if (afterSelection) {
        afterSelection();
      }

      return;
    }

    // Holy shit this is cursed, forgive me god...
    for (const option of choices) {
      const card = document.createElement('div');
      card.className = 'powerup-card';
      card.innerHTML = `<h3>${option.name}</h3><p>${option.desc}</p>`;

      card.addEventListener('click', () => {
        this.sound.play('powerupSelect');
        this.applyPowerup(option.id);
        powerupOverlay.classList.add('hidden');
        this.keys = {};

        this.showMessage(formatText('message.powerupInstalled', { name: option.name }), 900);

        if (afterSelection) {
          afterSelection();
        }
      });

      powerupOptions.appendChild(card);
    }
  }

  isShopOpen() {
    return !powerupOverlay.classList.contains('hidden');
  }

  isPauseMenuOpen() {
    return !pauseOverlay.classList.contains('hidden');
  }

  isControlsPanelOpen() {
    return !controlsPanel.classList.contains('hidden');
  }

  showControlsPanel() {
    if (!this.isPauseMenuOpen()) {
      return;
    }

    controlsPanel.classList.remove('hidden');
  }

  hideControlsPanel() {
    controlsPanel.classList.add('hidden');
  }

  clearMessageTimer() {
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.messageTimeout = null;
    this.messageExpiresAt = 0;
  }

  scheduleMessageHide(token, duration) {
    this.clearMessageTimer();
    this.messageRemainingMs = Math.max(0, duration);
    this.messageExpiresAt = performance.now() + this.messageRemainingMs;

    this.messageTimeout = setTimeout(() => {
      this.messageTimeout = null;

      if (token !== this.messageToken) {
        return;
      }

      messageOverlay.classList.add('hidden');
      this.messageExpiresAt = 0;
      this.messageRemainingMs = 0;
    }, this.messageRemainingMs);
  }

  pauseMessageTimer() {
    if (!this.messageTimeout) {
      return;
    }

    this.messageRemainingMs = Math.max(0, this.messageExpiresAt - performance.now());
    this.clearMessageTimer();
  }

  resumeMessageTimer() {
    if (messageOverlay.classList.contains('hidden') || this.messageRemainingMs <= 0) {
      return;
    }

    this.scheduleMessageHide(this.messageToken, this.messageRemainingMs);
  }

  pauseGame() {
    if (!this.running || this.isShopOpen() || this.transitioning || this.isPauseMenuOpen()) {
      return;
    }

    this.paused = true;
    this.clearAllInput();

    if (this.draggingUniverse) {
      this.stopDraggingUniverse();
    }

    this.laserCharging = false;
    this.laserAim = null;
    this.timeScale = 1;
    this.pauseMessageTimer();
    pauseOverlay.classList.remove('hidden');
  }

  resumeGame() {
    if (!this.isPauseMenuOpen() || this.isControlsPanelOpen()) {
      return;
    }

    this.paused = false;
    this.clearAllInput();
    pauseOverlay.classList.add('hidden');
    controlsPanel.classList.add('hidden');
    this.lastTime = performance.now();
    this.resumeMessageTimer();
  }

  togglePause() {
    if (this.isControlsPanelOpen()) {
      this.hideControlsPanel();
      return;
    }

    if (this.isPauseMenuOpen()) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

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
  }

  applyPowerup(id) {
    this.powerups.push(id);
    if (id === 'rapid') {
      this.player.fireRate = Math.max(0.08, this.player.fireRate * 0.55);
    }

    if (id === 'shield') {
      this.hp = MAX_PLAYER_HULL;
    }

    if (id === 'speed') {
      this.player.extraThrust += 95;
    }
  }

  hasPowerup(id) {
    return this.powerups.includes(id);
  }

  awardPoints(basePoints, multiplier, universe, x, y, color = '#ffd25c', label = '') {
    const mult = Math.max(1, multiplier || 1);
    const gained = Math.round(basePoints * mult);
    this.score += gained;
    const amountText = mult > 1 ? `+${gained} (+${basePoints}x${formatMultiplier(mult)})` : `+${gained}`;
    const text = label ? `${label} ${amountText}` : amountText;
    this.addFloatingText(universe, x, y, text, color);
  }

  addFloatingText(universe, x, y, text, color = '#ffd25c') {
    if (!universe) {
      return;
    }

    const floatingText = new FloatingText(this, universe, x, y, text, color);
    floatingText.avoidOverlaps(this.floatingTexts);
    this.floatingTexts.push(floatingText);
  }

  showMessage(text, duration = 1000) {
    const token = ++this.messageToken;
    messageText.textContent = text;
    messageOverlay.classList.remove('hidden');
    messageOverlay.classList.remove('message-enter');
    void messageOverlay.offsetWidth;
    messageOverlay.classList.add('message-enter');

    this.clearMessageTimer();

    if (this.paused) {
      this.messageRemainingMs = Math.max(0, duration);
      return;
    }

    this.scheduleMessageHide(token, duration);
  }

  flashMessage(text, duration = 400) {
    this.showMessage(text, duration);
  }

  checkPlayerCollisions() {
    const u = this.player.universe;

    for (const pickup of u.hullPickups) {
      if (pickup.collected) {
        continue;
      }

      if (entitiesOverlap(this.player, pickup)) {
        pickup.collect();
      }
    }

    if (this.player.dashing) {
      return;
    }

    for (const asteroid of u.asteroids) {
      if (asteroid.dead) {
        continue;
      }

      if (entitiesOverlap(this.player, asteroid)) {
        const dx = this.player.x - asteroid.x;
        const dy = this.player.y - asteroid.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.playerHit((dx / len) * 200, (dy / len) * 200);
        this.player.x += (dx / len) * 8;
        this.player.y += (dy / len) * 8;
      }
    }

    for (const enemy of u.enemies) {
      if (enemy.dead || enemy.expired) {
        continue;
      }

      if (entitiesOverlap(this.player, enemy)) {
        if (enemy.enemyType === 'boss') {
          this.hp = 1;
          this.playerHit(0, 300);
          return;
        }

        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.playerHit((dx / len) * 220, (dy / len) * 220);
        enemy.takeDamage(1, 1);
      }
    }
  }

  updateHUD() {
    const hullRatio = clamp(this.hp / MAX_PLAYER_HULL, 0, 1);
    hullValue.textContent = `${this.hp}/${MAX_PLAYER_HULL}`;

    if (hullGaugeNeedle) {
      hullGaugeNeedle.style.transform = `translateX(-50%) rotate(${-90 + hullRatio * 180}deg)`;
    }

    stabilityValue.textContent = formatText('hud.stability', { value: `${Math.floor(this.stability)}%` });
    roundValue.textContent = formatText('hud.round', { value: this.round });
    multiverseValue.textContent = formatText('hud.multiverse', { value: this.multiverse });
    scoreValue.textContent = formatText('hud.score', { value: Math.floor(this.score) });
    highscoreValue.textContent = formatText('hud.highscore', { value: Math.floor(this.highscore) });

    if (incursionValue) {
      const deployed = Math.min(this.roundIncursionDeployed, this.roundIncursionTotal);
      incursionValue.textContent = formatText('hud.incursions', { value: this.roundIncursionTotal > 0 ? `${deployed}/${this.roundIncursionTotal}` : formatText('status.none') });
    }

    if (playerHud) {
      if (this.player?.universe) {
        if (playerHud.parentElement !== this.player.universe.element) {
          this.player.universe.element.appendChild(playerHud);
        }

        playerHud.style.visibility = 'visible';
      } else {
        playerHud.style.visibility = 'hidden';
      }
    }

    const setAbilityCooldown = (element, label, cooldown, maxCooldown, activeLabel = null) => {
      const ready = cooldown <= 0 && !activeLabel;
      const ratio = activeLabel ? 1 : 1 - clamp(cooldown / maxCooldown, 0, 1);

      if (element) {
        element.style.setProperty('--cooldown-ratio', ratio.toFixed(3));
        element.dataset.ready = String(ready);
      }

      if (label) {
        label.textContent = activeLabel || (ready ? formatText('status.ready') : `${cooldown.toFixed(1)}s`);
      }
    };

    const warp = this.player ? this.player.warpCooldown : 0;
    setAbilityCooldown(warpCooldown, warpValue, warp, 3.5);

    const dashTime = this.player ? this.player.dashCooldown : 0;
    setAbilityCooldown(dashCooldown, dashValue, dashTime, DASH_COOLDOWN, this.player?.dashing ? formatText('status.dashing') : null);

    const laserTime = this.laserCooldown || 0;
    setAbilityCooldown(laserCooldown, laserValue, laserTime, LASER_COOLDOWN, this.laserCharging ? formatText('status.locking') : null);
  }

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
}

window.addEventListener('load', async () => {
  await loadGameText();
  applyStaticText();
  spawnBanner.innerHTML = formatText('spawn.nextUniverseIn', { seconds: '<span id="spawn-timer">10</span>' });
  const game = new Game();

  focusOverlay.classList.remove('hidden');
  focusOverlay.focus();

  let focusStarted = false;

  const beginFocusedGame = async () => {
    if (focusStarted) {
      return;
    }

    focusStarted = true;
    document.body.classList.remove('focus-pending');
    focusOverlay.classList.add('hidden');
    await game.enterFullscreenMode();
    game.start();
  };

  focusOverlay.addEventListener('click', beginFocusedGame);

  focusOverlay.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'Space') {
      return;
    }

    e.preventDefault();
    beginFocusedGame();
  });
});