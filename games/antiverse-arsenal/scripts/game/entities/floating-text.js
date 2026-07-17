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

    const ctx = this.universe.ctx;
    const t = clamp(this.age / this.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    const textX = Math.round(this.x);
    const textY = Math.round(this.y);
    ctx.font = `${FloatingText.FONT_SIZE}px "Press Start 2P", "Lucida Console", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(this.text, textX - 2, textY + 2);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, textX, textY);
    ctx.restore();
  }

  getBounds(x = this.x, y = this.y) {
    const width = this.measureWidth();
    const height = FloatingText.FONT_SIZE;
    return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
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
    const nearbyTexts = existingTexts.filter((text) => text.universe === this.universe && !text.dead);
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