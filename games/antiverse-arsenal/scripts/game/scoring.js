// Scoring...
Object.assign(Game.prototype, {
  resizeFloatingTextOverlay(force = false) {
    const canvas = this.floatingTextCanvas;
    const ctx = this.floatingTextCtx;
    if (!canvas || !ctx) {
      return;
    }

    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(window.innerWidth * pixelRatio));
    const height = Math.max(1, Math.round(window.innerHeight * pixelRatio));

    if (force || canvas.width !== width || canvas.height !== height || this.floatingTextPixelRatio !== pixelRatio) {
      canvas.width = width;
      canvas.height = height;
      this.floatingTextPixelRatio = pixelRatio;
    }

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = false;
  },

  clearFloatingTextOverlay() {
    const ctx = this.floatingTextCtx;
    if (!ctx) {
      return;
    }

    this.resizeFloatingTextOverlay();
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  },

  awardPoints(basePoints, multiplier, universe, x, y, color = '#ffd25c', label = '') {
    const mult = Math.max(1, multiplier || 1);
    const gained = Math.round(basePoints * mult);
    this.score += gained;
    const amountText = mult > 1 ? `+${basePoints}x${formatMultiplier(mult)}` : `+${gained}`;
    const text = label ? `${label} ${amountText}` : amountText;
    this.addFloatingText(universe, x, y, text, color);
  },

  triggerKillFeedback() {
    this.tunnelBackground?.pulseOnKill();
  },

  addFloatingText(universe, x, y, text, color = '#ffd25c') {
    if (!universe) {
      return;
    }

    const floatingText = new FloatingText(this, universe, x, y, text, color);
    floatingText.avoidOverlaps(this.floatingTexts);
    this.floatingTexts.push(floatingText);
  }
});