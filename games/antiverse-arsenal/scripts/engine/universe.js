// Universe windows...
class Universe {
  constructor(game, id, x, y, collapsed = false) {
    this.game = game;
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = LOGICAL_W;
    this.height = LOGICAL_H;
    this.headerHeight = HEADER_H;
    this.enemies = [];
    this.shipDebris = [];
    this.asteroids = [];
    this.hullPickups = [];
    this.theme = this.game.getUniverseTheme();
    this.collapseCountdown = null;
    this.collapseDuration = 0;
    this.collapseClosing = false;
    this.collapseWarningSecond = null;
    this.collapseShakeTimer = 0;
    this.shakeCharge = 0;
    this.shakeLockTimer = 0;
    this.shakeLockDuration = 0;

    this.element = document.createElement('div');
    this.element.className = collapsed ? 'universe universe-collapsed' : 'universe';

    this.header = document.createElement('div');
    this.header.className = 'universe-header';
    this.element.appendChild(this.header);

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.element.appendChild(this.canvas);

    this.shakeLockBadge = document.createElement('div');
    this.shakeLockBadge.className = 'universe-shake-lock-badge hidden';
    this.shakeLockBadge.setAttribute('aria-hidden', 'true');
    this.element.appendChild(this.shakeLockBadge);

    this.messageOverlay = document.createElement('div');
    this.messageOverlay.className = 'universe-message-overlay hidden';
    this.messageOverlay.setAttribute('role', 'status');
    this.messageText = document.createElement('div');
    this.messageText.className = 'universe-message-text';
    this.messageOverlay.appendChild(this.messageText);
    this.element.appendChild(this.messageOverlay);

    this.element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    this.element.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        e.preventDefault();
        this.game.selectUniverseForReplacement(this);
        return;
      }

      if (e.button === 1) {
        e.preventDefault();
        this.warpToPointer(e);
        return;
      }

      if (e.button !== 0) {
        return;
      }

      e.preventDefault();
      this.game.startDraggingUniverse(this, e);
    });

    container.appendChild(this.element);
    this.applyTheme();
    this.applyScale(this.game.scale);
    this.setPosition(x, y);
    this.setLabel();
  }

  applyTheme() {
    this.element.style.setProperty('--universe-color', this.theme.color);
    this.element.style.setProperty('--universe-color-soft', this.theme.soft);
    this.element.style.setProperty('--universe-color-glow', this.theme.glow);
  }

  setLogicalSize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.applyScale(this.scale || this.game.scale);
    this.setPosition(this.x, this.y);
  }

  applyScale(scale) {
    this.baseScale = scale;
    this.scale = scale;
    this.cssWidth = this.width * this.scale;
    this.cssHeight = this.height * this.scale;
    this.cssHeader = this.headerHeight * this.scale;
    this.element.style.width = `${this.cssWidth}px`;
    this.element.style.height = `${this.cssHeight + this.cssHeader}px`;
    this.element.style.setProperty('--universe-header-height', `${this.cssHeader}px`);
    this.header.style.height = `${this.cssHeader}px`;
    this.header.style.lineHeight = `${this.cssHeader}px`;
    const headerFontSize = Math.max(16, Math.round((16 * this.scale) / 16) * 16);
    this.header.style.fontSize = `${headerFontSize}px`;
    this.canvas.style.top = `${this.cssHeader}px`;
    this.canvas.style.left = '0px';
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.messageOverlay.style.top = `${this.cssHeader}px`;
    this.messageOverlay.style.height = `${this.cssHeight}px`;
  }

  setLabel() {
    this.header.textContent = formatText('universe.label', { id: this.id });
  }

  setShakeCharge(value) {
    this.shakeCharge = clamp(Number(value) || 0, 0, 1);
    this.element.dataset.shakeCharge = this.shakeCharge.toFixed(3);
    this.element.style.setProperty('--shake-charge', this.shakeCharge.toFixed(3));
    this.element.style.setProperty('--shake-border-alpha', (0.45 + this.shakeCharge * 0.55).toFixed(3));
    this.element.style.setProperty('--shake-glow-alpha', (0.16 + this.shakeCharge * 0.58).toFixed(3));
    this.element.style.setProperty('--shake-glow-size', `${(5 + this.shakeCharge * 22).toFixed(1)}px`);
    this.element.classList.toggle('shake-charging', this.shakeCharge > 0.025 && !this.isShakeLocked());
  }

  isShakeLocked() {
    return this.shakeLockTimer > 0;
  }

  beginShakeLock(duration) {
    this.shakeLockDuration = Math.max(0.1, Number(duration) || 0.1);
    this.shakeLockTimer = this.shakeLockDuration;
    this.setShakeCharge(1);
    this.element.classList.remove('shake-charging');
    this.element.classList.add('shake-locked');
    this.updateShakeLockBadge();
  }

  updateShakeLock(dt) {
    if (!this.isShakeLocked()) {
      return;
    }

    this.shakeLockTimer = Math.max(0, this.shakeLockTimer - Math.max(0, dt));
    this.updateShakeLockBadge();

    if (this.shakeLockTimer <= 0) {
      this.endShakeLock();
    }
  }

  updateShakeLockBadge() {
    const ratio = this.shakeLockDuration > 0 ? clamp(this.shakeLockTimer / this.shakeLockDuration, 0, 1) : 0;
    this.element.style.setProperty('--shake-lock-ratio', ratio.toFixed(3));
    this.element.style.setProperty('--shake-lock-percent', `${(ratio * 100).toFixed(1)}%`);

    if (!this.isShakeLocked()) {
      this.shakeLockBadge.classList.add('hidden');
      return;
    }

    this.shakeLockBadge.textContent = formatText('status.shakeLocked', { seconds: this.shakeLockTimer.toFixed(1) });
    this.shakeLockBadge.classList.remove('hidden');
  }

  endShakeLock() {
    this.shakeLockTimer = 0;
    this.shakeLockDuration = 0;
    this.element.classList.remove('shake-locked');
    this.element.style.removeProperty('--shake-lock-ratio');
    this.element.style.removeProperty('--shake-lock-percent');
    this.shakeLockBadge.classList.add('hidden');
    this.setShakeCharge(0);
    this.game.refreshCustomCursorTarget?.();
  }

  startCollapseCountdown(duration) {
    if (this.collapseCountdown !== null || this.collapseClosing) {
      return false;
    }

    clearTimeout(this.messageTimeout);
    this.messageTimeout = null;
    this.collapseDuration = Math.max(0.1, duration);
    this.collapseCountdown = this.collapseDuration;
    this.collapseWarningSecond = null;
    this.collapseShakeTimer = 0;
    this.element.classList.add('universe-collapse-warning');
    this.messageOverlay.classList.remove('hidden', 'message-enter', 'message-exit');
    this.messageOverlay.classList.add('collapse-warning');
    this.updateCollapseWarningText();
    
    return true;
  }

  updateCollapseWarningText() {
    if (this.collapseCountdown === null) {
      return;
    }

    const tenths = Math.max(0, Math.ceil(this.collapseCountdown * 10) / 10);
    const displayValue = tenths.toFixed(1);

    if (this.collapseWarningSecond === displayValue) {
      return;
    }

    this.collapseWarningSecond = displayValue;
    this.messageText.textContent = formatText('message.universeCollapseWarning', { seconds: displayValue });
  }

  updateCollapseCountdown(dt) {
    if (this.collapseCountdown === null || this.collapseClosing) {
      return;
    }

    if (!this.game.running || this.game.roundEnding || this.game.transitioning || this.game.bossActive || this.game.bossPending) {
      this.cancelCollapseCountdown();
      return;
    }

    this.collapseCountdown = Math.max(0, this.collapseCountdown - dt);
    const progress = clamp(1 - this.collapseCountdown / this.collapseDuration, 0, 1);
    this.collapseShakeTimer -= dt;

    if (this.collapseShakeTimer <= 0) {
      const intensityProgress = progress * progress * progress;
      const intensity = UNIVERSE_COLLAPSE_MIN_SHAKE + (UNIVERSE_COLLAPSE_MAX_SHAKE - UNIVERSE_COLLAPSE_MIN_SHAKE) * intensityProgress;
      const rotation = (Math.random() * 2 - 1) * intensity * 0.06;
      const shakeX = (Math.random() * 2 - 1) * intensity;
      const shakeY = (Math.random() * 2 - 1) * intensity;
      const shakeInterval = UNIVERSE_COLLAPSE_SHAKE_INTERVAL_START + (UNIVERSE_COLLAPSE_SHAKE_INTERVAL_END - UNIVERSE_COLLAPSE_SHAKE_INTERVAL_START) * progress;
      this.element.style.setProperty('--collapse-shake-x', `${shakeX.toFixed(2)}px`);
      this.element.style.setProperty('--collapse-shake-y', `${shakeY.toFixed(2)}px`);
      this.element.style.setProperty('--collapse-shake-rotation', `${rotation.toFixed(2)}deg`);
      this.collapseShakeTimer = shakeInterval;
    }

    this.element.style.setProperty('--collapse-warning-progress', progress.toFixed(3));
    this.updateCollapseWarningText();

    if (this.collapseCountdown <= 0) {
      this.collapseCountdown = null;
      this.collapseClosing = true;
      this.game.closeCollapsingUniverse(this);
    }
  }

  cancelCollapseCountdown() {
    this.collapseCountdown = null;
    this.collapseDuration = 0;
    this.collapseWarningSecond = null;
    this.collapseShakeTimer = 0;
    this.element.classList.remove('universe-collapse-warning');
    this.element.style.removeProperty('--collapse-shake-x');
    this.element.style.removeProperty('--collapse-shake-y');
    this.element.style.removeProperty('--collapse-shake-rotation');
    this.element.style.removeProperty('--collapse-warning-progress');
    this.messageOverlay.classList.remove('collapse-warning');

    if (!this.collapseClosing) {
      this.messageOverlay.classList.add('hidden');
    }
  }

  showIncursionWarning(duration = 1800) {
    if (this.collapseCountdown !== null || this.collapseClosing) {
      return;
    }

    clearTimeout(this.messageTimeout);
    this.messageText.textContent = formatText('message.incursionWarning');
    this.messageOverlay.classList.remove('hidden', 'message-enter', 'message-exit');
    void this.messageOverlay.offsetWidth;
    this.messageOverlay.classList.add('message-enter');

    this.messageTimeout = setTimeout(() => {
      this.messageOverlay.classList.remove('message-enter');
      this.messageOverlay.classList.add('message-exit');
      
      this.messageTimeout = setTimeout(() => {
        this.messageOverlay.classList.add('hidden');
        this.messageOverlay.classList.remove('message-exit');
        this.messageTimeout = null;
      }, 320);
    }, duration);
  }

  warpToPointer(e) {
    const rect = this.getCanvasRect();

    if (e.clientX < rect.x || e.clientX > rect.x + rect.w || e.clientY < rect.y || e.clientY > rect.y + rect.h) {
      return;
    }

    const pos = this.worldToLocal(e.clientX, e.clientY);
    this.game.tryWarpTo(this, pos.x, pos.y);
  }

  setPosition(x, y) {
    const size = this.getOuterSize();
    const maxX = Math.max(0, window.innerWidth - size.w - 4);
    const maxY = Math.max(0, window.innerHeight - size.h - 4);
    this.x = pixelSnap(clamp(x, 4, maxX));
    this.y = pixelSnap(clamp(y, 4, maxY));
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
  }

  triggerDamageShake() {
    clearTimeout(this.damageShakeTimeout);
    this.element.classList.remove('damage-shake');
    void this.element.offsetWidth;
    this.element.classList.add('damage-shake');

    this.damageShakeTimeout = setTimeout(() => {
      this.element.classList.remove('damage-shake');
      this.damageShakeTimeout = null;
    }, 220);
  }

  getRect() {
    const size = this.getOuterSize();
    return { x: this.x, y: this.y, w: size.w, h: size.h };
  }

  getOuterSize() {
    // Include the content-box border while remaining unaffected by the grow/shrink transform...
    // Layout collision checks must use this, not just the scaled canvas and header dimensions!
    return {
      w: this.element.offsetWidth || this.cssWidth,
      h: this.element.offsetHeight || this.cssHeight + this.cssHeader
    };
  }

  getCanvasRect() {
    return { x: this.x, y: this.y + this.cssHeader, w: this.cssWidth, h: this.cssHeight };
  }

  localToWorld(x, y) {
    return { x: this.x + x * this.scale, y: this.y + this.cssHeader + y * this.scale };
  }

  worldToLocal(x, y) {
    return { x: (x - this.x) / this.scale, y: (y - this.y - this.cssHeader) / this.scale };
  }

  update(dt) {
    let destroyedEnemyRemoved = false;

    for (let i = this.shipDebris.length - 1; i >= 0; i--) {
      const debris = this.shipDebris[i];
      debris.update(dt);

      if (debris.dead) {
        this.shipDebris.splice(i, 1);
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      
      if (!enemy.dead) {
        enemy.update(dt);
      }

      if (enemy.dead) {
        this.enemies.splice(i, 1);
        destroyedEnemyRemoved = true;
        enemy.onDestroyed();
        continue;
      }

      if (enemy.universe !== this) {
        this.enemies.splice(i, 1);
        enemy.universe.enemies.push(enemy);
      }
    }

    if (destroyedEnemyRemoved && this.enemies.every((enemy) => enemy.dead || enemy.expired)) {
      this.game.maybeStartUniverseCollapse(this);
    }

    this.updateCollapseCountdown(dt);

    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];

      if (!asteroid.dead) {
        asteroid.update(dt);
      }

      if (asteroid.dead) {
        this.asteroids.splice(i, 1);

        if (!asteroid.expired) {
          asteroid.onDestroyed();
        }

        continue;
      }

      if (asteroid.universe !== this) {
        this.asteroids.splice(i, 1);
        asteroid.universe.asteroids.push(asteroid);
      }
    }

    for (let i = this.hullPickups.length - 1; i >= 0; i--) {
      const pickup = this.hullPickups[i];
      pickup.update(dt);

      if (pickup.collected) {
        this.hullPickups.splice(i, 1);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const hueShift = this.theme.hue;

    if (!drawPixelArtTiled(ctx, pixelArt.universeBackground, 0, 0, this.width, this.height, { time: this.game.spriteClock + this.id * 0.19, scale: UNIVERSE_BACKGROUND_TILE_SCALE })) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `hsla(${hueShift}, 100%, 55%, ${UNIVERSE_TINT_BACKGROUND_ALPHA})`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    // Hull pickups render beneath asteroids so rocks can pass visibly over them...
    for (const pickup of this.hullPickups) {
      pickup.draw(ctx);
    }

    for (const asteroid of this.asteroids) {
      asteroid.draw(ctx);
    }

    for (const debris of this.shipDebris) {
      debris.draw(ctx);
    }

    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }
  }
}