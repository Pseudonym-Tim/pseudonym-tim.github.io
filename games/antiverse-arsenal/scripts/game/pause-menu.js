// Pause menu...
Object.assign(Game.prototype, {
  isPauseMenuOpen() {
    return !pauseOverlay.classList.contains('hidden');
  },

  isControlsPanelOpen() {
    return !controlsPanel.classList.contains('hidden');
  },

  showControlsPanel() {
    if (!this.isPauseMenuOpen()) {
      return;
    }

    controlsPanel.classList.remove('hidden');
  },

  hideControlsPanel() {
    controlsPanel.classList.add('hidden');
  },

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
  },

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
  },

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
});