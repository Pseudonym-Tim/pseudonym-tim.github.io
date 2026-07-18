// Scoring...
Object.assign(Game.prototype, {
  awardPoints(basePoints, multiplier, universe, x, y, color = '#ffd25c', label = '') {
    const mult = Math.max(1, multiplier || 1);
    const gained = Math.round(basePoints * mult);
    this.score += gained;
    const amountText = mult > 1 ? `+${gained} (+${basePoints}x${formatMultiplier(mult)})` : `+${gained}`;
    const text = label ? `${label} ${amountText}` : amountText;
    this.addFloatingText(universe, x, y, text, color);
  },

  addFloatingText(universe, x, y, text, color = '#ffd25c') {
    if (!universe) {
      return;
    }

    const floatingText = new FloatingText(this, universe, x, y, text, color);
    floatingText.avoidOverlaps(this.floatingTexts);
    this.floatingTexts.push(floatingText);
  }
});