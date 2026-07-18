// Powerups...
Object.assign(Game.prototype, {
  showPowerupSelection(afterSelection = null) {
    this.keys = {};
    powerupOptions.innerHTML = '';
    powerupOverlay.classList.remove('hidden');

    const all = [
      { id: 'rapid', name: formatText('powerups.rapid.name'), desc: formatText('powerups.rapid.desc') },
      { id: 'multi', name: formatText('powerups.multi.name'), desc: formatText('powerups.multi.desc') },
      { id: 'shield', name: formatText('powerups.shield.name'), desc: formatText('powerups.shield.desc') },
      { id: 'speed', name: formatText('powerups.speed.name'), desc: formatText('powerups.speed.desc') },
      { id: 'quantum_boost', name: formatText('powerups.quantum_boost.name'), desc: formatText('powerups.quantum_boost.desc') },
      { id: 'sniper', name: formatText('powerups.sniper.name'), desc: formatText('powerups.sniper.desc') }
    ];

    const pool = all.filter((p) => !this.powerups.includes(p.id));
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

        this.showMessage(formatText('message.powerupInstalled', { name: option.name }), 900);

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
    this.powerups.push(id);
    if (id === 'rapid') {
      this.player.fireRate = Math.max(0.08, this.player.fireRate * 0.55);
    }

    if (id === 'shield') {
      this.hp = MAX_PLAYER_HULL;
    }

    if (id === 'speed') {
      this.player.extraThrust += 95;
    }
  },

  hasPowerup(id) {
    return this.powerups.includes(id);
  }
});