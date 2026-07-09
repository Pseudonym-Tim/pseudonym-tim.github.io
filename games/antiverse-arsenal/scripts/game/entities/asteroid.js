// Asteroids...
class Asteroid extends Damageable {
  constructor(game, universe, x, y, size = 3) {
    const radius = size === 3 ? 34 : size === 2 ? 22 : 13;
    super(game, universe, x, y, radius);
    this.size = size;
    this.hp = 1;
    this.seed = Math.random() * 999;
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(20, 62);
    this.velX = Math.cos(angle) * speed;
    this.velY = Math.sin(angle) * speed;
    this.spin = rand(-1.4, 1.4);
    this.rotation = rand(0, Math.PI * 2);
  }

  update(dt) {
    this.rotation += this.spin * dt;
    this.move(dt);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    drawPixelArt(ctx, pixelArt.asteroid, this.radius * 2.25, { time: this.game.spriteClock });
    ctx.restore();
  }
}