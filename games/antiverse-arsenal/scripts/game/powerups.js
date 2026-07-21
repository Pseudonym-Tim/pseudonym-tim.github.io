// Powerups...
const POWERUP_DEFINITIONS = [
  { id: 'burst', nameKey: 'powerups.burst.name', descKey: 'powerups.burst.desc', cost: 250, isWeaponReplacement: true, canAppearAgain: true, trackOwnership: true },
  { id: 'multi', nameKey: 'powerups.multi.name', descKey: 'powerups.multi.desc', cost: 300, isWeaponReplacement: true, canAppearAgain: true, trackOwnership: true },
  { id: 'dual', nameKey: 'powerups.dual.name', descKey: 'powerups.dual.desc', cost: 350, isWeaponReplacement: true, canAppearAgain: true, trackOwnership: true },
  { id: 'sniper', nameKey: 'powerups.sniper.name', descKey: 'powerups.sniper.desc', cost: 400, isWeaponReplacement: true, canAppearAgain: true, trackOwnership: true },
  { id: 'repair', nameKey: 'powerups.repair.name', descKey: 'powerups.repair.desc', cost: 150, canAppearAgain: true, trackOwnership: false },
  { id: 'speed', nameKey: 'powerups.speed.name', descKey: 'powerups.speed.desc', cost: 300, canAppearAgain: true, trackOwnership: true },
  { id: 'quantum_boost', nameKey: 'powerups.quantum_boost.name', descKey: 'powerups.quantum_boost.desc', cost: 450, canAppearAgain: true, trackOwnership: true },
  { id: 'reinforced_hull', nameKey: 'powerups.reinforced_hull.name', descKey: 'powerups.reinforced_hull.desc', cost: 400, canAppearAgain: true, trackOwnership: true },
];

Object.assign(Game.prototype, {
  showPowerupSelection(afterSelection = null) {
    this.keys = {};
    powerupOverlay.classList.remove('hidden');
    this.shopRerolls = 0;
    this.shopAfterSelection = afterSelection;
    this.showShopFeedback('');
    this.updateShopCash();
    this.rollPowerupChoices();
  },

  rollPowerupChoices() {
    powerupOptions.innerHTML = '';

    const all = POWERUP_DEFINITIONS.map((powerup) => ({
      ...powerup,
      name: formatText(powerup.nameKey),
      desc: formatText(powerup.descKey)
    }));

    const pool = all.filter((p) => (
      (!p.isWeaponReplacement || !this.hasPowerup(p.id))
      && (p.id !== 'reinforced_hull' || !this.hasPowerup('reinforced_hull'))
      && (p.canAppearAgain || !this.powerups.includes(p.id))
      && (p.id !== 'repair' || this.hp < this.maxHull)
    ));

    const choices = [];

    while (choices.length < 3 && pool.length) {
      choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }

    if (!choices.length) {
      powerupOverlay.classList.add('hidden');

      if (this.shopAfterSelection) {
        this.shopAfterSelection();
      }

      return;
    }

    for (const option of choices) {
      const card = document.createElement('div');
      card.className = 'powerup-card';
      card.innerHTML = `<h3>${option.name}</h3><p>${option.desc}</p><p class="powerup-cost">$${option.cost}</p>`;

      card.addEventListener('click', () => {
        if (this.money < option.cost) {
          this.showShopFeedback(formatText('shop.noCash'));
          return;
        }

        this.money -= option.cost;
        this.sound.play('powerupSelect');
        this.applyPowerup(option.id);
        this.continueFromPowerupShop();
      });

      powerupOptions.appendChild(card);
    }

    this.updateShopRerollButton();
  },

  updateShopCash() {
    shopCash.textContent = formatText('shop.cash', { value: Math.floor(this.money) });
  },

  continueFromPowerupShop() {
    powerupOverlay.classList.add('hidden');
    this.keys = {};

    if (this.shopAfterSelection) {
      this.shopAfterSelection();
    }
  },

  updateShopRerollButton() {
    const remaining = Math.max(0, MAX_SHOP_REROLLS - this.shopRerolls);
    shopRerollButton.textContent = formatText('shop.reroll', { cost: SHOP_REROLL_COST, remaining });
    shopRerollButton.disabled = false;
  },

  rerollPowerupShop() {
    if (this.shopRerolls >= MAX_SHOP_REROLLS) {
      this.showShopFeedback(formatText('shop.noRerolls'));
      return;
    }

    if (this.money < SHOP_REROLL_COST) {
      this.showShopFeedback(formatText('shop.noCash'));
      return;
    }

    this.money -= SHOP_REROLL_COST;
    this.shopRerolls += 1;
    this.updateShopCash();
    this.sound.play('powerupSelect');
    this.showShopFeedback('');
    this.rollPowerupChoices();
  },

  showShopFeedback(text) {
    if (this.shopFeedbackTimer) {
      clearInterval(this.shopFeedbackTimer);
      this.shopFeedbackTimer = null;
    }

    shopFeedback.textContent = '';
    if (!text) {
      return;
    }

    let index = 0;
    this.shopFeedbackTimer = setInterval(() => {
      shopFeedback.textContent += text[index] || '';
      index += 1;

      if (index >= text.length) {
        clearInterval(this.shopFeedbackTimer);
        this.shopFeedbackTimer = null;
      }
    }, 28);
  },

  isShopOpen() {
    return !powerupOverlay.classList.contains('hidden');
  },

  isMultiverseCompleteOpen() {
    return !multiverseCompleteOverlay.classList.contains('hidden');
  },

  applyPowerup(id) {
    const powerup = POWERUP_DEFINITIONS.find((definition) => definition.id === id);

    if (powerup?.trackOwnership) {
      if (powerup.isWeaponReplacement) {
        const weaponReplacementIDs = POWERUP_DEFINITIONS.filter((definition) => definition.isWeaponReplacement).map((definition) => definition.id);
        this.powerups = this.powerups.filter((ownedId) => !weaponReplacementIDs.includes(ownedId));
        this.player.fireRate = this.player.baseFireRate;
      }

      this.powerups.push(id);
    }
    
    if (id === 'repair') {
      this.hp = this.maxHull;
    }

    if (id === 'reinforced_hull') {
      this.maxHull = REINFORCED_PLAYER_HULL;
      this.hp = this.maxHull;
    }

    if (id === 'speed') {
      this.player.extraThrust += 95;
    }
  },

  hasPowerup(id) {
    return this.powerups.includes(id);
  }
});