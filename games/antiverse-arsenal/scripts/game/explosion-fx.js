// One-shot explosion sprite effect...
class ExplosionFX {
  constructor(game, universe, x, y, options = {}) {
    this.game = game;
    this.universe = universe;
    this.x = x;
    this.y = y;
    this.size = options.size ?? 58;
    this.life = options.life ?? 0.5;
    this.age = 0;
    this.dead = false;
    this.rotation = options.rotation ?? rand(0, Math.PI * 2);
    this.velX = options.velX ?? 0;
    this.velY = options.velY ?? 0;
  }

  update(dt) {
    this.age += dt;
    this.x += this.velX * dt;
    this.y += this.velY * dt;
    if (this.age >= this.life) this.dead = true;
  }

  draw() {
    if (!this.universe || !this.game.universes.includes(this.universe)) return;

    const ctx = this.universe.ctx;
    const t = clamp(this.age / this.life, 0, 1);
    const scale = 0.75 + t * 0.45;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalCompositeOperation = 'lighter';
    drawPixelArt(ctx, pixelArt.explosionFX, this.size, {
      time: this.age,
      scale,
      alpha: 1 - Math.max(0, t - 0.72) / 0.28,
      animation: 'explode'
    });
    ctx.restore();
  }
}