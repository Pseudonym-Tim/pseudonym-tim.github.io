// Lightweight audio/SFX playback...
const SOUND_EFFECTS = {
  explosion: 'assets/audio/sfx/explosion.wav',
  hitHurt: 'assets/audio/sfx/hitHurt.wav',
  hullPickup: 'assets/audio/sfx/hullPickup.wav',
  laserBeam: 'assets/audio/sfx/laserShoot.wav',
  phaseDash: 'assets/audio/sfx/phaseDash.wav',
  powerupSelect: 'assets/audio/sfx/powerupSelect.wav',
  shoot: 'assets/audio/sfx/shoot.wav',
  warp: 'assets/audio/sfx/warp.wav'
};

const SOUND_DEFAULTS = {
  explosion: { volume: 0.1, poolSize: 5, pitchRange: [0.8, 1.2] },
  hitHurt: { volume: 0.1, poolSize: 6, pitchRange: [0.7, 1.2] },
  hullPickup: { volume: 0.3, poolSize: 3, pitchRange: [1.0, 1.2] },
  laserBeam: { volume: 0.3, poolSize: 3, pitchRange: [0.8, 1.2] },
  phaseDash: { volume: 0.3, poolSize: 3, pitchRange: [0.8, 1.2] },
  powerupSelect: { volume: 0.6, poolSize: 3, pitchRange: [0.8, 1.2] },
  shoot: { volume: 0.1, poolSize: 8, pitchRange: [0.7, 1.2] },
  warp: { volume: 0.1, poolSize: 3, pitchRange: [1.0, 1.2] }
};

class SoundManager {
  constructor(effects = SOUND_EFFECTS, defaults = SOUND_DEFAULTS) {
    this.enabled = typeof Audio !== 'undefined';
    this.effects = effects;
    this.defaults = defaults;
    this.pools = new Map();

    if (!this.enabled) return;

    for (const [name, src] of Object.entries(this.effects)) {
      const options = this.defaults[name] || {};
      const poolSize = options.poolSize || 4;
      const pool = [];

      for (let i = 0; i < poolSize; i++) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = options.volume ?? 0.6;
        this.disablePitchPreservation(audio);
        pool.push(audio);
      }

      this.pools.set(name, { index: 0, items: pool });
    }
  }

  play(name, options = {}) {
    if (!this.enabled) return;
    const pool = this.pools.get(name);
    if (!pool || pool.items.length === 0) return;

    const audio = pool.items[pool.index];
    pool.index = (pool.index + 1) % pool.items.length;
    audio.currentTime = 0;
    audio.volume = options.volume ?? this.defaults[name]?.volume ?? audio.volume;
    this.applyPitch(audio, options.pitchRange ?? this.defaults[name]?.pitchRange);

    const playback = audio.play();
    if (playback?.catch) playback.catch(() => {});
  }

  applyPitch(audio, pitchRange) {
    this.disablePitchPreservation(audio);
    audio.playbackRate = this.randomPitch(pitchRange);
  }

  // It is so fucking stupid that I have to do this, but whatever...
  disablePitchPreservation(audio) {
    audio.preservesPitch = false;
    audio.mozPreservesPitch = false;
    audio.webkitPreservesPitch = false;
  }

  randomPitch(pitchRange) {
    if (!pitchRange) return 1;

    const min = Array.isArray(pitchRange) ? pitchRange[0] : pitchRange.min;
    const max = Array.isArray(pitchRange) ? pitchRange[1] : pitchRange.max;
    const low = Number.isFinite(min) ? min : 1;
    const high = Number.isFinite(max) ? max : low;

    if (high <= low) return Math.max(0.1, low);
    return Math.max(0.1, low + Math.random() * (high - low));
  }
}