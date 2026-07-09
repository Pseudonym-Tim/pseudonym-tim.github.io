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
    ctx.font = '16px "Lucida Console", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    ctx.fillStyle = this.color;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }

  universesIncludes() {
    return this.game.universes.includes(this.universe);
  }
}