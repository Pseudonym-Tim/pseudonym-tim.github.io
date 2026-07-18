// Fullscreen controls...
Object.assign(Game.prototype, {
  initFullscreenMode() {
    this.fullscreenMode = new FullscreenMode();
    this.enterFullscreenMode = () => this.fullscreenMode.enter();
  },

  isFullscreenActive() {
    return this.fullscreenMode.isActive();
  },

  lockFullscreenEscape() {
    this.fullscreenMode.lockEscape();
  },

  unlockFullscreenEscape() {
    this.fullscreenMode.unlockEscape();
  },

  updateFullscreenClass() {
    this.fullscreenMode.updateBodyClass();
  }
});