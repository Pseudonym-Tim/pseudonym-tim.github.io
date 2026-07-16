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
    this.game.sound.play('hullPickup');
    const restored = MAX_PLAYER_HULL - this.game.hp;
    this.game.hp = MAX_PLAYER_HULL;
    this.game.addFloatingText(this.universe, this.x, this.y - 20, formatText('float.fullRepair', { amount: restored }), '#72f7ff');
    this.game.flashMessage(formatText('message.hullRestored'), 750);
    return true;
  }

  draw(ctx) {
    const pulse = 0.2 + Math.sin(this.age * 3) * 0.3;

    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.globalCompositeOperation = 'lighter';

    const glowRadius = this.radius + 13 + pulse * 7;
    
    const gradient = ctx.createRadialGradient(
      0, 0, this.radius * 0.25,
      0, 0, glowRadius
    );

    gradient.addColorStop(
      0,
      `rgba(180, 255, 255, ${0.65 + pulse * 0.2})`
    );
    gradient.addColorStop(
      0.35,
      `rgba(114, 247, 255, ${0.4 + pulse * 0.2})`
    );

    gradient.addColorStop(
      0.7,
      `rgba(60, 210, 255, ${0.18 + pulse * 0.12})`
    );

    gradient.addColorStop(1, 'rgba(60, 210, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    drawPixelArt(ctx, pixelArt.hullPickup, this.radius * 2, { time: this.game.spriteClock });

    ctx.restore();
  }
}