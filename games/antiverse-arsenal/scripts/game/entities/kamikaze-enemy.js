// Fast, unarmed ship that suicides into player, resulting explosion hurts...
class KamikazeEnemy extends Enemy {
  constructor(game, universe, x, y) {
    super(game, universe, x, y, {
      enemyType: 'kamikaze',
      maxHp: 3,
      radius: 13,
      accel: 260,
      accelPerRound: 7,
      maxSpeed: 320,
      maxSpeedPerRound: 8,
      aimResponsiveness: 18 / 2,
      maxRoll: 0.62,
      avoidanceSkill: 0.16,
      avoidanceLookAhead: 0.5,
      leavesDebris: false,
      sprite: pixelArt.enemyKamikaze,
      spritePixelScale: 2
    });

    this.detonated = false;
    this.chargeResponsiveness = 2;
  }

  // Kamikazes never fire, their only attack is contact and the resulting blast...
  updateWeapon() { }

  // Continuously steer toward the player's short-term trajectory to make a deliberate impact...
  steerTowardPlayer(dt) {
    const player = this.game.player;

    if (player.universe !== this.universe) {
      super.steerTowardPlayer(dt);
      return;
    }

    const distance = Math.hypot(player.x - this.x, player.y - this.y);
    const leadTime = clamp(distance / Math.max(1, this.maxSpeed), 0, 0.38);
    const targetX = player.x + player.velX * leadTime;
    const targetY = player.y + player.velY * leadTime;
    const direction = normalizeVector(targetX - this.x, targetY - this.y);

    if (!direction) {
      return;
    }

    const targetAngle = Math.atan2(direction.y, direction.x);
    const turnResponse = 1 - Math.exp(-this.aimResponsiveness * dt);
    this.angle = lerpAngle(this.angle, targetAngle, turnResponse);
    const speed = this.maxSpeed + this.game.round * this.maxSpeedPerRound;
    const velocityResponse = 1 - Math.exp(-this.chargeResponsiveness * dt);
    this.velX += (direction.x * speed - this.velX) * velocityResponse;
    this.velY += (direction.y * speed - this.velY) * velocityResponse;
  }

  detonate() {
    if (this.detonated) {
      return;
    }

    this.detonated = true;
    this.applyBlastDamage();
    this.hp = 0;
    this.dead = true;
  }

  applyBlastDamage() {
    const blastRadius = KAMIKAZEE_BLAST_RADIUS;
    const player = this.game.player;
    let destroyedEnemy = false;

    if (player.universe === this.universe && !player.dashing) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= blastRadius + player.radius) {
        const force = Math.max(1, distance);
        player.takeDamage((dx / force) * 360, (dy / force) * 360, this.maxHp);
      }
    }

    for (const enemy of this.universe.enemies) {
      if (enemy === this || enemy.dead || enemy.expired) {
        continue;
      }

      const distance = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      
      if (distance > blastRadius + enemy.radius) {
        continue;
      }

      const wasAlive = !enemy.dead;
      enemy.takeDamage(this.maxHp, 1);

      if (wasAlive && enemy.dead) {
        destroyedEnemy = true;
      }
    }

    if (destroyedEnemy) {
      this.game.awardPoints(KAMIKAZEE_BLAST_BONUS_SCORE, 1, this.universe, this.x, this.y - 18, '#ff8a5c', formatText('message.collateral'));
    }
  }

  onDestroyed() {
    this.detonate();
    super.onDestroyed();
  }
}