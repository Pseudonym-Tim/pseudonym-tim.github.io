// Asteroids...
class Asteroid extends Damageable {
  constructor(game, universe, x, y, size = 3) {
    const radius = size === 3 ? 34 : size === 2 ? 22 : 13;
    super(game, universe, x, y, radius);
    this.size = size;
    this.maxHp = this.size > 1 ? 5 : 3;
    this.hp = this.maxHp;
    this.seed = Math.random() * 999;
    this.sprite = this.randomSprite();
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(20, 62);
    this.velX = Math.cos(angle) * speed;
    this.velY = Math.sin(angle) * speed;
    this.spin = rand(-1.4, 1.4);
    this.rotation = rand(0, Math.PI * 2);
  }
  
  randomSprite() {
    const sprites = this.size > 1 ? pixelArt.asteroids?.big : pixelArt.asteroids?.small;
    return sprites[Math.floor(Math.random() * sprites.length)];
  }

  update(dt) {
    this.healthBarTimer = Math.max(0, this.healthBarTimer - dt);
    this.updateDamageFlash(dt);
    this.rotation += this.spin * dt;
    this.move(dt);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    drawPixelArt(ctx, this.sprite, this.radius * 2.25, {
      time: this.game.spriteClock,
      flashAlpha: this.getDamageFlashAlpha()
    });
    ctx.restore();
    this.drawHealthBar(ctx);
  }

  drawHealthBar(ctx) {
    if (this.healthBarTimer <= 0 || this.hp <= 0 || this.hp >= this.maxHp) return;

    const alpha = clamp(this.healthBarTimer / 0.55, 0, 1);
    const width = 32;
    const height = 5;
    const x = this.x - width / 2;
    const y = this.y - this.radius - 20;
    const fillWidth = width * clamp(this.hp / this.maxHp, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(3, 7, 18, 0.88)';
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = '#aefcff';
    ctx.fillRect(x, y, fillWidth, height);
    ctx.strokeStyle = 'rgba(225, 250, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
    ctx.restore();
  }
}