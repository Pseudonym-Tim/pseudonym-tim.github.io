// HUD...
Object.assign(Game.prototype, {
  updateHUD() {
    for (const universe of this.universes) {
      universe.element.classList.toggle('player-universe', universe === this.player?.universe);
    }

    const hullRatio = clamp(this.hp / this.maxHull, 0, 1);
    hullValue.textContent = `${this.hp}/${this.maxHull}`;

    if (hullGaugeNeedle) {
      hullGaugeNeedle.style.transform = `translateX(-50%) rotate(${-90 + hullRatio * 180}deg)`;
    }

    stabilityValue.textContent = formatText('hud.stability', { value: `${Math.floor(this.stability)}%` });
    roundValue.textContent = formatText('hud.round', { value: this.round });
    multiverseValue.textContent = formatText('hud.multiverse', { value: this.multiverse });
    scoreValue.textContent = formatText('hud.score', { value: Math.floor(this.score) });
    highscoreValue.textContent = formatText('hud.highscore', { value: Math.floor(this.highscore) });

    if (incursionValue) {
      const deployed = Math.min(this.roundIncursionDeployed, this.roundIncursionTotal);
      incursionValue.textContent = formatText('hud.incursions', { value: this.roundIncursionTotal > 0 ? `${deployed}/${this.roundIncursionTotal}` : formatText('status.none') });
    }

    if (playerHud) {
      if (this.player?.universe) {
        if (playerHud.parentElement !== this.player.universe.element) {
          this.player.universe.element.appendChild(playerHud);
        }

        playerHud.style.visibility = 'visible';
      } else {
        playerHud.style.visibility = 'hidden';
      }
    }

    const setAbilityCooldown = (element, label, cooldown, maxCooldown, activeLabel = null) => {
      const ready = cooldown <= 0 && !activeLabel;
      const ratio = activeLabel ? 1 : 1 - clamp(cooldown / maxCooldown, 0, 1);

      if (element) {
        element.style.setProperty('--cooldown-ratio', ratio.toFixed(3));
        element.dataset.ready = String(ready);
      }

      if (label) {
        label.textContent = activeLabel || (ready ? formatText('status.ready') : `${cooldown.toFixed(1)}s`);
      }
    };

    const warp = this.player ? this.player.warpCooldown : 0;
    setAbilityCooldown(warpCooldown, warpValue, warp, 3.5);

    const dashTime = this.player ? this.player.dashCooldown : 0;
    setAbilityCooldown(dashCooldown, dashValue, dashTime, DASH_COOLDOWN, this.player?.dashing ? formatText('status.dashing') : null);

    const laserTime = this.laserCooldown || 0;
    setAbilityCooldown(laserCooldown, laserValue, laserTime, LASER_COOLDOWN, this.laserCharging ? formatText('status.locking') : null);
  }
});