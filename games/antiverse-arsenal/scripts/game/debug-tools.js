// Debug tools...
Object.assign(Game.prototype, {
  debugNextRound() {
    if (!this.running || this.roundEnding) {
      return;
    }

    for (const universe of this.universes) {
      for (const enemy of universe.enemies) {
        if (!enemy.dead) {
          enemy.dead = true;
          this.clearEnemyThreat(enemy);
        }
      }

      universe.enemies = [];
    }

    this.incursionQueue = [];
    this.incursionDeploying = false;
    this.encounterActive = true;
    this.roundPendingThreat = 0;
    this.roundIncursionDeployed = this.roundIncursionTotal;
    this.roundThreatTotal = Math.max(1, this.roundThreatTotal);
    this.roundThreatCleared = this.roundThreatTotal;
    this.stability = 100;
    this.flashMessage(formatText('message.debugNextRound'), 550);
    this.endRound();
  },

  debugKillAllEnemies() {
    if (!this.running) {
      return;
    }

    let killed = 0;

    for (const universe of this.universes) {
      for (const enemy of universe.enemies) {
        if (!enemy.dead) {
          enemy.killMultiplier = Math.max(1, enemy.killMultiplier || 1);
          enemy.dead = true;
          enemy.onDestroyed();
          killed += 1;
        }
      }

      universe.enemies = [];
    }

    this.flashMessage(formatText('message.debugKilledEnemies', { count: killed }), 650);
  },

  debugStartBossEncounter() {
    if (!this.running || this.bossActive || this.bossPending) {
      return;
    }

    const universe = this.player?.universe || this.universes[0];

    if (!universe) {
      return;
    }

    this.round = BOSS_ROUND;
    this.bossDefeated = false;
    this.roundEnding = false;
    this.roundGraceActive = false;
    this.encounterActive = true;
    this.encounterClearTimer = 0;
    this.incursionQueue = [];
    this.incursionDeploying = false;
    this.pendingEnemySpawns = [];
    this.roundPendingThreat = 0;
    this.roundIncursionTotal = 1;
    this.roundIncursionDeployed = 1;

    this.roundThreatTotal = 0;
    this.roundThreatCleared = 0;
    this.flashMessage('DEBUG: Boss test encounter', 700);
    this.startBossEncounter();
    this.updateHUD();
  },

  toggleDebugCollisionView() {
    if (!this.running) {
      return;
    }

    this.debugShowCollisions = !this.debugShowCollisions;
    this.flashMessage(`DEBUG: Collision view ${this.debugShowCollisions ? 'ON' : 'OFF'}`, 700);
  },

  debugGiveSniperPowerup() {
    if (!this.running) {
      return;
    }

    const alreadyInstalled = this.hasPowerup('sniper');

    if (!alreadyInstalled) {
      this.applyPowerup('sniper');
    }

    const state = alreadyInstalled ? formatText('message.debugOn') : formatText('message.powerupInstalled', { name: formatText('powerups.sniper.name') });
    this.flashMessage(formatText('message.debugSniperPowerup', { state }), 750);
  },

  drawCollisionDebug() {
    if (!this.debugShowCollisions) {
      return;
    }

    for (const universe of this.universes) {
      const ctx = universe.ctx;
      ctx.save();
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      const drawEntityShape = (entity) => {
        if (!entity || entity.dead || entity.expired || entity.universe !== universe) {
          return;
        }

        this.drawCollisionShape(ctx, entityCollisionShape(entity));
      };

      if (this.player?.universe === universe) {
        drawEntityShape(this.player);
      }

      for (const asteroid of universe.asteroids) {
        drawEntityShape(asteroid);
      }

      for (const pickup of universe.hullPickups) {
        drawEntityShape(pickup);
      }

      for (const enemy of universe.enemies) {
        drawEntityShape(enemy);

        if (enemy.getPartCollisionShape && enemy.parts) {
          for (const part of enemy.parts) {
            if (!part.destroyed) {
              this.drawCollisionShape(ctx, enemy.getPartCollisionShape(part));
            }
          }
        }
      }

      for (const bullet of this.bullets) {
        drawEntityShape(bullet);
      }

      ctx.restore();
    }
  },

  drawCollisionShape(ctx, shape) {
    if (!shape) {
      return;
    }

    if (Array.isArray(shape)) {
      for (const item of shape) {
        this.drawCollisionShape(ctx, item);
      }

      return;
    }

    ctx.beginPath();

    if (shape.type === 'box') {
      ctx.rect(shape.x, shape.y, shape.w, shape.h);
    } else if (shape.type === 'circle') {
      ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
    }

    ctx.stroke();
  },

  toggleDebugInvulnerability() {
    if (!this.running) {
      return;
    }

    this.debugInvulnerable = !this.debugInvulnerable;

    if (this.debugInvulnerable) {
      this.invulnerable = false;
      this.player.damageFlashTimer = 0;
    }

    this.flashMessage(formatText('message.debugInvulnerability', { state: formatText(this.debugInvulnerable ? 'message.debugOn' : 'message.debugOff') }), 750);
    this.updateHUD();
  }
});