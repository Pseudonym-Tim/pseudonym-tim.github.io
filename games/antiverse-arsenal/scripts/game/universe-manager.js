// Universe window management...
Object.assign(Game.prototype, {
  computeScale() {
    // Scale from a crusty 640x480 target so the whole antiverse circus fits on normal screens...
    // Smaller screens get squeezed instead of detonating the layout...
    return computeViewportScale(1920, 1080, 0.46, 1.05);
  },

  createUniverseThemes() {
    return UNIVERSE_TINT_HUES.map((hue) => ({
      hue,
      color: `hsl(${hue}, 100%, 62%)`,
      soft: `hsla(${hue}, 100%, 55%, ${UNIVERSE_TINT_HEADER_ALPHA})`,
      glow: `hsla(${hue}, 100%, 62%, ${UNIVERSE_TINT_BORDER_ALPHA})`
    }));
  },

  getUniverseTheme() {
    const usedThemes = new Set(this.universes.map((universe) => universe.theme));
    const availableThemes = this.universeThemes.filter((theme) => !usedThemes.has(theme));
    const choices = availableThemes.length > 0 ? availableThemes : this.universeThemes;

    return choices[Math.floor(Math.random() * choices.length)] || {
      hue: 190,
      color: 'hsl(190, 100%, 62%)',
      soft: `hsla(190, 100%, 55%, ${UNIVERSE_TINT_HEADER_ALPHA})`,
      glow: `hsla(190, 100%, 62%, ${UNIVERSE_TINT_BORDER_ALPHA})`
    };
  },

  createUniverse(x, y, collapsed = false) {
    const universe = new Universe(this, this.universes.length + 1, x, y, collapsed);
    this.universes.push(universe);
    return universe;
  },

  async growUniverse(universe, duration = 720) {
    universe.element.classList.remove('universe-shrink-out');
    universe.element.classList.remove('universe-grow-in');
    void universe.element.offsetWidth;
    universe.element.classList.remove('universe-collapsed');
    universe.element.classList.add('universe-grow-in');
    await sleep(duration);
    universe.element.classList.remove('universe-grow-in');
  },

  async shrinkUniverse(universe, duration = 550) {
    universe.element.classList.remove('universe-grow-in');
    universe.element.classList.remove('universe-shrink-out');
    void universe.element.offsetWidth;
    universe.element.classList.add('universe-shrink-out');
    await sleep(duration);
    universe.element.classList.remove('universe-shrink-out');
    universe.element.classList.add('universe-collapsed');
  },

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
  },

  randomUniversePosition() {
    const w = LOGICAL_W * this.scale;
    const h = (LOGICAL_H + HEADER_H) * this.scale;
    return findOpenWindowPosition([], w, h, Math.max(10, 20 * this.scale), 1);
  },

  resolveUniverseLayout() {
    this.relaxUniverseLayout();
  },

  findSpawnLocation() {
    const w = LOGICAL_W * this.scale;
    const h = (LOGICAL_H + HEADER_H) * this.scale;

    // When the screen is packed, pick the least-awful spot and let layout physics shove crap around...
    // The relaxation pass can clean up the resulting window pileup...
    return findOpenWindowPosition(this.universes, w, h, 10);
  },

  resolveUniverseLayoutIfNeeded() {
    for (let i = 0; i < this.universes.length; i++) {
      for (let j = i + 1; j < this.universes.length; j++) {
        if (rectsOverlap(this.universes[i].getRect(), this.universes[j].getRect(), 6)) {
          this.relaxUniverseLayout(this.universes[j]);
          return;
        }
      }
    }
  },

  relaxUniverseLayout(focus = null) {
    relaxWindowLayout(this.universes, focus, this.scale);
  },

  startDraggingUniverse(universe, e) {
    if (this.transitioning || this.isShopOpen() || this.paused) return;
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
  },

  getClampedUniversePosition(universe, x, y) {
    return getClampedWindowPosition(universe, x, y);
  },

  pushUniverseAway(movable, obstacle, padding = 8, anchor = null) {
    const moved = pushWindowAway(movable, obstacle, this.universes, padding, anchor);
    if (!moved) return false;

    movable.element.classList.add('collision-nudged');
    clearTimeout(movable.collisionNudgeTimeout);

    movable.collisionNudgeTimeout = setTimeout(() => {
      movable.element.classList.remove('collision-nudged');
      movable.collisionNudgeTimeout = null;
    }, 130);

    return true;
  },

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
  },

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
  },

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
  },

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
});