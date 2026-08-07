class FloatingText {
  constructor(game, universe, x, y, text, color = '#ffd25c') {
    this.game = game;
    this.universe = universe;
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.age = 0;
    this.life = 1.05;
    this.velX = rand(-10, 10);
    this.velY = rand(-44, -30);
    this.dead = false;
  }

  update(dt) {
    this.age += dt;
    this.x += this.velX * dt;
    this.y += this.velY * dt;
    this.velY += 16 * dt;
    if (this.age >= this.life) {
      this.dead = true;
    }
  }

  draw() {
    if (!this.universe || !this.universesIncludes()) {
      return;
    }

    const ctx = this.game.floatingTextCtx;
    if (!ctx) {
      return;
    }

    const t = clamp(this.age / this.life, 0, 1);
    const screenPosition = this.getScreenPosition();
    const scale = this.universe.scale || 1;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    const textX = Math.round(screenPosition.x);
    const textY = Math.round(screenPosition.y);
    ctx.font = `${FloatingText.FONT_SIZE * scale}px "Press Start 2P", "Lucida Console", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(this.text, textX - 2 * scale, textY + 2 * scale);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, textX, textY);
    ctx.restore();
  }

  getBounds(x = this.x, y = this.y) {
    const scale = this.universe?.scale || 1;
    const screenPosition = this.getScreenPosition(x, y);
    const width = this.measureWidth() * scale;
    const height = FloatingText.FONT_SIZE * scale;
    return {
      left: screenPosition.x - width / 2,
      right: screenPosition.x + width / 2,
      top: screenPosition.y - height / 2,
      bottom: screenPosition.y + height / 2
    };
  }

  getScreenPosition(x = this.x, y = this.y) {
    return this.universe.localToWorld(x, y);
  }

  measureWidth() {
    const ctx = this.universe?.ctx;
    if (!ctx) {
      return this.text.length * FloatingText.FONT_SIZE;
    }

    ctx.save();
    ctx.font = `${FloatingText.FONT_SIZE}px "Press Start 2P", "Lucida Console", monospace`;
    const width = ctx.measureText(this.text).width;
    ctx.restore();
    return width;
  }

  overlaps(other, x = this.x, y = this.y) {
    const a = this.getBounds(x, y);
    const b = other.getBounds();
    const padding = FloatingText.OVERLAP_PADDING;
    return a.left - padding < b.right && a.right + padding > b.left && a.top - padding < b.bottom && a.bottom + padding > b.top;
  }

  avoidOverlaps(existingTexts) {
    const nearbyTexts = existingTexts.filter((text) => !text.dead && text.universe && text.universesIncludes());
    if (!nearbyTexts.length) {
      return;
    }

    const originalY = this.y;
    const step = FloatingText.FONT_SIZE + FloatingText.OVERLAP_PADDING;

    for (let attempt = 0; attempt < FloatingText.MAX_OVERLAP_ATTEMPTS; attempt++) {
      const direction = attempt % 2 === 0 ? -1 : 1;
      const distance = Math.ceil((attempt + 1) / 2) * step;
      const candidateY = originalY + direction * distance;

      if (!nearbyTexts.some((text) => this.overlaps(text, this.x, candidateY))) {
        this.y = candidateY;
        return;
      }
    }

    this.y = originalY - FloatingText.MAX_OVERLAP_ATTEMPTS * step;
  }

  universesIncludes() {
    return this.game.universes.includes(this.universe);
  }
}

// Whatever, fuck globals.js we'll do this...
FloatingText.FONT_SIZE = 16;
FloatingText.OVERLAP_PADDING = 4;
FloatingText.MAX_OVERLAP_ATTEMPTS = 8;