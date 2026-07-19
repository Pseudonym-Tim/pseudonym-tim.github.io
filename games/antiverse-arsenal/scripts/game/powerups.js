// Powerups...
const POWERUP_DEFINITIONS = [
  { id: 'burst', nameKey: 'powerups.burst.name', descKey: 'powerups.burst.desc', isWeaponReplacement: true, canAppearAgain: true, trackOwnership: true },
  { id: 'multi', nameKey: 'powerups.multi.name', descKey: 'powerups.multi.desc', isWeaponReplacement: true, canAppearAgain: true, trackOwnership: true },
  { id: 'dual', nameKey: 'powerups.dual.name', descKey: 'powerups.dual.desc', isWeaponReplacement: true, canAppearAgain: true, trackOwnership: true },
  { id: 'sniper', nameKey: 'powerups.sniper.name', descKey: 'powerups.sniper.desc', isWeaponReplacement: true, canAppearAgain: true, trackOwnership: true },
  { id: 'repair', nameKey: 'powerups.repair.name', descKey: 'powerups.repair.desc', canAppearAgain: true, trackOwnership: false },
  { id: 'speed', nameKey: 'powerups.speed.name', descKey: 'powerups.speed.desc', canAppearAgain: true, trackOwnership: true },
  { id: 'quantum_boost', nameKey: 'powerups.quantum_boost.name', descKey: 'powerups.quantum_boost.desc', canAppearAgain: true, trackOwnership: true },
  { id: 'reinforced_hull', nameKey: 'powerups.reinforced_hull.name', descKey: 'powerups.reinforced_hull.desc', canAppearAgain: true, trackOwnership: true },
];

Object.assign(Game.prototype, {
  showPowerupSelection(afterSelection = null) {
    this.keys = {};
    powerupOptions.innerHTML = '';
    powerupOverlay.classList.remove('hidden');

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

      if (afterSelection) {
        afterSelection();
      }

      return;
    }

    // Holy shit this is cursed, forgive me god...
    for (const option of choices) {
      const card = document.createElement('div');
      card.className = 'powerup-card';
      card.innerHTML = `<h3>${option.name}</h3><p>${option.desc}</p>`;

      card.addEventListener('click', () => {
        this.sound.play('powerupSelect');
        this.applyPowerup(option.id);
        powerupOverlay.classList.add('hidden');
        this.keys = {};

        //this.showMessage(formatText('message.powerupInstalled', { name: option.name }), 900);

        if (afterSelection) {
          afterSelection();
        }
      });

      powerupOptions.appendChild(card);
    }
  },

  isShopOpen() {
    return !powerupOverlay.classList.contains('hidden');
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