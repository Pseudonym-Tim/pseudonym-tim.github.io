// Universe window management...
Object.assign(Game.prototype, {
  computeScale() {
    return UNIVERSE_WINDOW_SCALE;
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
    const reference = this.universes.find((universe) => universe.width === LOGICAL_W && universe.height === LOGICAL_H);
    const size = reference?.getOuterSize();
    const w = size?.w ?? LOGICAL_W * this.scale;
    const h = size?.h ?? (LOGICAL_H + HEADER_H) * this.scale;

    // When the screen is packed, pick the least shitty spot and let layout physics shove stuff around...
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

  makeRoomForSpawn(universe) {
    const padding = Math.max(6, 9 * this.scale);
    let relocated = false;

    // Keep spawn point stable and move every older window that intersects
    // it to a position which is clear of the new universe and all other
    // windows... Push solver can get pinned against a viewport edge, so
    // fresh placement search avoids leaving the unresolved overlap behind...
    for (const other of this.universes) {
      if (other === universe || !rectsOverlap(universe.getRect(), other.getRect(), padding)) {
        continue;
      }

      const obstacles = this.universes.filter((candidate) => candidate !== other);
      const size = other.getOuterSize();
      const position = findOpenWindowPosition(obstacles, size.w, size.h, padding);
      const candidateRect = { x: position.x, y: position.y, w: size.w, h: size.h };
      const isOpen = obstacles.every((obstacle) => !rectsOverlap(candidateRect, obstacle.getRect(), padding));

      if (isOpen) {
        other.setPosition(position.x, position.y);
        relocated = true;
      }
    }

    // If there actually is not enough fixed free space for a relocation,
    // just retain the chain-push/relax fallback so the entire layout can reflow...
    if (this.universes.some((other) => other !== universe && rectsOverlap(universe.getRect(), other.getRect(), padding))) {
      this.resolveDraggedUniverseCollisions(universe);
      this.relaxUniverseLayout(universe);
    }

    return relocated;
  },

  startDraggingUniverse(universe, e) {
    if (this.transitioning || this.isShopOpen() || this.paused) {
      return;
    }

    this.draggingUniverse = universe;
    this.clearMovementInput();
    this.keys.Space = false;
    this.dragOffsetX = e.clientX - universe.x;
    this.dragOffsetY = e.clientY - universe.y;
    this.dragTilt = 0;
    this.dragTiltTarget = 0;
    this.dragLastMouseX = e.clientX;
    this.dragLastMouseY = e.clientY;
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

  pushUniverseAway(movable, obstacle, padding = 8, anchor = null, pushDirection = null) {
    const moved = pushWindowAway(movable, obstacle, this.universes, padding, anchor, pushDirection);

    if (!moved) {
      return false;
    }

    movable.element.classList.add('collision-nudged');
    clearTimeout(movable.collisionNudgeTimeout);

    movable.collisionNudgeTimeout = setTimeout(() => {
      movable.element.classList.remove('collision-nudged');
      movable.collisionNudgeTimeout = null;
    }, 130);

    return true;
  },

  hasUniverseOverlaps(padding = Math.max(6, 9 * this.scale)) {
    for (let i = 0; i < this.universes.length; i++) {
      for (let j = i + 1; j < this.universes.length; j++) {
        if (rectsOverlap(this.universes[i].getRect(), this.universes[j].getRect(), padding)) {
          return true;
        }
      }
    }

    return false;
  },

  moveDraggedUniverseToOpenPosition(anchor, target, padding) {
    const start = { x: anchor.x, y: anchor.y };
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(target.x - start.x), Math.abs(target.y - start.y)) / 4));
    let position = start;

    // Walk the requested drag path rather than jumping straight to the end...
    // Leaves the window at the last clear point when a chain is pinned against an edge and can't be pushed any farther...
    for (let step = 1; step <= steps; step++) {
      const progress = step / steps;

      const candidate = this.getClampedUniversePosition(anchor, start.x + (target.x - start.x) * progress, start.y + (target.y - start.y) * progress);
      const candidateRect = { ...anchor.getRect(), x: candidate.x, y: candidate.y };

      if (this.universes.some((other) => other !== anchor && rectsOverlap(candidateRect, other.getRect(), padding))) {
        break;
      }

      position = candidate;
    }

    anchor.setPosition(position.x, position.y);
  },

  resolveDraggedUniverseCollisions(anchor, dragDelta = null) {
    const padding = Math.max(6, 9 * this.scale);
    const maxIterations = 36;
    const anchorRect = () => anchor.getRect();

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let moved = false;

      // First, the dragged universe directly pushes anything it touches...
      for (const other of this.universes) {
        if (other === anchor) {
          continue;
        }

        if (rectsOverlap(anchorRect(), other.getRect(), padding)) {
          moved = this.pushUniverseAway(other, anchor, padding, anchor, dragDelta) || moved;
        }
      }

      // Then propagate the displacement through resulting window chain...
      const anchorCenter = { x: anchor.x + anchor.cssWidth / 2, y: anchor.y + (anchor.cssHeight + anchor.cssHeader) / 2 };

      for (let i = 0; i < this.universes.length; i++) {
        for (let j = i + 1; j < this.universes.length; j++) {
          const a = this.universes[i];
          const b = this.universes[j];

          if (a === anchor || b === anchor) {
            continue;
          }

          if (!rectsOverlap(a.getRect(), b.getRect(), padding)) {
            continue;
          }

          const aCenter = { x: a.x + a.cssWidth / 2, y: a.y + (a.cssHeight + a.cssHeader) / 2 };
          const bCenter = { x: b.x + b.cssWidth / 2, y: b.y + (b.cssHeight + b.cssHeader) / 2 };
          const aDistance = distSq(aCenter.x, aCenter.y, anchorCenter.x, anchorCenter.y);
          const bDistance = distSq(bCenter.x, bCenter.y, anchorCenter.x, anchorCenter.y);
          const movable = aDistance >= bDistance ? a : b;
          const obstacle = movable === a ? b : a;
          const dx = movable.x - obstacle.x;
          const dy = movable.y - obstacle.y;
          moved = this.pushUniverseAway(movable, obstacle, padding, anchor, { x: dx, y: dy }) || moved;
        }
      }

      if (!moved) {
        break;
      }
    }
  },

  correctDraggedUniverseOverlap(anchor, axis, delta, padding) {
    if (Math.abs(delta) < 0.001) {
      return false;
    }

    const anchorRect = anchor.getRect();
    let x = anchor.x;
    let y = anchor.y;

    for (const other of this.universes) {
      if (other === anchor) {
        continue;
      }

      const otherRect = other.getRect();

      if (!rectsOverlap(anchorRect, otherRect, padding)) {
        continue;
      }

      if (axis === 'x') {
        if (delta > 0) {
          x = Math.min(x, otherRect.x - padding - anchorRect.w);
        } else {
          x = Math.max(x, otherRect.x + otherRect.w + padding);
        }
      } else if (delta > 0) {
        y = Math.min(y, otherRect.y - padding - anchorRect.h);
      } else {
        y = Math.max(y, otherRect.y + otherRect.h + padding);
      }
    }

    const corrected = this.getClampedUniversePosition(anchor, x, y);

    if (Math.abs(corrected.x - anchor.x) < 0.01 && Math.abs(corrected.y - anchor.y) < 0.01) {
      return false;
    }

    anchor.setPosition(corrected.x, corrected.y);
    return true;
  },

  moveDraggedUniverseAxis(anchor, axis, delta) {
    if (Math.abs(delta) < 0.001) {
      return;
    }

    const padding = Math.max(6, 9 * this.scale);
    const pushDirection = axis === 'x' ? { x: delta, y: 0 } : { x: 0, y: delta };
    const target = axis === 'x' ? this.getClampedUniversePosition(anchor, anchor.x + delta, anchor.y) : this.getClampedUniversePosition(anchor, anchor.x, anchor.y + delta);

    anchor.setPosition(target.x, target.y);
    this.resolveDraggedUniverseCollisions(anchor, pushDirection);

    // If the chain can't move far enough, just stop at the contact edge instead of overlapping...
    if (this.correctDraggedUniverseOverlap(anchor, axis, delta, padding)) {
      this.resolveDraggedUniverseCollisions(anchor, pushDirection);
    }
  },

  onDrag(e) {
    const u = this.draggingUniverse;

    if (!u) {
      return;
    }

    const now = performance.now();
    const elapsedMs = clamp(now - this.dragLastMoveTime, 8, 50);
    const dragDelta = { x: e.clientX - this.dragLastMouseX, y: e.clientY - this.dragLastMouseY };
    const horizontalSpeed = dragDelta.x / elapsedMs;
    this.dragTiltTarget = clamp(horizontalSpeed * 4, -5, 5);
    this.dragLastMouseX = e.clientX;
    this.dragLastMouseY = e.clientY;
    this.dragLastMoveTime = now;

    const padding = Math.max(6, 9 * this.scale);
    const positionsBeforeMove = this.universes.map((universe) => ({ universe, x: universe.x, y: universe.y }));
    const target = this.getClampedUniversePosition(u, e.clientX - this.dragOffsetX, e.clientY - this.dragOffsetY);
    this.moveDraggedUniverseAxis(u, 'x', target.x - u.x);
    this.moveDraggedUniverseAxis(u, 'y', target.y - u.y);

    // A window at the viewport edge may be impossible to push out of the way... 
    if (this.hasUniverseOverlaps(padding)) {
      for (const position of positionsBeforeMove) {
        position.universe.setPosition(position.x, position.y);
      }

      this.moveDraggedUniverseToOpenPosition(u, target, padding);
    }
  },

  updateDragTilt(dt) {
    const u = this.draggingUniverse;
    
    if (!u) {
      return;
    }

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

    if (!u) {
      return;
    }

    const padding = Math.max(6, 9 * this.scale);
    const positionsBeforeResolve = this.universes.map((universe) => ({ universe, x: universe.x, y: universe.y }));
    this.resolveDraggedUniverseCollisions(u);

    if (this.hasUniverseOverlaps(padding)) {
      for (const position of positionsBeforeResolve) {
        position.universe.setPosition(position.x, position.y);
      }
    }
    u.element.classList.remove('dragging');
    u.element.style.zIndex = 1;
    void u.element.offsetWidth;
    u.element.style.setProperty('--drag-tilt', '0deg');
    this.draggingUniverse = null;
    this.dragTilt = 0;
    this.dragTiltTarget = 0;
    this.dragLastMouseX = 0;
    this.dragLastMouseY = 0;
    this.dragLastMoveTime = 0;
    document.body.classList.remove('window-dragging');
    this.timeScale = 1;
    this.clearMovementInput();
  }
});