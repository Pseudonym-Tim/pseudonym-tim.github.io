// Defensive orbs that orbit the player's ship...
class ShipOrbital {
  constructor(game, phase) {
    this.game = game;
    this.phase = phase;
    this.radius = ORBITAL_RADIUS;
    this.x = 0;
    this.y = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetVelX = 0;
    this.offsetVelY = 0;
  }

  update(dt) {
    this.phase = (this.phase + ORBITAL_ORBIT_SPEED * dt) % (Math.PI * 2);
    this.offsetVelX += -this.offsetX * ORBITAL_SPRING_STRENGTH * dt;
    this.offsetVelY += -this.offsetY * ORBITAL_SPRING_STRENGTH * dt;
    const damping = Math.exp(-ORBITAL_SPRING_DAMPING * dt);
    this.offsetVelX *= damping;
    this.offsetVelY *= damping;
    this.offsetX += this.offsetVelX * dt;
    this.offsetY += this.offsetVelY * dt;

    const displacement = Math.hypot(this.offsetX, this.offsetY);
    if (displacement > ORBITAL_MAX_DISPLACEMENT) {
      const scale = ORBITAL_MAX_DISPLACEMENT / displacement;
      this.offsetX *= scale;
      this.offsetY *= scale;
    }

    this.updatePosition();
  }

  updatePosition() {
    const player = this.game.player;
    this.x = player.x + Math.cos(this.phase) * ORBITAL_ORBIT_RADIUS + this.offsetX;
    this.y = player.y + Math.sin(this.phase) * ORBITAL_ORBIT_RADIUS + this.offsetY;
  }

  getCollisionShape() {
    return circleCollisionShape(this.x, this.y, this.radius);
  }

  blocks(entity) {
    return collisionShapesOverlap(this.getCollisionShape(), entityCollisionShape(entity));
  }

  absorbImpact(normalX, normalY) {
    this.offsetVelX -= normalX * ORBITAL_BOUNCE_SPEED;
    this.offsetVelY -= normalY * ORBITAL_BOUNCE_SPEED;
  }

  draw() {
    const ctx = this.game.player.universe.ctx;
    ctx.save();
    ctx.translate(pixelSnap(this.x), pixelSnap(this.y));
    drawPixelArt(ctx, pixelArt.orbital, { pixelScale: 2 });
    ctx.restore();
  }
}