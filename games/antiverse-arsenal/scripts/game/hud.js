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
    moneyValue.textContent = formatText('hud.money', { value: Math.floor(this.money) });

    if (encounterTimeline) {
      // Keep the timeline on shop throughout the
      // checkpoint (including the transition into/out of the overlay), and do
      // not mark boss as current until its summon sequence has really begun...
      const atShopCheckpoint = this.round === BOSS_ROUND && this.lastCompletedRound === SHOP_ROUND && !this.bossPending && !this.bossActive && !this.bossDefeated;
      const bossEncounterStarted = this.round === BOSS_ROUND && (this.bossPending || this.bossActive || this.bossDefeated);

      for (const event of encounterTimeline.children) {
        const eventSector = Number(event.dataset.sector || event.dataset.afterSector);
        const isShopEvent = Boolean(event.dataset.afterSector);
        const isBossEvent = event.dataset.kind === 'boss';
        const isCurrent = isShopEvent ? atShopCheckpoint && eventSector === SHOP_ROUND : isBossEvent ? bossEncounterStarted && eventSector === this.round : eventSector === this.round;
        event.classList.toggle('current', isCurrent);
        event.classList.toggle('past', eventSector < this.round && !isCurrent);
      }
    }

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

    const setAbilityCooldown = (element, cooldown, maxCooldown, active = false) => {
      const ready = cooldown <= 0 && !active;
      const ratio = active ? 1 : 1 - clamp(cooldown / maxCooldown, 0, 1);

      if (element) {
        element.style.setProperty('--cooldown-ratio', ratio.toFixed(3));
        element.dataset.ready = String(ready);
      }
    };

    const warp = this.player ? this.player.warpCooldown : 0;
    setAbilityCooldown(warpCooldown, warp, 3.5);

    const dashTime = this.player ? this.player.dashCooldown : 0;
    setAbilityCooldown(dashCooldown, dashTime, DASH_COOLDOWN, Boolean(this.player?.dashing));

    const laserTime = this.laserCooldown || 0;
    setAbilityCooldown(laserCooldown, laserTime, LASER_COOLDOWN, this.laserCharging);
  }
});