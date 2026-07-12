// Game input...
Object.assign(Game.prototype, {
  clearMovementInput() {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
      this.keys[code] = false;
    }
  },

  clearAllInput() {
    this.keys = {};
  },

  initInput() {
    window.addEventListener('keydown', (e) => {

      if (e.code === 'Escape' && !e.repeat) {
        e.preventDefault();
        this.togglePause();
        return;
      }

      if (this.paused) {
        this.clearAllInput();
        return;
      }

      if (this.isShopOpen()) {
        this.clearAllInput();
        return;
      }

      this.keys[e.code] = true;
      const isLaserControl = e.code === 'ControlLeft' || e.code === 'ControlRight';
      const laserModifierActive = isLaserControl || e.ctrlKey || this.isLaserControlHeld();

      if (e.code === 'Space' || laserModifierActive) e.preventDefault();

      const isShift = e.code === 'ShiftLeft' || e.code === 'ShiftRight';

      if (isShift && !e.repeat) {
        e.preventDefault();
        this.player?.tryDash();
      }

      // Debug testing commands...
      if (e.code === 'KeyN' && !e.repeat) this.debugNextRound();
      if (e.code === 'KeyK' && !e.repeat) this.debugKillAllEnemies();
      if (e.code === 'KeyI' && !e.repeat) this.toggleDebugInvulnerability();
      if (e.code === 'KeyB' && !e.repeat) this.debugStartBossEncounter();
      if (e.code === 'KeyO' && !e.repeat) this.toggleDebugCollisionView();
    });

    window.addEventListener('keyup', (e) => {

      if (this.paused) {
        this.keys[e.code] = false;
        return;
      }

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
  },

  isLaserControlHeld() {
    return Boolean(this.keys.ControlLeft || this.keys.ControlRight);
  }
});