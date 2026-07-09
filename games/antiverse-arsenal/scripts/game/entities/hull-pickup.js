// Hull pickup that restores ship integrity...
class HullPickup {
  constructor(game, universe, x, y) {
    this.game = game;
    this.universe = universe;
    this.x = x;
    this.y = y;
    this.radius = 15;
    this.age = Math.random() * Math.PI * 2;
    this.collected = false;
  }

  update(dt) {
    this.age += dt;
  }

  collect() {
    if (this.collected || this.game.hp >= MAX_PLAYER_HULL) return false;
    this.collected = true;
    const restored = MAX_PLAYER_HULL - this.game.hp;
    this.game.hp = MAX_PLAYER_HULL;
    this.game.addFloatingText(this.universe, this.x, this.y - 20, formatText('float.fullRepair', { amount: restored }), '#72f7ff');
    this.game.flashMessage(formatText('message.hullRestored'), 750);
    return true;
  }

  draw(ctx) {
    const pulse = 1 + Math.sin(this.age * 3.5) * 0.08;
    const glow = 0.55 + Math.sin(this.age * 2.7) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.globalAlpha = 0.2 + glow * 0.22;
    ctx.fillStyle = '#72f7ff';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.scale(pulse, pulse);
    drawPixelArt(ctx, pixelArt.hullPickup, this.radius * 2.0, { time: this.game.spriteClock });
    ctx.restore();
  }
}