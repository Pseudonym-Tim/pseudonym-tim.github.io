class Game {
  constructor() {
    this.keys = {};
    this.universes = [];
    this.bullets = [];
    this.floatingTexts = [];
    this.player = null;
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.draggingUniverse = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.dragTilt = 0;
    this.dragTiltTarget = 0;
    this.dragLastMouseX = 0;
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
    this.stability = 0;
    this.roundThreatTotal = 0;
    this.roundThreatCleared = 0;
    this.roundPendingThreat = 0;
    this.incursionQueue = [];
    this.roundIncursionTotal = 0;
    this.roundIncursionDeployed = 0;
    this.incursionDeploying = false;
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
    this.roundEnding = false;
    this.invulnerable = false;
    this.debugInvulnerable = false;
    this.powerups = [];
    this.spriteClock = 0;
    this.scale = this.computeScale();
    this.messageToken = 0;
    this.startToken = 0;
    this.roundGraceActive = false;
    this.transitioning = false;
    this.initInput();
    restartButton.addEventListener('click', () => this.start());
  }

  computeScale() {
    // At 1920x1080 the design target is exactly 640x480... For now anyway, smaller screens
    // scale down so 2x2 universe layouts still fit during testing...
    const basedOnDesign = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    return clamp(basedOnDesign, 0.46, 1.05);
  }

  getMouseAimAngle() {
    if (!this.player?.universe) return null;
    const origin = this.player.universe.localToWorld(this.player.x, this.player.y);
    const dx = this.mouseX - origin.x;
    const dy = this.mouseY - origin.y;
    if (Math.hypot(dx, dy) < 2) return null;
    return worldAngleToLocal(Math.atan2(dy, dx), this.player.universe);
  }

  canStartDash() {
    return Boolean(
      this.running &&
      this.player &&
      !this.player.dashing &&
      this.player.dashCooldown <= 0 &&
      !this.draggingUniverse &&
      !this.transitioning &&
      !this.isShopOpen()
    );
  }

  playerOverlapsDashObstacle(player = this.player) {
    if (!player?.universe) return false;
    const universe = player.universe;

    for (const asteroid of universe.asteroids) {
      if (asteroid.dead) continue;
      const radius = player.radius + asteroid.radius;
      if (distSq(player.x, player.y, asteroid.x, asteroid.y) < radius * radius) return true;
    }

    for (const enemy of universe.enemies) {
      if (enemy.dead || enemy.expired) continue;
      const radius = player.radius + enemy.radius;
      if (distSq(player.x, player.y, enemy.x, enemy.y) < radius * radius) return true;
    }

    return false;
  }

  applyDashDamage(player = this.player) {
    if (!player?.dashing || !player.universe) return;
    const universe = player.universe;
    const hitSet = player.dashHitEntities;

    for (const asteroid of universe.asteroids) {
      if (asteroid.dead || hitSet.has(asteroid)) continue;
      const radius = player.radius + asteroid.radius + 2;

      if (distSq(player.x, player.y, asteroid.x, asteroid.y) < radius * radius) {
        hitSet.add(asteroid);
        asteroid.takeDamage(DASH_DAMAGE, 1);
        this.addFloatingText(universe, asteroid.x, asteroid.y - 12, formatText('float.dashDamage', { damage: DASH_DAMAGE }), '#72f7ff', 0.9);
      }
    }

    for (const enemy of universe.enemies) {
      if (enemy.dead || enemy.expired || hitSet.has(enemy)) continue;
      const radius = player.radius + enemy.radius + 2;

      if (distSq(player.x, player.y, enemy.x, enemy.y) < radius * radius) {
        hitSet.add(enemy);
        enemy.takeDamage(DASH_DAMAGE, 1);
        this.addFloatingText(universe, enemy.x, enemy.y - 16, formatText('float.dashDamage', { damage: DASH_DAMAGE }), '#72f7ff', 0.9);
      }
    }
  }

  pushDashToSafety(player = this.player) {
    if (!player?.universe) return;
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

  clearMovementInput() {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
      this.keys[code] = false;
    }
  }

  clearAllInput() {
    this.keys = {};
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      if (this.isShopOpen()) {
        this.clearAllInput();
        return;
      }

      this.keys[e.code] = true;
      const isLaserControl = e.code === 'ControlLeft' || e.code === 'ControlRight';
      const laserModifierActive = isLaserControl || e.ctrlKey || this.isLaserControlHeld();

      if (e.code === 'Space' || laserModifierActive) e.preventDefault();

      if (isLaserControl && !e.repeat && this.laserCooldown > 0) {
        this.flashMessage(formatText('message.laserCooling', { seconds: this.laserCooldown.toFixed(1) }), 450);
      }

      const isShift = e.code === 'ShiftLeft' || e.code === 'ShiftRight';

      if (isShift && !e.repeat) {
        e.preventDefault();
        this.player?.tryDash();
      }

      // Debug testing commands...
      if (e.code === 'KeyN' && !e.repeat) this.debugNextRound();
      if (e.code === 'KeyK' && !e.repeat) this.debugKillAllEnemies();
      if (e.code === 'KeyI' && !e.repeat) this.toggleDebugInvulnerability();
    });

    window.addEventListener('keyup', (e) => {
      const wasLaserControl = e.code === 'ControlLeft' || e.code === 'ControlRight';
      if (wasLaserControl || e.ctrlKey || this.isLaserControlHeld()) e.preventDefault();
      this.keys[e.code] = false;
      if (wasLaserControl) this.releaseLaser();
    });

    document.addEventListener('selectstart', (e) => {
      if (this.laserCharging || this.isLaserControlHeld()) e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (this.draggingUniverse) this.onDrag(e);
    });

    document.addEventListener('mousedown', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    document.addEventListener('mouseup', () => {
      if (this.draggingUniverse) this.stopDraggingUniverse();
    });

    const cancelActiveInput = () => {
      this.clearAllInput();
      if (this.draggingUniverse) this.stopDraggingUniverse();
    };

    window.addEventListener('blur', cancelActiveInput);
    window.addEventListener('pagehide', cancelActiveInput);
    window.addEventListener('pointercancel', cancelActiveInput);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelActiveInput();
    });

    window.addEventListener('resize', () => {
      if (!this.running) return;
      const oldScale = this.scale;
      this.scale = this.computeScale();

      for (const u of this.universes) {
        const centerX = u.x + u.cssWidth / 2;
        const centerY = u.y + (u.cssHeight + u.cssHeader) / 2;
        u.applyScale(this.scale);
        u.setPosition(centerX - u.cssWidth / 2, centerY - (u.cssHeight + u.cssHeader) / 2);
      }

      if (oldScale !== this.scale) this.resolveUniverseLayout();
    });
  }

  start() {
    for (const u of this.universes) u.element.remove();
    this.universes = [];
    this.bullets = [];
    this.floatingTexts = [];
    this.powerups = [];
    this.round = 1;
    this.stability = 0;
    this.roundThreatTotal = 0;
    this.roundThreatCleared = 0;
    this.roundPendingThreat = 0;
    this.incursionQueue = [];
    this.roundIncursionTotal = 0;
    this.roundIncursionDeployed = 0;
    this.incursionDeploying = false;
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
    this.draggingUniverse = null;
    document.body.classList.remove('window-dragging');
    this.clearAllInput();
    this.invulnerable = false;
    this.debugInvulnerable = false;
    this.running = true;
    this.timeScale = 1;
    this.laserCharging = false;
    this.laserAim = null;
    this.laserFlash = [];
    this.laserCooldown = 0;
    this.roundGraceActive = false;
    this.transitioning = false;
    this.scale = this.computeScale();
    gameoverOverlay.classList.add('hidden');
    powerupOverlay.classList.add('hidden');

    const firstSlot = this.randomUniversePosition();
    const u = this.createUniverse(firstSlot.x, firstSlot.y);
    this.player = new Player(this, u, LOGICAL_W / 2, LOGICAL_H / 2);
    this.spawnAsteroids(2, [u]);
    this.maybeSpawnHullPickup(u);
    this.beginRoundGrace(u, 3);
    this.lastTime = performance.now();
    this.updateHUD();
    requestAnimationFrame((t) => this.loop(t));
  }

  createUniverse(x, y, collapsed = false) {
    const universe = new Universe(this, this.universes.length + 1, x, y, collapsed);
    this.universes.push(universe);
    return universe;
  }

  async growUniverse(universe, duration = 720) {
    universe.element.classList.remove('universe-shrink-out');
    universe.element.classList.remove('universe-grow-in');
    void universe.element.offsetWidth;
    universe.element.classList.remove('universe-collapsed');
    universe.element.classList.add('universe-grow-in');
    await sleep(duration);
    universe.element.classList.remove('universe-grow-in');
  }

  async shrinkUniverse(universe, duration = 550) {
    universe.element.classList.remove('universe-grow-in');
    universe.element.classList.remove('universe-shrink-out');
    void universe.element.offsetWidth;
    universe.element.classList.add('universe-shrink-out');
    await sleep(duration);
    universe.element.classList.remove('universe-shrink-out');
    universe.element.classList.add('universe-collapsed');
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

    if (!this.running) return;

    for (const u of [...this.universes]) {
      if (u !== survivor) u.element.remove();
    }

    this.universes = [survivor];
    survivor.id = 1;
    survivor.setLabel();
    this.removeEnemiesInUniverse(survivor);
    survivor.asteroids = survivor.asteroids.filter((a) => !a.dead);
    survivor.setPosition(survivor.x, survivor.y);
    this.bullets = [];

    this.showMessage(formatText('message.entryUniverseReconstituting'), 900);
    await this.growUniverse(survivor);
    if (!this.running) return;
    this.transitioning = false;
    this.keys = {};
  }

  layoutSlots() {
    const ghostW = LOGICAL_W * this.scale;
    const ghostH = (LOGICAL_H + HEADER_H) * this.scale;
    const margin = Math.max(8, 18 * this.scale);
    const right = Math.max(margin, window.innerWidth - ghostW - margin);
    const bottom = Math.max(margin, window.innerHeight - ghostH - margin);

    return [
      { x: margin, y: margin },
      { x: right, y: margin },
      { x: margin, y: bottom },
      { x: right, y: bottom }
    ];
  }

  randomUniversePosition() {
    const w = LOGICAL_W * this.scale;
    const h = (LOGICAL_H + HEADER_H) * this.scale;
    const padding = Math.max(10, 20 * this.scale);
    const maxX = Math.max(padding, window.innerWidth - w - padding);
    const maxY = Math.max(padding, window.innerHeight - h - padding);
    return { x: rand(padding, maxX), y: rand(padding, maxY) };
  }

  resolveUniverseLayout() {
    this.relaxUniverseLayout();
  }

  findSpawnLocation() {
    const w = LOGICAL_W * this.scale;
    const h = (LOGICAL_H + HEADER_H) * this.scale;
    const padding = 10;
    const maxX = Math.max(padding, window.innerWidth - w - padding);
    const maxY = Math.max(padding, window.innerHeight - h - padding);

    let best = null;
    let bestScore = Infinity;

    for (let attempt = 0; attempt < 80; attempt++) {
      const rect = {
        x: rand(padding, maxX),
        y: rand(padding, maxY),
        w,
        h
      };

      let score = 0;

      for (const u of this.universes) {
        const other = u.getRect();
        if (rectsOverlap(rect, other, 8)) {
          const ox = Math.min(rect.x + rect.w, other.x + other.w) - Math.max(rect.x, other.x);
          const oy = Math.min(rect.y + rect.h, other.y + other.h) - Math.max(rect.y, other.y);
          score += Math.max(0, ox) * Math.max(0, oy);
        }
      }

      if (score < bestScore) {
        bestScore = score;
        best = rect;
      }

      if (score === 0) {
        return { x: rect.x, y: rect.y };
      }
    }

    // If the screen is crowded, use the least-bad organic location and let
    // the physics-style layout relaxation bump nearby windows out of the way...
    return { x: best?.x ?? padding, y: best?.y ?? padding };
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
    this.lastCountdownSecond = null;
    this.updateStabilityFromThreats();
  }

  releasePendingThreat(count) {
    this.roundPendingThreat = Math.max(0, this.roundPendingThreat - count);
  }

  nextIncursionDelay() {
    const roundAcceleration = Math.min(1.5, this.round * 0.12);

    return rand(
      Math.max(3.2, INCURSION_DELAY_MIN - roundAcceleration),
      Math.max(5.0, INCURSION_DELAY_MAX - roundAcceleration)
    );
  }

  scheduleNextIncursion() {
    if (this.incursionQueue.length <= 0) {
      this.announceFinalIncursion();
      return;
    }

    this.spawnTimer = this.nextIncursionDelay();
    this.lastCountdownSecond = null;
  }

  announceFinalIncursion() {
    if (this.finalIncursionAnnounced) return;
    this.finalIncursionAnnounced = true;
    this.flashMessage(formatText('message.finalIncursion'), 1500);
  }

  spawnNewUniverse(enemyCount) {
    if (this.universes.length >= MAX_UNIVERSES || !this.running || this.roundEnding || this.incursionDeploying) return false;

    this.incursionDeploying = true;
    const pos = this.findSpawnLocation();
    const universe = this.createUniverse(pos.x, pos.y, true);
    this.relaxUniverseLayout(universe);
    this.showMessage(formatText('message.universeMaterializing', { id: universe.id }), 900);

    this.growUniverse(universe).then(() => {
      if (!this.running || this.roundEnding || !this.universes.includes(universe)) {
        this.incursionDeploying = false;
        return;
      }

      this.releasePendingThreat(enemyCount);
      this.spawnEnemies(enemyCount, [universe]);
      this.roundIncursionDeployed += 1;
      if (this.totalPrimaryAsteroids() < MAX_PRIMARY_ASTEROIDS) this.spawnAsteroids(1, [universe]);
      this.maybeSpawnHullPickup(universe);
      this.incursionDeploying = false;
      this.updateStabilityFromThreats();
      this.flashMessage(formatText('message.incursionEntering', { current: this.roundIncursionDeployed, total: this.roundIncursionTotal, universe: universe.id }), 1000);
      if (this.incursionQueue.length > 0) this.scheduleNextIncursion();
      else this.announceFinalIncursion();
    });

    return true;
  }

  resolveUniverseLayoutIfNeeded() {
    for (let i = 0; i < this.universes.length; i++) {
      for (let j = i + 1; j < this.universes.length; j++) {
        if (rectsOverlap(this.universes[i].getRect(), this.universes[j].getRect(), 6)) {
          this.relaxUniverseLayout(this.universes[j]);
          return;
        }
      }
    }
  }

  relaxUniverseLayout(focus = null) {
    const padding = Math.max(8, 14 * this.scale);
    const maxIterations = 90;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let moved = false;

      for (let i = 0; i < this.universes.length; i++) {
        for (let j = i + 1; j < this.universes.length; j++) {
          const aU = this.universes[i];
          const bU = this.universes[j];
          const a = aU.getRect();
          const b = bU.getRect();
          const aCx = a.x + a.w / 2;
          const aCy = a.y + a.h / 2;
          const bCx = b.x + b.w / 2;
          const bCy = b.y + b.h / 2;
          let dx = bCx - aCx;
          let dy = bCy - aCy;
          if (Math.abs(dx) < 0.01) dx = rand(-1, 1);
          if (Math.abs(dy) < 0.01) dy = rand(-1, 1);

          const overlapX = (a.w + b.w) / 2 + padding - Math.abs(dx);
          const overlapY = (a.h + b.h) / 2 + padding - Math.abs(dy);

          if (overlapX <= 0 || overlapY <= 0) continue;

          const moveFocusWeight = 0.38;
          const aWeight = focus === aU ? moveFocusWeight : focus === bU ? 1 - moveFocusWeight : 0.5;
          const bWeight = 1 - aWeight;

          if (overlapX < overlapY) {
            const sign = dx >= 0 ? 1 : -1;
            const push = overlapX + rand(1, 7 * this.scale);
            aU.setPosition(aU.x - sign * push * aWeight, aU.y + rand(-0.8, 0.8));
            bU.setPosition(bU.x + sign * push * bWeight, bU.y + rand(-0.8, 0.8));
          } else {
            const sign = dy >= 0 ? 1 : -1;
            const push = overlapY + rand(1, 7 * this.scale);
            aU.setPosition(aU.x + rand(-0.8, 0.8), aU.y - sign * push * aWeight);
            bU.setPosition(bU.x + rand(-0.8, 0.8), bU.y + sign * push * bWeight);
          }

          moved = true;
        }
      }

      if (!moved) break;
    }
  }

  updateSpawnCountdown(dt) {
    if (this.roundEnding || this.isShopOpen() || this.transitioning) return;

    if (this.roundGraceActive || !this.encounterActive) {
      spawnBanner.textContent = formatText('message.incursionSignaturesForming');
      nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: formatText('status.forming') });
      return;
    }

    if (this.incursionDeploying) {
      spawnBanner.textContent = formatText('message.universeMaterializingStatus');
      nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: formatText('status.deploying') });
      return;
    }

    if (this.incursionQueue.length > 0) {
      const liveEnemies = this.liveEnemyCount();
      if (liveEnemies === 0) this.spawnTimer = Math.min(this.spawnTimer, EMPTY_FIELD_INCURSION_DELAY);
      const pressureScale = liveEnemies >= 7 ? 0.68 : (liveEnemies >= 4 ? 0.84 : 1);
      this.spawnTimer = Math.max(0, this.spawnTimer - dt * pressureScale);
      const seconds = Math.ceil(this.spawnTimer);
      spawnBanner.innerHTML = formatText('message.nextIncursionIn', { seconds: `<span id="spawn-timer">${seconds}</span>` });
      nextUniverseValue.textContent = formatText('hud.nextIncursion', { value: `${seconds}s` });
      spawnBanner.classList.toggle('warning', seconds <= 3);

      if (seconds <= 3 && seconds > 0 && this.lastCountdownSecond !== seconds) {
        this.lastCountdownSecond = seconds;
        this.flashMessage(`${seconds}`, 350);
      }

      if (this.spawnTimer <= 0) {
        const incursion = this.incursionQueue.shift();
        if (!this.spawnNewUniverse(incursion.enemyCount)) this.incursionQueue.unshift(incursion);
        this.lastCountdownSecond = null;
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
    if (this.encounterClearTimer >= ENCOUNTER_CLEAR_DURATION) this.endRound();
  }

  maybeSpawnHullPickup(universe) {
    if (!universe || universe.hullPickups.length > 0 || Math.random() > HULL_PICKUP_SPAWN_CHANCE) return null;
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
        if (!enemy.dead) clearance = Math.min(clearance, Math.sqrt(distSq(x, y, enemy.x, enemy.y)) - enemy.radius - 30);
      }

      for (const asteroid of universe.asteroids) {
        if (!asteroid.dead) clearance = Math.min(clearance, Math.sqrt(distSq(x, y, asteroid.x, asteroid.y)) - asteroid.radius - 24);
      }

      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = { x, y };
      }

      if (clearance >= 0) break;
    }

    if (!best) return null;
    const pickup = new HullPickup(this, universe, best.x, best.y);
    universe.hullPickups.push(pickup);
    return pickup;
  }

  spawnEnemies(count, choices = this.universes) {
    for (let i = 0; i < count; i++) {
      const u = choices[Math.floor(Math.random() * choices.length)];
      const pos = this.safePosition(u, 96, { enemyDistance: 100, asteroidDistance: 42 });
      const enemy = new Enemy(this, u, pos.x, pos.y);
      this.registerEnemyThreat(enemy);
      u.enemies.push(enemy);
    }

    this.updateStabilityFromThreats();
  }

  spawnEnemiesFromOffscreen(count, universe) {
    const sides = this.distributedSides(count);
    const totals = [0, 0, 0, 0];
    const placed = [0, 0, 0, 0];
    for (const side of sides) totals[side] += 1;

    for (let i = 0; i < count; i++) {
      const margin = 36;
      const side = sides[i];
      const lane = placed[side]++;
      const fraction = (lane + 1) / (totals[side] + 1);
      const jitter = rand(-0.035, 0.035);
      const f = clamp(fraction + jitter, 0.08, 0.92);
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

      const enemy = new Enemy(this, universe, x, y);
      const targetAngle = (Math.PI * 2 * i / Math.max(1, count)) + rand(-0.18, 0.18);
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
      this.registerEnemyThreat(enemy);
      universe.enemies.push(enemy);
    }

    this.updateStabilityFromThreats();
  }

  distributedSides(count) {
    const start = Math.floor(Math.random() * 4);
    const sides = [];

    for (let i = 0; i < count; i++) sides.push((start + i) % 4);

    for (let i = sides.length - 1; i > 0; i--) {
      if (Math.random() < 0.35) {
        const j = Math.floor(Math.random() * (i + 1));
        [sides[i], sides[j]] = [sides[j], sides[i]];
      }
    }

    return sides;
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

      if (!spaced) continue;

      if (asteroidDistance > 0) {
        for (const asteroid of u.asteroids) {
          const min = asteroidDistance + asteroid.radius;
          if (!asteroid.dead && distSq(x, y, asteroid.x, asteroid.y) < min * min) {
            spaced = false;
            break;
          }
        }
      }

      if (spaced) return { x, y };
    }

    return { x: rand(40, LOGICAL_W - 40), y: rand(40, LOGICAL_H - 40) };
  }

  registerEnemyThreat(enemy) {
    if (enemy.threatCounted) return;
    enemy.threatCounted = true;
    enemy.threatCleared = false;
    this.roundThreatTotal += 1;
  }

  clearEnemyThreat(enemy) {
    if (!enemy.threatCounted || enemy.threatCleared) return false;
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
    return this.encounterActive &&
      this.incursionQueue.length === 0 &&
      !this.incursionDeploying &&
      this.roundPendingThreat <= 0 &&
      this.roundIncursionDeployed >= this.roundIncursionTotal &&
      this.roundThreatTotal > 0 &&
      this.roundThreatCleared >= this.roundThreatTotal &&
      this.liveEnemyCount() === 0 &&
      !this.roundGraceActive &&
      !this.transitioning;
  }

  tryEndRoundFromThreats() {
    // Completion is evaluated continuously by the encounter director, so 
    // final battlefield-clear grace period cannot be skipped by a kill event!
    this.updateStabilityFromThreats();
    if (!this.canEndRoundFromThreats()) this.encounterClearTimer = 0;
  }

  beginRoundGrace(universe, enemyCount) {
    const token = ++this.startToken;
    const round = this.round;
    this.removeEnemiesInUniverse(universe);
    this.roundGraceActive = true;
    this.prepareRoundEncounter(enemyCount);
    this.showMessage(formatText('message.roundBegins', { round, incursions: this.roundIncursionTotal }), 1800);

    const releaseEnemies = () => {
      if (!this.running || token !== this.startToken || this.round !== round) return;

      if (this.isShopOpen() || this.transitioning) {
        setTimeout(releaseEnemies, 100);
        return;
      }

      this.roundGraceActive = false;
      this.encounterActive = true;
      this.releasePendingThreat(enemyCount);
      this.spawnEnemiesFromOffscreen(enemyCount, universe);
      this.roundIncursionDeployed = 1;
      this.updateStabilityFromThreats();
      this.flashMessage(formatText('message.incursionEntering', { current: 1, total: this.roundIncursionTotal, universe: universe.id }), 1000);
      this.scheduleNextIncursion();
    };

    setTimeout(releaseEnemies, 3000);
  }

  totalPrimaryAsteroids() {
    return this.universes.reduce((sum, u) => sum + u.asteroids.filter((a) => a.primary).length, 0);
  }

  spawnBullet(universe, x, y, vx, vy, owner, scoreMultiplier, options = {}) {
    const bullet = new Bullet(this, universe, x, y, vx, vy, owner, scoreMultiplier, options);
    this.bullets.push(bullet);
    return bullet;
  }

  startDraggingUniverse(universe, e) {
    if (this.transitioning || this.isShopOpen()) return;
    this.draggingUniverse = universe;
    this.clearMovementInput();
    this.keys.Space = false;
    this.dragOffsetX = e.clientX - universe.x;
    this.dragOffsetY = e.clientY - universe.y;
    this.dragTilt = 0;
    this.dragTiltTarget = 0;
    this.dragLastMouseX = e.clientX;
    this.dragLastMoveTime = performance.now();
    universe.element.style.setProperty('--drag-tilt', '0deg');
    universe.element.style.zIndex = 4;
    universe.element.classList.add('dragging');
    document.body.classList.add('window-dragging');
    this.timeScale = 0;
  }

  getClampedUniversePosition(universe, x, y) {
    const maxX = Math.max(0, window.innerWidth - universe.cssWidth - 4);
    const maxY = Math.max(0, window.innerHeight - universe.cssHeight - universe.cssHeader - 4);
    return { x: clamp(x, 4, maxX), y: clamp(y, 4, maxY) };
  }

  overlapArea(a, b, padding = 0) {
    const overlapX = Math.min(a.x + a.w + padding, b.x + b.w + padding) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h + padding, b.y + b.h + padding) - Math.max(a.y, b.y);
    return Math.max(0, overlapX) * Math.max(0, overlapY);
  }

  pushUniverseAway(movable, obstacle, padding = 8, anchor = null) {
    const movingRect = movable.getRect();
    const obstacleRect = obstacle.getRect();
    if (!rectsOverlap(movingRect, obstacleRect, padding)) return false;

    const candidates = [
      { x: obstacleRect.x - padding - movingRect.w, y: movable.y },
      { x: obstacleRect.x + obstacleRect.w + padding, y: movable.y },
      { x: movable.x, y: obstacleRect.y - padding - movingRect.h },
      { x: movable.x, y: obstacleRect.y + obstacleRect.h + padding }
    ];

    let best = null;

    for (const candidate of candidates) {
      const pos = this.getClampedUniversePosition(movable, candidate.x, candidate.y);
      const rect = { x: pos.x, y: pos.y, w: movingRect.w, h: movingRect.h };
      let overlap = 0;

      for (const other of this.universes) {
        if (other === movable) continue;
        const weight = other === anchor ? 6 : 1;
        overlap += this.overlapArea(rect, other.getRect(), padding) * weight;
      }

      const distance = Math.hypot(pos.x - movable.x, pos.y - movable.y);
      const score = overlap * 100000 + distance;
      if (!best || score < best.score) best = { ...pos, score, overlap };
    }

    if (!best || (Math.abs(best.x - movable.x) < 0.01 && Math.abs(best.y - movable.y) < 0.01)) {
      return false;
    }

    movable.setPosition(best.x, best.y);
    movable.element.classList.add('collision-nudged');
    clearTimeout(movable.collisionNudgeTimeout);

    movable.collisionNudgeTimeout = setTimeout(() => {
      movable.element.classList.remove('collision-nudged');
      movable.collisionNudgeTimeout = null;
    }, 130);

    return true;
  }

  resolveDraggedUniverseCollisions(anchor) {
    const padding = Math.max(6, 9 * this.scale);
    const maxIterations = 36;
    const anchorRect = () => anchor.getRect();

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let moved = false;

      // First, the dragged universe directly pushes anything it touches...
      for (const other of this.universes) {
        if (other === anchor) continue;
        if (rectsOverlap(anchorRect(), other.getRect(), padding)) {
          moved = this.pushUniverseAway(other, anchor, padding, anchor) || moved;
        }
      }

      // Then propagate the displacement through resulting window chain...
      const anchorCenter = {
        x: anchor.x + anchor.cssWidth / 2,
        y: anchor.y + (anchor.cssHeight + anchor.cssHeader) / 2
      };

      for (let i = 0; i < this.universes.length; i++) {
        for (let j = i + 1; j < this.universes.length; j++) {
          const a = this.universes[i];
          const b = this.universes[j];
          if (a === anchor || b === anchor) continue;
          if (!rectsOverlap(a.getRect(), b.getRect(), padding)) continue;

          const aCenter = { x: a.x + a.cssWidth / 2, y: a.y + (a.cssHeight + a.cssHeader) / 2 };
          const bCenter = { x: b.x + b.cssWidth / 2, y: b.y + (b.cssHeight + b.cssHeader) / 2 };
          const aDistance = distSq(aCenter.x, aCenter.y, anchorCenter.x, anchorCenter.y);
          const bDistance = distSq(bCenter.x, bCenter.y, anchorCenter.x, anchorCenter.y);
          const movable = aDistance >= bDistance ? a : b;
          const obstacle = movable === a ? b : a;
          moved = this.pushUniverseAway(movable, obstacle, padding, anchor) || moved;
        }
      }

      if (!moved) break;
    }
  }

  onDrag(e) {
    const u = this.draggingUniverse;
    if (!u) return;

    const now = performance.now();
    const elapsedMs = clamp(now - this.dragLastMoveTime, 8, 50);
    const horizontalSpeed = (e.clientX - this.dragLastMouseX) / elapsedMs;
    this.dragTiltTarget = clamp(horizontalSpeed * 5, -7, 7);
    this.dragLastMouseX = e.clientX;
    this.dragLastMoveTime = now;

    u.setPosition(e.clientX - this.dragOffsetX, e.clientY - this.dragOffsetY);
    this.resolveDraggedUniverseCollisions(u);
  }

  updateDragTilt(dt) {
    const u = this.draggingUniverse;
    if (!u) return;

    const follow = 1 - Math.exp(-Math.max(0, dt) * 22);
    this.dragTilt += (this.dragTiltTarget - this.dragTilt) * follow;
    this.dragTiltTarget *= Math.exp(-Math.max(0, dt) * 8);

    if (Math.abs(this.dragTilt) < 0.01 && Math.abs(this.dragTiltTarget) < 0.01) {
      this.dragTilt = 0;
      this.dragTiltTarget = 0;
    }

    u.element.style.setProperty('--drag-tilt', `${this.dragTilt.toFixed(3)}deg`);
  }

  stopDraggingUniverse() {
    const u = this.draggingUniverse;
    if (!u) return;

    this.resolveDraggedUniverseCollisions(u);
    u.element.classList.remove('dragging');
    u.element.style.zIndex = 1;
    void u.element.offsetWidth;
    u.element.style.setProperty('--drag-tilt', '0deg');
    this.draggingUniverse = null;
    this.dragTilt = 0;
    this.dragTiltTarget = 0;
    this.dragLastMouseX = 0;
    this.dragLastMoveTime = 0;
    document.body.classList.remove('window-dragging');
    this.timeScale = 1;
    this.clearMovementInput();
    this.resolveUniverseLayoutIfNeeded();
  }

  isLaserControlHeld() {
    return Boolean(this.keys.ControlLeft || this.keys.ControlRight);
  }

  getLaserPlan() {
    const player = this.player;
    if (!player?.universe) return null;

    const angle = player.angle;
    const baseLocalDir = normalizeVector(Math.cos(angle), Math.sin(angle));
    const baseWorldAngle = localAngleToWorld(angle, player.universe);
    const worldDir = normalizeVector(Math.cos(baseWorldAngle), Math.sin(baseWorldAngle));
    if (!baseLocalDir || !worldDir) return null;

    const plan = { segments: [], locks: [] };
    let universe = player.universe;
    let localDir = { ...baseLocalDir };

    let startLocal = {
      x: player.x + localDir.x * (player.radius + 4),
      y: player.y + localDir.y * (player.radius + 4)
    };

    let wraps = 0;

    while (wraps <= MAX_WRAPS && universe) {
      const startWorld = universe.localToWorld(startLocal.x, startLocal.y);
      const exitWorld = rayExitRect(startWorld, worldDir, universe.getCanvasRect());

      if (!exitWorld) break;

      const rawEndLocal = universe.worldToLocal(exitWorld.x, exitWorld.y);

      const endLocal = {
        x: clamp(rawEndLocal.x, 0, universe.width),
        y: clamp(rawEndLocal.y, 0, universe.height)
      };

      const segment = { universe, from: { ...startLocal }, to: endLocal, wraps };
      plan.segments.push(segment);

      const segDx = endLocal.x - startLocal.x;
      const segDy = endLocal.y - startLocal.y;
      const segLen = Math.max(1, Math.hypot(segDx, segDy));
      const segDir = { x: segDx / segLen, y: segDy / segLen };

      for (const enemy of universe.enemies) {
        if (enemy.dead || enemy.expired || plan.locks.some((lock) => lock.enemy === enemy)) continue;
        const hit = rayCircleHit(startLocal, segDir, enemy, enemy.radius + LASER_LOCK_RADIUS, 0, segLen);
        if (hit) plan.locks.push({ enemy, universe, wraps, x: enemy.x, y: enemy.y, t: hit.t });
      }

      if (wraps >= MAX_WRAPS) break;

      const next = this.findRaycastUniverse(exitWorld.x + worldDir.x * 2, exitWorld.y + worldDir.y * 2, worldDir, universe);
      wraps += 1;

      if (next) {
        universe = next.universe;
        const inset = Math.max(3, 5 * universe.scale);
        startLocal = universe.worldToLocal(next.x + worldDir.x * inset, next.y + worldDir.y * inset);
        localDir = { ...baseLocalDir };
        continue;
      }

      const edgeInset = 0.5;

      startLocal = {
        x: rawEndLocal.x <= 0 ? universe.width - edgeInset : rawEndLocal.x >= universe.width ? edgeInset : clamp(rawEndLocal.x, edgeInset, universe.width - edgeInset),
        y: rawEndLocal.y <= 0 ? universe.height - edgeInset : rawEndLocal.y >= universe.height ? edgeInset : clamp(rawEndLocal.y, edgeInset, universe.height - edgeInset)
      };

      localDir = { ...baseLocalDir };
    }

    plan.locks.sort((a, b) => a.wraps - b.wraps || a.t - b.t);
    return plan;
  }

  updateLaser(dt) {
    this.laserCooldown = Math.max(0, this.laserCooldown - dt);
    const active = this.running && !this.isShopOpen() && !this.transitioning && !this.draggingUniverse && this.laserCooldown <= 0 && this.isLaserControlHeld();
    this.laserCharging = active;
    this.laserAim = active ? this.getLaserPlan() : null;
    if (active) this.timeScale = LASER_CHARGE_TIME_SCALE;
    else if (!this.draggingUniverse) this.timeScale = 1;

    for (let i = this.laserFlash.length - 1; i >= 0; i--) {
      this.laserFlash[i].life -= dt;
      if (this.laserFlash[i].life <= 0) this.laserFlash.splice(i, 1);
    }
  }

  releaseLaser() {
    if (!this.laserCharging || !this.laserAim?.locks.length) {
      this.laserCharging = false;
      this.laserAim = null;
      if (!this.draggingUniverse) this.timeScale = 1;
      return;
    }

    const plan = this.laserAim;
    const hitEnemies = new Set();

    for (const lock of plan.locks) {
      if (lock.enemy.dead || lock.enemy.expired || hitEnemies.has(lock.enemy)) continue;
      hitEnemies.add(lock.enemy);
      lock.enemy.takeDamage(LASER_DAMAGE, 1 + lock.wraps);
      this.onEnemyHit(lock.enemy, 1 + lock.wraps);
      this.addFloatingText(lock.universe, lock.enemy.x, lock.enemy.y - 18, formatText('float.laser', { wraps: lock.wraps }), '#ff4df0', 1.1);
    }

    for (const segment of plan.segments) {
      if (segment.universe !== this.player.universe) continue;
      const segDx = segment.to.x - segment.from.x;
      const segDy = segment.to.y - segment.from.y;
      const segLen = Math.max(1, Math.hypot(segDx, segDy));
      const segDir = { x: segDx / segLen, y: segDy / segLen };
      const startsAtMuzzle = distSq(segment.from.x, segment.from.y, this.player.x, this.player.y) < (this.player.radius + 8) ** 2;
      const hit = rayCircleHit(segment.from, segDir, this.player, this.player.radius + 3, startsAtMuzzle ? 20 : 0, segLen);
      
      if (hit) {
        this.playerHit(-segDir.x * 260, -segDir.y * 260);
        break;
      }
    }

    this.laserCooldown = LASER_COOLDOWN;
    this.laserFlash = plan.segments.map((segment) => ({ ...segment, life: 0.18, maxLife: 0.18 }));
    this.triggerHitStop(0.035, 0.18, 0.32);
    this.laserCharging = false;
    this.laserAim = null;
    if (!this.draggingUniverse) this.timeScale = 1;
  }

  drawLaserPlan(plan) {
    if (!plan) return;

    for (const segment of plan.segments) {
      const ctx = segment.universe.ctx;
      ctx.save();
      ctx.globalAlpha = Math.max(0.16, 0.72 - segment.wraps * 0.12);
      ctx.strokeStyle = '#ff4df0';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(segment.from.x, segment.from.y);
      ctx.lineTo(segment.to.x, segment.to.y);
      ctx.stroke();
      ctx.restore();
    }

    for (const lock of plan.locks) this.drawLaserReticle(lock);
  }

  drawLaserReticle(lock) {
    const ctx = lock.universe.ctx;
    const pulse = 1 + Math.sin(this.spriteClock * 18) * 0.08;
    ctx.save();
    ctx.translate(lock.x, lock.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#fffb8f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, lock.enemy.radius + 10, 0, Math.PI * 2);
    ctx.moveTo(-lock.enemy.radius - 16, 0);
    ctx.lineTo(-lock.enemy.radius - 5, 0);
    ctx.moveTo(lock.enemy.radius + 5, 0);
    ctx.lineTo(lock.enemy.radius + 16, 0);
    ctx.moveTo(0, -lock.enemy.radius - 16);
    ctx.lineTo(0, -lock.enemy.radius - 5);
    ctx.moveTo(0, lock.enemy.radius + 5);
    ctx.lineTo(0, lock.enemy.radius + 16);
    ctx.stroke();
    ctx.font = '12px "Lucida Console", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fffb8f';
    ctx.fillText(`${lock.wraps}/${MAX_WRAPS} WRAP`, 0, -lock.enemy.radius - 22);
    ctx.restore();
  }

  drawLaserFlashes() {
    for (const flash of this.laserFlash) {
      const ctx = flash.universe.ctx;
      const alpha = clamp(flash.life / flash.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(flash.from.x, flash.from.y);
      ctx.lineTo(flash.to.x, flash.to.y);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = '#ff4df0';
      ctx.lineWidth = 15;
      ctx.stroke();
      ctx.restore();
    }
  }

  recordWrapShotHit(bullet) {
    if (bullet?.owner !== 'player') return;

    const totalWraps = bullet.wrapCount || 0;

    if (totalWraps > 0) {
      this.highestWrapShotCount = Math.max(this.highestWrapShotCount, totalWraps);
    }

    const multiUniversalWraps = bullet.multiUniversalWrapCount || 0;

    if (multiUniversalWraps > 0) {
      this.wrapShotHits += 1;
    }
  }

  wrapEntity(entity, options = {}) {
    const u = entity.universe;
    const radius = entity.radius || 0;
    const outLeft = entity.x < -radius;
    const outRight = entity.x > u.width + radius;
    const outTop = entity.y < -radius;
    const outBottom = entity.y > u.height + radius;

    if (!(outLeft || outRight || outTop || outBottom)) return false;

    if (options.countWrap) {
      entity.wrapCount = (entity.wrapCount || 0) + 1;

      if (entity.wrapCount > (entity.maxWraps || MAX_WRAPS)) {
        entity.expired = true;
        entity.dead = true;
        return true;
      }

      if (options.scoreMultiplier && entity.scoreMultiplier !== undefined) {
        entity.scoreMultiplier += 1 + (this.hasPowerup('lucky') ? 0.5 : 0);
      }
    }

    const fallbackDirection = normalizeVector(
      (outRight ? 1 : 0) - (outLeft ? 1 : 0),
      (outBottom ? 1 : 0) - (outTop ? 1 : 0)
    );

    const velocityDirection = normalizeVector(entity.velX || 0, entity.velY || 0);
    const previousWorld = u.localToWorld(entity.prevX ?? clamp(entity.x, 0, u.width), entity.prevY ?? clamp(entity.y, 0, u.height));
    const currentWorld = u.localToWorld(entity.x, entity.y);
    const frameDirection = normalizeVector(currentWorld.x - previousWorld.x, currentWorld.y - previousWorld.y);
    const direction = velocityDirection || frameDirection || fallbackDirection || { x: 1, y: 0 };

    const sourceRect = u.getCanvasRect();
    const sourceExit = rayExitRect(previousWorld, direction, sourceRect);
    const clampedLocalX = clamp(entity.x, 0, u.width);
    const clampedLocalY = clamp(entity.y, 0, u.height);
    const clampedWorldExit = u.localToWorld(clampedLocalX, clampedLocalY);
    const worldExit = sourceExit || clampedWorldExit;
    const hit = this.findRaycastUniverse(worldExit.x, worldExit.y, direction, u);
    const target = hit?.universe || (options.sameUniverse ? u : null);

    if (!target) {
      entity.dead = true;
      return true;
    }

    if (target !== u && entity.owner === 'player') {
      entity.multiUniversalWrapCount = (entity.multiUniversalWrapCount || 0) + 1;
    }

    if (target === u) {
      if (outLeft) entity.x = u.width - radius;
      if (outRight) entity.x = radius;
      if (outTop) entity.y = u.height - radius;
      if (outBottom) entity.y = radius;
    } else {
      const inset = Math.max(2, radius * target.scale + 2);

      const targetLocal = target.worldToLocal(
        hit.x + direction.x * inset,
        hit.y + direction.y * inset
      );

      entity.universe = target;
      entity.x = clamp(targetLocal.x, radius + 1, target.width - radius - 1);
      entity.y = clamp(targetLocal.y, radius + 1, target.height - radius - 1);
    }

    return true;
  }

  findRaycastUniverse(worldX, worldY, direction, exclude) {
    let best = null;
    let bestT = Infinity;

    for (const u of this.universes) {
      if (u === exclude) continue;

      const rect = u.getCanvasRect();
      const hit = rayEnterRect({ x: worldX, y: worldY }, direction, rect, 0.5);

      if (hit && hit.t < bestT) {
        bestT = hit.t;
        best = { universe: u, x: hit.x, y: hit.y, t: hit.t };
      }
    }

    return best;
  }

  findNearestUniverse(worldX, worldY, exclude) {
    let best = null;
    let bestDistance = Infinity;

    for (const u of this.universes) {
      if (u === exclude) continue;
      const rect = u.getCanvasRect();
      const closest = closestPointToRect(worldX, worldY, rect);
      const d = distSq(worldX, worldY, closest.x, closest.y);

      if (d < bestDistance) {
        bestDistance = d;
        best = u;
      }
    }

    return best;
  }

  tryWarpTo(universe, x, y) {
    if (!this.player || this.player.warpCooldown > 0 || !this.universes.includes(universe)) return;
    this.player.universe = universe;
    this.player.x = clamp(x, this.player.radius, universe.width - this.player.radius);
    this.player.y = clamp(y, this.player.radius, universe.height - this.player.radius);
    this.player.velX *= 0.35;
    this.player.velY *= 0.35;
    this.player.warpCooldown = 3.5;
    this.flashMessage(formatText('message.warpedToUniverse', { id: universe.id }), 650);
  }

  safeWarpPosition(universe) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = rand(40, universe.width - 40);
      const y = rand(40, universe.height - 40);
      let safe = true;

      for (const enemy of universe.enemies) {
        if (distSq(x, y, enemy.x, enemy.y) < 70 * 70) { safe = false; break; }
      }

      if (!safe) continue;

      for (const asteroid of universe.asteroids) {
        const min = asteroid.radius + this.player.radius + 24;
        if (distSq(x, y, asteroid.x, asteroid.y) < min * min) { safe = false; break; }
      }

      if (safe) return { x, y };
    }
    return { x: universe.width / 2, y: universe.height / 2 };
  }

  playerHit(sourceVX = 0, sourceVY = 0) {
    if (this.invulnerable || this.debugInvulnerable || this.player?.dashing || !this.running) return;
    this.hp -= 1;
    this.player.universe.triggerDamageShake();
    this.invulnerable = true;
    this.player.blink = 1.1;
    this.addFloatingText(this.player.universe, this.player.x, this.player.y - 18, formatText('float.hullDamage'), '#ff4d5a', 1.05);
    this.triggerHitStop(0.06, 0.28, 0.24);
    setTimeout(() => { this.invulnerable = false; }, 900);

    const force = Math.max(1, Math.hypot(sourceVX, sourceVY));
    this.player.velX += (sourceVX / force) * 120;
    this.player.velY += (sourceVY / force) * 120;

    if (this.hp <= 0) {
      this.hp = 0;
      this.gameOver();
    }
  }

  debugNextRound() {
    if (!this.running || this.roundEnding) return;

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
    if (!this.running) return;
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

  toggleDebugInvulnerability() {
    if (!this.running) return;
    this.debugInvulnerable = !this.debugInvulnerable;

    if (this.debugInvulnerable) {
      this.invulnerable = false;
      this.player.blink = 0;
    }

    this.flashMessage(formatText('message.debugInvulnerability', { state: formatText(this.debugInvulnerable ? 'message.debugOn' : 'message.debugOff') }), 750);
    this.updateHUD();
  }

  onEnemyHit(enemy, multiplier = 1) {
    if (!enemy || enemy.expired) return;

    this.awardPoints(
      ENEMY_HIT_SCORE,
      multiplier,
      enemy.universe,
      enemy.x,
      enemy.y - 14,
      '#fff3a3',
      formatText('float.hit')
    );
  }

  onEnemyDestroyed(enemy) {
    this.clearEnemyThreat(enemy);
    const multiplier = Math.max(1, enemy.killMultiplier || 1);
    this.awardPoints(ENEMY_SCORE, multiplier, enemy.universe, enemy.x, enemy.y + 8, '#ffd25c', formatText('float.destroy'));
    this.triggerHitStop(0.045, 0.22, 0.28);
    this.tryEndRoundFromThreats();
  }

  onEnemyExpired(enemy) {
    this.clearEnemyThreat(enemy);
    this.addFloatingText(enemy.universe, clamp(enemy.x, 18, LOGICAL_W - 18), clamp(enemy.y, 18, LOGICAL_H - 18), formatText('float.escaped'), '#ff8a8a', 0.85);
    this.tryEndRoundFromThreats();
  }

  onAsteroidDestroyed(asteroid) {
    const baseScore = Math.max(1, asteroid.size) * ASTEROID_SCORE_PER_SIZE;
    this.awardPoints(baseScore, asteroid.killMultiplier || 1, asteroid.universe, asteroid.x, asteroid.y, '#aefcff');

    if (asteroid.size > 1) {
      const fragments = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < fragments; i++) {
        const fragment = new Asteroid(this, asteroid.universe, asteroid.x, asteroid.y, asteroid.size - 1);
        fragment.primary = false;
        const angle = (Math.PI * 2 * i / fragments) + rand(-0.35, 0.35);
        const speed = rand(70, 130);
        fragment.velX = Math.cos(angle) * speed + asteroid.velX * 0.25;
        fragment.velY = Math.sin(angle) * speed + asteroid.velY * 0.25;
        asteroid.universe.asteroids.push(fragment);
      }
    }
  }

  endRound() {
    if (this.roundEnding) return;
    this.roundEnding = true;
    this.showMessage(formatText('message.sectorStabilized'), 1300);

    setTimeout(async () => {
      if (!this.running) return;

      const survivor = this.player.universe;
      await this.playRoundTransition(survivor);

      if (!this.running) return;

      this.round += 1;
      this.stability = 0;
      this.roundThreatTotal = 0;
      this.roundThreatCleared = 0;
      this.roundPendingThreat = 0;
      this.incursionQueue = [];
      this.roundIncursionTotal = 0;
      this.roundIncursionDeployed = 0;
      this.incursionDeploying = false;
      this.encounterActive = false;
      this.finalIncursionAnnounced = false;
      this.encounterClearTimer = 0;
      this.spawnTimer = Infinity;
      this.lastCountdownSecond = null;
      this.roundEnding = false;
      const startGrace = () => this.beginRoundGrace(survivor, clamp(2 + this.round, 3, 7));
      while (this.totalPrimaryAsteroids() < MAX_PRIMARY_ASTEROIDS) this.spawnAsteroids(1, [survivor]);

      if (this.round % 3 === 0) {
        this.showMessage(formatText('message.traderDetected'), 1200);

        setTimeout(() => {
          if (this.running) this.showPowerupSelection(startGrace);
        }, 1250);
      } else {
        startGrace();
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
      { id: 'lucky', name: formatText('powerups.lucky.name'), desc: formatText('powerups.lucky.desc') }
    ];

    const pool = all.filter((p) => !this.powerups.includes(p.id));
    const choices = [];

    while (choices.length < 3 && pool.length) choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);

    if (!choices.length) {
      powerupOverlay.classList.add('hidden');
      if (afterSelection) afterSelection();
      return;
    }

    for (const option of choices) {
      const card = document.createElement('div');
      card.className = 'powerup-card';
      card.innerHTML = `<h3>${option.name}</h3><p>${option.desc}</p>`;

      card.addEventListener('click', () => {
        this.applyPowerup(option.id);
        powerupOverlay.classList.add('hidden');
        this.keys = {};
        this.showMessage(formatText('message.powerupInstalled', { name: option.name }), 900);
        if (afterSelection) afterSelection();
      });

      powerupOptions.appendChild(card);
    }
  }

  isShopOpen() {
    return !powerupOverlay.classList.contains('hidden');
  }

  applyPowerup(id) {
    this.powerups.push(id);
    if (id === 'rapid') this.player.fireRate = Math.max(0.08, this.player.fireRate * 0.55);
    if (id === 'shield') this.hp = MAX_PLAYER_HULL;
    if (id === 'speed') this.player.extraThrust += 95;
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
    this.addFloatingText(universe, x, y, text, color, mult > 1 ? 1.22 : 1);
  }

  addFloatingText(universe, x, y, text, color = '#ffd25c', scale = 1) {
    if (!universe) return;
    this.floatingTexts.push(new FloatingText(this, universe, x, y, text, color, scale));
  }

  triggerHitStop(stopSeconds = 0.035, slowSeconds = 0.16, slowScale = 0.35) {
    if (!this.running) return;
    this.hitStopTimer = Math.max(this.hitStopTimer, stopSeconds);
    this.hitSlowTimer = Math.max(this.hitSlowTimer, slowSeconds);
    this.hitSlowScale = Math.min(this.hitSlowTimer > 0 ? this.hitSlowScale : 1, slowScale);
  }

  showMessage(text, duration = 1000) {
    const token = ++this.messageToken;
    messageText.textContent = text;
    messageOverlay.classList.remove('hidden');

    setTimeout(() => {
      if (token === this.messageToken) messageOverlay.classList.add('hidden');
    }, duration);
  }

  flashMessage(text, duration = 400) {
    this.showMessage(text, duration);
  }

  loop(timestamp) {
    if (!this.running) return;
    const rawDt = Math.min(0.05, (timestamp - this.lastTime) / 1000 || 0);
    this.lastTime = timestamp;

    // Window manipulation is a true pause, so...
    // Skip every gameplay update, including firing, cooldowns, collisions, spawning, projectiles, effects, etc...
    if (this.draggingUniverse) {
      this.updateDragTilt(rawDt);
      this.updateHUD();
      this.draw();
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    const hitStopped = this.hitStopTimer > 0;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - rawDt);
    } else if (this.hitSlowTimer > 0) {
      this.hitSlowTimer = Math.max(0, this.hitSlowTimer - rawDt);
      if (this.hitSlowTimer <= 0) this.hitSlowScale = 1;
    }

    this.updateLaser(rawDt);
    const temporalScale = hitStopped ? 0 : this.timeScale * (this.hitSlowTimer > 0 ? this.hitSlowScale : 1);
    const playerDt = rawDt * temporalScale;
    this.update(playerDt, playerDt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(playerDt, worldDt = playerDt) {
    if (this.isShopOpen() || this.transitioning) {
      this.updateHUD();
      return;
    }

    // Player and world share the same clock, so window dragging still freezes both...
    this.spriteClock += worldDt;
    this.updateSpawnCountdown(worldDt);
    this.player.update(playerDt);

    for (const u of this.universes) u.update(worldDt);

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update(bullet.owner === 'player' ? playerDt : worldDt);
      if (bullet.dead) this.bullets.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const text = this.floatingTexts[i];
      text.update(worldDt);
      if (text.dead) this.floatingTexts.splice(i, 1);
    }

    this.checkPlayerCollisions();
    this.updateHUD();
  }

  checkPlayerCollisions() {
    const u = this.player.universe;

    for (const pickup of u.hullPickups) {
      if (pickup.collected) continue;
      const r = this.player.radius + pickup.radius;

      if (distSq(this.player.x, this.player.y, pickup.x, pickup.y) < r * r) {
        pickup.collect();
      }
    }

    if (this.player.dashing) return;

    for (const asteroid of u.asteroids) {
      if (asteroid.dead) continue;

      const r = this.player.radius + asteroid.radius;

      if (distSq(this.player.x, this.player.y, asteroid.x, asteroid.y) < r * r) {
        const dx = this.player.x - asteroid.x;
        const dy = this.player.y - asteroid.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.playerHit((dx / len) * 200, (dy / len) * 200);
        this.player.x += (dx / len) * 8;
        this.player.y += (dy / len) * 8;
      }
    }

    for (const enemy of u.enemies) {
      if (enemy.dead || enemy.expired) continue;

      const r = this.player.radius + enemy.radius;

      if (distSq(this.player.x, this.player.y, enemy.x, enemy.y) < r * r) {
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.playerHit((dx / len) * 220, (dy / len) * 220);
        enemy.takeDamage(1, 1);
      }
    }
  }

  draw() {
    for (const u of this.universes) u.draw();
    for (const bullet of this.bullets) bullet.draw();
    this.drawLaserPlan(this.laserAim);
    this.drawLaserFlashes();
    this.player.draw(this.player.universe.ctx);
    for (const text of this.floatingTexts) text.draw();
  }

  updateHUD() {
    hullValue.textContent = formatText('hud.hull', { value: `${this.hp}/${MAX_PLAYER_HULL}` });
    stabilityValue.textContent = formatText('hud.stability', { value: `${Math.floor(this.stability)}%` });
    roundValue.textContent = formatText('hud.round', { value: this.round });
    scoreValue.textContent = formatText('hud.score', { value: Math.floor(this.score) });
    highscoreValue.textContent = formatText('hud.highscore', { value: Math.floor(this.highscore) });

    if (incursionValue) {
      const deployed = Math.min(this.roundIncursionDeployed, this.roundIncursionTotal);
      incursionValue.textContent = formatText('hud.incursions', { value: this.roundIncursionTotal > 0 ? `${deployed}/${this.roundIncursionTotal}` : formatText('status.none') });
    }

    const warp = this.player ? this.player.warpCooldown : 0;
    warpValue.textContent = formatText('hud.warp', { value: warp <= 0 ? formatText('status.ready') : `${warp.toFixed(1)}s` });
    const dashCooldown = this.player ? this.player.dashCooldown : 0;
    dashValue.textContent = formatText('hud.dash', { value: this.player?.dashing ? formatText('status.dashing') : (dashCooldown <= 0 ? formatText('status.ready') : `${dashCooldown.toFixed(1)}s`) });
  }

  gameOver() {
    this.running = false;
    this.clearAllInput();
    this.highscore = Math.max(this.highscore, Math.floor(this.score));
    localStorage.setItem('antiverseHighscore', String(this.highscore));
    finalScoreEl.textContent = formatText('gameover.score', { score: Math.floor(this.score) });
    finalHighscoreEl.textContent = formatText('gameover.highscore', { highscore: Math.floor(this.highscore) });
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
  game.start();
});