// Particle burst used to highlight player warp departures and arrivals...
class WarpParticleFX {
  constructor(game, universe, x, y, options = {}) {
    this.game = game;
    this.universe = universe;
    this.x = x;
    this.y = y;
    this.life = options.life ?? 0.58;
    this.age = 0;
    this.dead = false;
    this.radius = options.radius ?? 30;
    this.particles = [];
    const count = options.count ?? 34;
    const direction = normalizeVector(options.dirX ?? 0, options.dirY ?? 0);

    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(55, 190);
      const directionalBoost = direction ? rand(30, 95) : 0;
      const size = rand(1.4, 3.8);

      this.particles.push({
        x: Math.cos(angle) * rand(0, this.radius * 0.22),
        y: Math.sin(angle) * rand(0, this.radius * 0.22),
        size,
        velX: Math.cos(angle) * speed + (direction?.x || 0) * directionalBoost,
        velY: Math.sin(angle) * speed + (direction?.y || 0) * directionalBoost,
        twinkle: rand(0.75, 1.25),
        alpha: rand(0.72, 1)
      });
    }
  }

  update(dt) {
    this.age += dt;

    for (const particle of this.particles) {
      particle.x += particle.velX * dt;
      particle.y += particle.velY * dt;
    }

    if (this.age >= this.life) this.dead = true;
  }

  draw() {
    if (!this.universe || !this.game.universes.includes(this.universe)) return;

    const ctx = this.universe.ctx;
    const t = clamp(this.age / this.life, 0, 1);
    const fade = (1 - t) * (1 - t);
    const ringRadius = this.radius * (0.45 + t * 1.35);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';

    ctx.globalAlpha = 0.5 * fade;
    ctx.strokeStyle = '#56c8ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.25 * fade;
    ctx.fillStyle = '#168dff';
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    for (const particle of this.particles) {
      const px = particle.x;
      const py = particle.y;
      const size = particle.size * (0.45 + fade * 0.9) * particle.twinkle;

      ctx.globalAlpha = fade * particle.alpha;
      ctx.fillStyle = '#8ee8ff';
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = fade * 0.38;
      ctx.strokeStyle = '#1b77ff';
      ctx.lineWidth = Math.max(1, size * 0.55);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - particle.velX * 0.035, py - particle.velY * 0.035);
      ctx.stroke();
    }

    ctx.restore();
  }
}