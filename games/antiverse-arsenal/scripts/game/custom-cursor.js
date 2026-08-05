// Hardware cursor replacement and shake-charge feedback...
Object.assign(Game.prototype, {
  initCustomCursor() {
    this.customCursor = document.getElementById('custom-cursor');
    this.cursorShakeRatio = 0;

    if (!this.customCursor) {
      return;
    }

    this.customCursor.classList.add('visible');
    this.updateCustomCursorPosition(this.mouseX, this.mouseY);
    this.renderCustomCursorCharge();
  },

  updateCustomCursorPosition(x, y) {
    if (!this.customCursor) {
      return;
    }

    this.customCursor.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  },

  updateCustomCursorTarget(target) {
    if (!this.customCursor) {
      return;
    }

    const element = target instanceof Element ? target : null;
    const universeElement = element?.closest('.universe') || null;
    const interactive = Boolean(element?.closest('button, [role="button"], .powerup-card'));
    const locked = Boolean(universeElement?.classList.contains('shake-locked'));
    this.customCursor.classList.toggle('interactive', interactive);
    this.customCursor.classList.toggle('locked', locked);
    this.renderCustomCursorCharge();
  },

  setCustomCursorPressed(pressed) {
    this.customCursor?.classList.toggle('pressed', Boolean(pressed));
  },

  setCursorShakeRatio(ratio) {
    this.cursorShakeRatio = clamp(Number(ratio) || 0, 0, 1);
    this.renderCustomCursorCharge();
  },

  renderCustomCursorCharge() {
    if (!this.customCursor) {
      return;
    }

    const ratio = clamp(this.cursorShakeRatio || 0, 0, 1);
    const red = Math.round(205 + 50 * ratio);
    const green = Math.round(222 - 190 * ratio);
    const blue = Math.round(230 - 176 * ratio);
    const glow = 2 + ratio * 13;
    const length = 8 + ratio * 5;
    const thickness = 2 + ratio * 0.5;
    const gap = 4 + ratio * 1.5;
    const opacity = 0.78 + ratio * 0.22;

    this.customCursor.style.setProperty('--cursor-charge', ratio.toFixed(3));
    this.customCursor.style.setProperty('--cursor-color', `rgb(${red}, ${green}, ${blue})`);
    this.customCursor.style.setProperty('--cursor-glow', `${glow.toFixed(1)}px`);
    this.customCursor.style.setProperty('--cursor-length', `${length.toFixed(1)}px`);
    this.customCursor.style.setProperty('--cursor-thickness', `${thickness.toFixed(1)}px`);
    this.customCursor.style.setProperty('--cursor-gap', `${gap.toFixed(1)}px`);
    this.customCursor.style.setProperty('--cursor-opacity', opacity.toFixed(3));
  },

  flashCustomCursorImpact() {
    if (!this.customCursor) {
      return;
    }

    clearTimeout(this.cursorImpactTimeout);
    this.customCursor.classList.remove('impact');
    void this.customCursor.offsetWidth;
    this.customCursor.classList.add('impact');
    this.cursorImpactTimeout = setTimeout(() => {
      this.customCursor?.classList.remove('impact');
      this.cursorImpactTimeout = null;
    }, 360);
  },

  refreshCustomCursorTarget() {
    if (typeof document.elementFromPoint !== 'function') {
      return;
    }

    this.updateCustomCursorTarget(document.elementFromPoint(this.mouseX, this.mouseY));
  }
});
