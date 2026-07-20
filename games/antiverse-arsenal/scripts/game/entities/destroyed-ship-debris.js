// A non-interactive, destroyed ship husk that leaves the universe instead of wrapping...
class DestroyedShipDebris {
  constructor(game, universe, source, options = {}) {
    this.game = game;
    this.universe = universe;
    this.x = source.x;
    this.y = source.y;
    this.radius = source.radius;

    // Snapshot the rendered ship orientation before its randomized spin begins...
    this.rotation = options.initialRotation ?? source.angle ?? 0;
    this.sprite = options.sprite ?? source.sprite;
    this.spriteScale = options.spriteScale ?? source.spriteScale ?? 1;
    this.isBoss = options.isBoss ?? false;

    const direction = Math.random() * Math.PI * 2;
    const speed = rand(135, 255);
    this.velX = Math.cos(direction) * speed;
    this.velY = Math.sin(direction) * speed;
    this.rotationVelocity = rand(-5.4, 5.4);
    this.dead = false;
  }

  update(dt) {
    this.x += this.velX * dt;
    this.y += this.velY * dt;
    this.rotation += this.rotationVelocity * dt;

    // Debris never collides, travels to another universe, or wraps back into view...
    this.dead = this.x < -this.radius || this.x > this.universe.width + this.radius || this.y < -this.radius || this.y > this.universe.height + this.radius;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.filter = 'brightness(0.25)'; // TODO: Use actual proper unique destroyed ship GFX instead!

    // HACK!!! Please don't do hardcoded draw width/height and radius stuff here...
    if (this.isBoss) {
      const drawWidth = 384 * this.spriteScale;
      const drawHeight = 264 * this.spriteScale;
      drawPixelArtFrame(ctx, this.sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight, { time: 0 });
    } else {
      drawPixelArt(ctx, this.sprite, this.radius * 3.1, { time: 0, scale: this.spriteScale });
    }

    ctx.restore();
  }
}