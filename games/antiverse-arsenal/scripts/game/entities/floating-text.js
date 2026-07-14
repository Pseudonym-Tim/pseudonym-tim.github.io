// Floating in-universe combat text...
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
    if (this.age >= this.life) this.dead = true;
  }

  draw() {
    if (!this.universe || !this.universesIncludes()) return;
    const ctx = this.universe.ctx;
    const t = clamp(this.age / this.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    const textX = Math.round(this.x);
    const textY = Math.round(this.y);
    ctx.font = '16px "Press Start 2P", "Lucida Console", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(this.text, textX - 2, textY + 2);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, textX, textY);
    ctx.restore();
  }

  universesIncludes() {
    return this.game.universes.includes(this.universe);
  }
}