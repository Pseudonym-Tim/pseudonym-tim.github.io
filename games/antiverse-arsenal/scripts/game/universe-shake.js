// Window-shake attack: sustained reversals charge a global, long-cooldown player ability...
Object.assign(Game.prototype, {
  resetDragShakeTracking() {
    this.dragShakeAxis = null;
    this.dragShakeCandidateX = 0;
    this.dragShakeCandidateY = 0;
    this.dragShakeAxisPosition = 0;
    this.dragShakeExtremePosition = 0;
    this.dragShakeDirection = 0;
    this.dragShakeLastDirectionTime = 0;
    this.dragShakeActivityTimer = 0;
    this.dragShakeSustainStartTime = 0;
    this.dragShakeLastReversalTime = 0;
    this.dragShakeReversalCount = 0;
  },

  resetUniverseShakeStreak(universe = null, resetMotion = false) {
    this.dragShakeSustainStartTime = 0;
    this.dragShakeLastReversalTime = 0;
    this.dragShakeReversalCount = 0;
    this.dragShakeActivityTimer = 0;

    if (resetMotion) {
      this.dragShakeAxis = null;
      this.dragShakeCandidateX = 0;
      this.dragShakeCandidateY = 0;
      this.dragShakeAxisPosition = 0;
      this.dragShakeExtremePosition = 0;
      this.dragShakeDirection = 0;
      this.dragShakeLastDirectionTime = 0;
    }

    if (universe && !universe.isShakeLocked()) {
      universe.setShakeCharge(0);
    }
  },

  isUniverseShakeAbilityAvailable() {
    return !this.bossPending && !this.bossActive;
  },

  isUniverseShakeAbilityReady() {
    return this.isUniverseShakeAbilityAvailable() && (this.shakeAbilityCooldown || 0) <= 0;
  },

  trackUniverseShake(universe, dragDelta, elapsedMs, now = performance.now()) {
    if (!universe || universe.isShakeLocked() || !this.isUniverseShakeAbilityReady()) {
      return false;
    }

    const dx = Number.isFinite(dragDelta?.x) ? dragDelta.x : 0;
    const dy = Number.isFinite(dragDelta?.y) ? dragDelta.y : 0;

    // Accumulate small pointer movements...
    if (!this.dragShakeAxis) {
      this.dragShakeCandidateX += dx;
      this.dragShakeCandidateY += dy;

      const candidateX = Math.abs(this.dragShakeCandidateX);
      const candidateY = Math.abs(this.dragShakeCandidateY);
      const candidateDistance = Math.max(candidateX, candidateY);

      if (candidateDistance < UNIVERSE_SHAKE_MIN_REVERSAL_DISTANCE) {
        return false;
      }

      this.dragShakeAxis = candidateX >= candidateY ? 'x' : 'y';
      this.dragShakeAxisPosition = this.dragShakeAxis === 'x' ? this.dragShakeCandidateX : this.dragShakeCandidateY;
      this.dragShakeDirection = Math.sign(this.dragShakeAxisPosition) || 1;
      this.dragShakeExtremePosition = this.dragShakeAxisPosition;
      this.dragShakeLastDirectionTime = now;
      return false;
    }

    const component = this.dragShakeAxis === 'x' ? dx : dy;

    if (Math.abs(component) < UNIVERSE_SHAKE_MIN_EVENT_DELTA) {
      return false;
    }

    this.dragShakeAxisPosition += component;
    this.dragShakeLastDirectionTime = now;

    let reversalDistance = 0;

    if (this.dragShakeDirection > 0) {
      this.dragShakeExtremePosition = Math.max(this.dragShakeExtremePosition, this.dragShakeAxisPosition);
      reversalDistance = this.dragShakeExtremePosition - this.dragShakeAxisPosition;
    } else {
      this.dragShakeExtremePosition = Math.min(this.dragShakeExtremePosition, this.dragShakeAxisPosition);
      reversalDistance = this.dragShakeAxisPosition - this.dragShakeExtremePosition;
    }

    if (reversalDistance < UNIVERSE_SHAKE_MIN_REVERSAL_DISTANCE) {
      return false;
    }

    const streakExpired = this.dragShakeLastReversalTime > 0 && now - this.dragShakeLastReversalTime > UNIVERSE_SHAKE_MAX_REVERSAL_GAP_MS;

    if (this.dragShakeSustainStartTime <= 0 || streakExpired) {
      this.resetUniverseShakeStreak(universe);
      this.dragShakeSustainStartTime = now;
      this.dragShakeReversalCount = 1;
    } else {
      this.dragShakeReversalCount += 1;
    }

    this.dragShakeDirection *= -1;
    this.dragShakeExtremePosition = this.dragShakeAxisPosition;
    this.dragShakeLastReversalTime = now;
    this.dragShakeActivityTimer = UNIVERSE_SHAKE_ACTIVITY_GRACE;

    const sustainedMs = Math.max(0, now - this.dragShakeSustainStartTime);
    const durationProgress = clamp(sustainedMs / UNIVERSE_SHAKE_MIN_SUSTAIN_MS, 0, 1);
    const reversalProgress = clamp(this.dragShakeReversalCount / UNIVERSE_SHAKE_REQUIRED_REVERSALS, 0, 1);
    const charge = Math.min(reversalProgress, Math.max(0.06, durationProgress));

    universe.setShakeCharge(charge);
    this.setCursorShakeRatio(charge);

    const sustainedLongEnough = sustainedMs >= UNIVERSE_SHAKE_MIN_SUSTAIN_MS;
    const reversedEnough = this.dragShakeReversalCount >= UNIVERSE_SHAKE_REQUIRED_REVERSALS;

    if (sustainedLongEnough && reversedEnough) {
      this.triggerUniverseShakeAttack(universe);
      return true;
    }

    return false;
  },

  triggerUniverseShakeAttack(universe) {
    if (!universe || universe.isShakeLocked() || !this.isUniverseShakeAbilityReady()) {
      return;
    }

    this.shakeAbilityCooldown = UNIVERSE_SHAKE_ABILITY_COOLDOWN;
    universe.beginShakeLock(UNIVERSE_SHAKE_LOCK_DURATION);

    for (const other of this.universes) {
      if (other !== universe) {
        other.setShakeCharge(0);
      }
    }

    const targets = universe.enemies.filter((enemy) => !enemy.dead && !enemy.expired);

    for (const enemy of targets) {
      enemy.applyStun?.(enemy.enemyType === 'boss' ? UNIVERSE_SHAKE_BOSS_STUN_DURATION : UNIVERSE_SHAKE_STUN_DURATION);
      enemy.registerHit?.(1);
      enemy.takeDamage(UNIVERSE_SHAKE_DAMAGE, 1, enemy.x, enemy.y, 0);
    }

    const playerCaughtInShake = this.player?.universe === universe;
    const stunnedTargets = [...targets];

    if (playerCaughtInShake) {
      this.player.applyStun?.(UNIVERSE_SHAKE_PLAYER_STUN_DURATION);
      stunnedTargets.push(this.player);
    }

    for (const target of stunnedTargets) {
      const targetRadius = Math.max(0, Number(target.radius) || 0);
      this.addFloatingText(universe, target.x, target.y - targetRadius - 14, formatText('float.stunned'), '#ff5368');
    }

    universe.triggerDamageShake();
    universe.element.classList.remove('shake-impact');
    void universe.element.offsetWidth;
    universe.element.classList.add('shake-impact');
    clearTimeout(universe.shakeImpactTimeout);
    universe.shakeImpactTimeout = setTimeout(() => {
      universe.element.classList.remove('shake-impact');
      universe.shakeImpactTimeout = null;
    }, 420);

    if (targets.length === 0) {
      this.sound.play('hitHurt');
    }

    this.triggerHitStop(0.055, 0.2, 0.28);
    this.flashCustomCursorImpact();

    if (this.draggingUniverse === universe) {
      this.stopDraggingUniverse();
    }

    this.renderCustomCursorCharge();
    this.refreshCustomCursorTarget();
    this.updateHUD();
  },

  updateUniverseShakeState(dt) {
    const safeDt = Math.max(0, dt);
    const abilityClockActive = !this.isShopOpen() && !this.isMultiverseCompleteOpen() && !this.transitioning;

    if (abilityClockActive && this.shakeAbilityCooldown > 0) {
      this.shakeAbilityCooldown = Math.max(0, this.shakeAbilityCooldown - safeDt);
    }

    this.dragShakeActivityTimer = Math.max(0, (this.dragShakeActivityTimer || 0) - safeDt);

    if (this.draggingUniverse && this.dragShakeLastReversalTime > 0) {
      const clockNow = typeof performance !== 'undefined' ? performance.now() : Date.now();

      if (clockNow - this.dragShakeLastReversalTime > UNIVERSE_SHAKE_STREAK_TIMEOUT_MS) {
        this.resetUniverseShakeStreak(this.draggingUniverse, true);
      }
    }

    for (const universe of this.universes) {
      if (universe.isShakeLocked()) {
        universe.updateShakeLock(safeDt);
        continue;
      }

      if (!this.isUniverseShakeAbilityReady()) {
        universe.setShakeCharge(0);
        continue;
      }

      if (universe !== this.draggingUniverse || this.dragShakeActivityTimer <= 0) {
        const decay = universe === this.draggingUniverse ? UNIVERSE_SHAKE_DRAG_DECAY : UNIVERSE_SHAKE_IDLE_DECAY;
        universe.setShakeCharge(universe.shakeCharge - decay * safeDt);
      }
    }

    if (this.draggingUniverse && this.isUniverseShakeAbilityReady()) {
      this.setCursorShakeRatio(this.draggingUniverse.shakeCharge);
    } else {
      this.setCursorShakeRatio(0);
    }
  }
});
