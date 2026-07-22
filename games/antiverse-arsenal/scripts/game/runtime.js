// Frame loop, update, and draw orchestration...
Object.assign(Game.prototype, {
  triggerHitStop(stopSeconds = 0.035, slowSeconds = 0.16, slowScale = 0.35) {
    if (!this.running) {
      return;
    }

    this.hitStopTimer = Math.max(this.hitStopTimer, stopSeconds);
    this.hitSlowTimer = Math.max(this.hitSlowTimer, slowSeconds);
    this.hitSlowScale = Math.min(this.hitSlowTimer > 0 ? this.hitSlowScale : 1, slowScale);
  },

  loop(timestamp, loopToken = this.loopToken) {
    if (!this.running || loopToken !== this.loopToken) {
      return;
    }

    const rawDt = Math.min(0.05, (timestamp - this.lastTime) / 1000 || 0);
    this.lastTime = timestamp;

    if (this.paused) {
      this.updateHUD();
      this.draw();
      requestAnimationFrame((t) => this.loop(t, loopToken));
      return;
    }

    // Window manipulation is a true pause, so...
    // Skip every gameplay update, including firing, cooldowns, collisions, spawning, projectiles, effects, etc...
    if (this.draggingUniverse) {
      this.updateDragTilt(rawDt);
      this.updateHUD();
      this.draw();
      requestAnimationFrame((t) => this.loop(t, loopToken));
      return;
    }

    const hitStopped = this.hitStopTimer > 0;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - rawDt);
    } else if (this.hitSlowTimer > 0) {
      this.hitSlowTimer = Math.max(0, this.hitSlowTimer - rawDt);
      
      if (this.hitSlowTimer <= 0) {
        this.hitSlowScale = 1;
      }
    }

    this.updateLaser(rawDt);
    const temporalScale = hitStopped ? 0 : this.timeScale * (this.hitSlowTimer > 0 ? this.hitSlowScale : 1);
    const playerDt = rawDt * temporalScale;
    this.update(playerDt, playerDt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t, loopToken));
  },

  update(playerDt, worldDt = playerDt) {
    if (this.isShopOpen() || this.isMultiverseCompleteOpen() || this.transitioning) {
      this.updateHUD();
      return;
    }

    // Player and world share the same clock, so window dragging still freezes both...
    this.spriteClock += worldDt;
    this.updatePendingEnemySpawns(worldDt);
    this.updateSpawnCountdown(worldDt);
    this.player.update(playerDt);

    for (const u of this.universes) {
      u.update(worldDt);
    }

    this.updateOrbitals(playerDt);

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update(bullet.owner === 'player' ? playerDt : worldDt);

      if (bullet.dead) {
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const text = this.floatingTexts[i];
      text.update(worldDt);
      
      if (text.dead) {
        this.floatingTexts.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.update(worldDt);

      if (explosion.dead) {
        this.explosions.splice(i, 1);
      }
    }

    this.checkPlayerCollisions();
    this.updateHUD();
  },

  // Main game runtime draw update...
  draw() {
    for (const u of this.universes) {
      u.draw();
    }

    if (ENABLE_BULLET_WRAP_WARNING) {
      for (const bullet of this.bullets) {
        bullet.drawWrapWarning();
      }
    }

    for (const bullet of this.bullets) {
      bullet.draw();
    }

    this.drawLaserPlan(this.laserAim);
    this.drawLaserFlashes();
    this.player.draw(this.player.universe.ctx);

    for (const orbital of this.orbitals) {
      orbital.draw();
    }

    for (const explosion of this.explosions) {
      explosion.draw();
    }

    this.drawCollisionDebug();

    for (const text of this.floatingTexts) {
      text.draw();
    }
  }
});