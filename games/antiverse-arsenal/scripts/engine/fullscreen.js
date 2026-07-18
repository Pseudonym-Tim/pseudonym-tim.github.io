// Browser fullscreen lifecycle...
class FullscreenMode {
  constructor() {
    document.addEventListener('fullscreenchange', () => this.handleChange());
    document.addEventListener('webkitfullscreenchange', () => this.handleChange());
    this.updateBodyClass();
  }

  isActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  enter() {
    if (this.isActive()) {
      this.updateBodyClass();
      this.lockEscape();
      return Promise.resolve(true);
    }

    const root = document.documentElement;
    const requestFullscreen = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!requestFullscreen) {
      return Promise.resolve(false);
    }

    return Promise.resolve(requestFullscreen.call(root, { navigationUI: 'hide' }))
      .then(() => {
        this.updateBodyClass();
        this.lockEscape();
        return true;
      })
      .catch(() => false);
  }

  handleChange() {
    this.updateBodyClass();
    if (this.isActive()) {
      this.lockEscape();
    } else {
      this.unlockEscape();
    }
  }

  lockEscape() {
    if (!this.isActive() || !navigator.keyboard?.lock) {
      return;
    }

    navigator.keyboard.lock(['Escape']).catch(() => {});
  }

  unlockEscape() {
    navigator.keyboard?.unlock?.();
  }

  updateBodyClass() {
    document.body.classList.toggle('fullscreen-active', this.isActive());
  }
}