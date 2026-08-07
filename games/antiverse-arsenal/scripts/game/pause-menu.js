// Pause menu and controls panel...
Object.assign(Game.prototype, {
  isPauseMenuOpen() {
    return !pauseOverlay.classList.contains('hidden');
  },

  isControlsPanelOpen() {
    return !controlsPanel.classList.contains('hidden');
  },

  showControlsPanel(returnTarget = document.activeElement) {
    const mainMenuOpen = !focusOverlay.classList.contains('hidden');
    if (!this.isPauseMenuOpen() && !mainMenuOpen) {
      return;
    }

    this.controlsReturnTarget = returnTarget instanceof HTMLElement ? returnTarget : null;
    controlsPanel.classList.remove('hidden');
    controlsCloseButton.focus();
  },

  hideControlsPanel() {
    if (!this.isControlsPanelOpen()) {
      return;
    }

    controlsPanel.classList.add('hidden');
    const returnTarget = this.controlsReturnTarget;
    this.controlsReturnTarget = null;

    if (returnTarget?.isConnected) {
      returnTarget.focus();
    }
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
    this.tunnelBackground?.pause();
    this.pauseMessageTimer();
    pauseOverlay.classList.remove('hidden');
    resumeButton.focus();
  },

  resumeGame() {
    if (!this.isPauseMenuOpen() || this.isControlsPanelOpen()) {
      return;
    }

    this.paused = false;
    this.tunnelBackground?.resume();
    this.clearAllInput();
    pauseOverlay.classList.add('hidden');
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
