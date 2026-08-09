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

    if (!this.enabled) {
      return;
    }

    for (const [name, src] of Object.entries(this.effects)) {
      const options = this.defaults[name] || {};
      const poolSize = options.poolSize || 4;
      const pool = [];

      for (let i = 0; i < poolSize; i++) {
        pool.push(this.createAudio(src, options));
      }

      this.pools.set(name, { index: 0, items: pool, maxSize: options.maxPoolSize || poolSize * 2, options, src });
    }
  }

  play(name, options = {}) {
    if (!this.enabled) {
      return;
    }

    const pool = this.pools.get(name);

    if (!pool || pool.items.length === 0) {
      return;
    }

    const audio = this.getAvailableAudio(pool);

    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    audio.volume = options.volume ?? this.defaults[name]?.volume ?? audio.volume;
    this.applyPitch(audio, options.pitchRange ?? this.defaults[name]?.pitchRange);

    const playback = audio.play();

    if (playback?.catch) {
      playback.catch(() => {});
    }
  }

  createAudio(src, options) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = options.volume ?? 0.6;
    this.disablePitchPreservation(audio);
    return audio;
  }

  getAvailableAudio(pool) {
    const { items } = pool;

    // Reusing a playing element restarts it, which can truncate previous SFX...
    // Search the pool first so overlapping sounds can finish naturally...
    for (let offset = 0; offset < items.length; offset++) {
      const index = (pool.index + offset) % items.length;

      if (items[index].paused || items[index].ended) {
        pool.index = (index + 1) % items.length;
        return items[index];
      }
    }

    // Brief bursts can exceed initial pool size, just Add a channel instead of
    // stealing one that is still playing, (while retaining a bounded pool)...
    if (items.length < pool.maxSize) {
      const audio = this.createAudio(pool.src, pool.options);
      
      items.push(audio);
      pool.index = 0;
      return audio;
    }

    return null;
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
    if (!pitchRange) {
      return 1;
    }

    const min = Array.isArray(pitchRange) ? pitchRange[0] : pitchRange.min;
    const max = Array.isArray(pitchRange) ? pitchRange[1] : pitchRange.max;
    const low = Number.isFinite(min) ? min : 1;
    const high = Number.isFinite(max) ? max : low;

    if (high <= low) {
      return Math.max(0.1, low);
    }

    return Math.max(0.1, low + Math.random() * (high - low));
  }
}

// Tiny procedural soundtrack player... Track metadata lives in
// bytebeat-tracks.js, each song expression is kept as plain text...
class BytebeatMusicManager {
  constructor(volume = 0.16) {
    this.enabled = typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
    this.volume = volume;
    this.context = null;
    this.node = null;
    this.gain = null;
    this.meterRms = 0;
    this.meterLowRms = 0;
    this.meterPeak = 0;
    this.meterReceived = false;
    this.reactiveEnvelope = 0;
    this.reactiveBaseline = 0;
    this.reactivePulse = 0;
    this.reactivePreviousLevel = 0;
    this.reactiveInitialized = false;
    this.currentTrack = null;
    this.initPromise = null;
    this.trackCache = new Map();
    this.fadeSeconds = 0.6;
    this.transitionToken = 0;
  }

  async init() {
    if (!this.enabled) {
      return false;
    }

    if (this.node) {
      return true;
    }

    if (!this.initPromise) {
      this.initPromise = this.createAudioGraph().catch((error) => {
        console.warn('Bytebeat music disabled:', error);
        this.enabled = false;
        return false;
      });
    }

    return this.initPromise;
  }

  async createAudioGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    try {
      this.context = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 48000 });
    } catch (error) {
      this.context = new AudioContextClass({ latencyHint: 'interactive' });
    }

    if (!this.context.audioWorklet) {
      throw new Error('AudioWorklet is not supported by this browser!');
    }

    await this.context.audioWorklet.addModule('scripts/engine/bytebeat-worklet.js');

    this.node = new AudioWorkletNode(this.context, 'bytebeat-player', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });

    this.node.port.onmessage = ({ data }) => {
      if (!data) {
        return;
      }

      if (data.type === 'meter') {
        this.meterRms = Math.max(0, Math.min(1, Number(data.rms) || 0));
        this.meterLowRms = Math.max(0, Math.min(1, Number(data.lowRms) || 0));
        this.meterPeak = Math.max(0, Math.min(1, Number(data.peak) || 0));
        this.meterReceived = true;
        return;
      }

      if (data.type === 'track-error') {
        console.error(`Could not compile track "${data.track}":`, data.message);
      }
    };

    this.gain = this.context.createGain();

    // Start silent so the first song fades in instead of popping on...
    this.gain.gain.value = 0;
    this.node.connect(this.gain);
    this.gain.connect(this.context.destination);
    return true;
  }

  getTrackDefinition(track) {
    return window.BYTEBEAT_TRACKS?.[track] || null;
  }

  async loadTrack(track, forceReload = false) {
    if (!forceReload && this.trackCache.has(track)) {
      return this.trackCache.get(track);
    }

    const definition = this.getTrackDefinition(track);

    if (!definition?.source) {
      throw new Error(`Unknown Bytebeat track: ${track}`);
    }

    const response = await fetch(definition.source, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Could not load ${definition.source} (${response.status})`);
    }

    const formula = (await response.text()).trim();

    if (!formula) {
      throw new Error(`Bytebeat formula is empty: ${definition.source}`);
    }

    const loaded = {
      mode: definition.mode || 'bytebeat',
      sampleRate: Number(definition.sampleRate) || 8000,
      formula,
    };

    this.trackCache.set(track, loaded);
    return loaded;
  }

  async configureTrack(track, forceReload = false) {
    const loaded = await this.loadTrack(track, forceReload);

    if (!this.node) {
      return loaded;
    }

    this.node.port.postMessage({
      type: 'configure-track',
      track,
      ...loaded,
    });

    return loaded;
  }

  async unlock() {
    const ready = await this.init();

    if (!ready || !this.context) {
      return false;
    }

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch (error) {
        console.warn('Could not resume Bytebeat music:', error);
        return false;
      }
    }

    return this.context.state === 'running';
  }

  holdGainAtCurrentValue() {
    if (!this.context || !this.gain) {
      return;
    }

    const now = this.context.currentTime;
    const parameter = this.gain.gain;

    if (typeof parameter.cancelAndHoldAtTime === 'function') {
      parameter.cancelAndHoldAtTime(now);
      return;
    }

    const value = parameter.value;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(value, now);
  }

  rampGain(target, duration = this.fadeSeconds) {
    if (!this.context || !this.gain) {
      return;
    }

    const seconds = Math.max(0, Number(duration) || 0);
    const now = this.context.currentTime;
    const parameter = this.gain.gain;
    this.holdGainAtCurrentValue();

    if (seconds <= 0) {
      parameter.setValueAtTime(target, now);
      return;
    }

    parameter.linearRampToValueAtTime(target, now + seconds);
  }

  waitForFade(duration = this.fadeSeconds) {
    const milliseconds = Math.max(0, Number(duration) || 0) * 1000;
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async play(track, restart = false, options = {}) {
    if (!track || (track === this.currentTrack && !restart)) {
      return;
    }

    const transitionToken = ++this.transitionToken;
    const ready = await this.unlock();

    if (!ready || !this.node || transitionToken !== this.transitionToken) {
      return;
    }

    try {
      await this.configureTrack(track);
    } catch (error) {
      console.error(`Could not load Bytebeat track "${track}":`, error);
      return;
    }

    if (transitionToken !== this.transitionToken) {
      return;
    }

    const fadeOutSeconds = Math.max(0, Number(options.fadeOutSeconds ?? this.fadeSeconds) || 0);
    const fadeInSeconds = Math.max(0, Number(options.fadeInSeconds ?? this.fadeSeconds) || 0);
    const hasOutgoingTrack = Boolean(this.currentTrack);

    // A single worklet renders active formula, transitions use a short
    // silence fade before swapping tracks, then fade the new track in...
    if (hasOutgoingTrack) {
      this.rampGain(0, fadeOutSeconds);
      await this.waitForFade(fadeOutSeconds);

      if (transitionToken !== this.transitionToken) {
        return;
      }
    } else {
      this.rampGain(0, 0);
    }

    this.currentTrack = track;
    this.node.port.postMessage({ type: 'play', track, restart: restart || hasOutgoingTrack });
    this.rampGain(this.volume, fadeInSeconds);
  }

  async fadeOut(duration = this.fadeSeconds) {
    const transitionToken = ++this.transitionToken;

    if (!this.node || !this.currentTrack) {
      this.currentTrack = null;
      this.resetReactiveState();
      return;
    }

    const seconds = Math.max(0, Number(duration) || 0);
    this.rampGain(0, seconds);
    await this.waitForFade(seconds);

    if (transitionToken !== this.transitionToken) {
      return;
    }

    this.node.port.postMessage({ type: 'stop' });
    this.currentTrack = null;
    this.resetReactiveState();
  }

  async reloadTrack(track = this.currentTrack) {
    if (!track) {
      return false;
    }

    const ready = await this.unlock();

    if (!ready || !this.node) {
      return false;
    }

    try {
      await this.configureTrack(track, true);
    } catch (error) {
      console.error(`Could not reload Bytebeat track "${track}":`, error);
      return false;
    }

    if (track === this.currentTrack) {
      this.node.port.postMessage({ type: 'play', track, restart: true });
    }

    return true;
  }

  pause() {
    if (this.context?.state === 'running') {
      this.context.suspend().catch(() => {});
    }
  }

  resume() {
    if (this.currentTrack && this.context?.state === 'suspended') {
      this.context.resume().catch(() => {});
    }
  }

  stop() {
    this.transitionToken += 1;

    if (this.gain) {
      this.rampGain(0, 0);
    }

    if (this.node) {
      this.node.port.postMessage({ type: 'stop' });
    }

    this.currentTrack = null;
    this.resetReactiveState();
  }

  getReactivePulse(dt = 1 / 60) {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0));

    const active = Boolean(
      this.currentTrack &&
      this.meterReceived &&
      this.context?.state === 'running'
    );

    if (!active) {
      const decay = 1 - Math.exp(-9 * safeDt);
      this.reactiveEnvelope += (0 - this.reactiveEnvelope) * decay;
      this.reactiveBaseline += (0 - this.reactiveBaseline) * decay;
      this.reactivePulse += (0 - this.reactivePulse) * decay;

      return this.reactivePulse;
    }

    // This value is measured in the AudioWorklet from actual generated samples. 
    // Bass energy carries the weight...
    const level = Math.min(1,
      this.meterLowRms * 1.9 +
      this.meterRms * 0.42 +
      this.meterPeak * 0.08
    );

    if (!this.reactiveInitialized) {
      this.reactiveEnvelope = level;
      this.reactiveBaseline = level;
      this.reactivePulse = 0;
      this.reactivePreviousLevel = level;
      this.reactiveInitialized = true;
      return 0;
    }

    // Track the music quickly so individual hits remain visible instead of
    // melting into a shitty slow breathing motion... Release is still slightly softer
    // than attack so does not look jittery between samples...
    const envelopeRate = level > this.reactiveEnvelope ? 58 : 26;
    const envelopeAmount = 1 - Math.exp(-envelopeRate * safeDt);
    this.reactiveEnvelope += (level - this.reactiveEnvelope) * envelopeAmount;

    // Keep a slow-moving center level...
    const baselineAmount = 1 - Math.exp(-0.72 * safeDt);
    this.reactiveBaseline += (this.reactiveEnvelope - this.reactiveBaseline) * baselineAmount;

    // Add a transient from frame-to-frame level changes. This SHOULD make
    // kicks and sharp musical stuff register immediately without increasing overall scale range...
    const transient = Math.max(-0.18, Math.min(0.18, level - this.reactivePreviousLevel));
    this.reactivePreviousLevel = level;

    const targetPulse = Math.max(-1, Math.min(1,
      (this.reactiveEnvelope - this.reactiveBaseline) * 8.4 + transient * 4.2
    ));

    // Deliberately light smoothing while preventing weird fuckups...
    const pulseRate = targetPulse > this.reactivePulse ? 52 : 34;
    const pulseAmount = 1 - Math.exp(-pulseRate * safeDt);
    this.reactivePulse += (targetPulse - this.reactivePulse) * pulseAmount;

    return this.reactivePulse;
  }

  resetReactiveState() {
    this.meterRms = 0;
    this.meterLowRms = 0;
    this.meterPeak = 0;
    this.meterReceived = false;
    this.reactiveEnvelope = 0;
    this.reactiveBaseline = 0;
    this.reactivePulse = 0;
    this.reactivePreviousLevel = 0;
    this.reactiveInitialized = false;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, Number(volume) || 0));

    if (this.gain) {
      this.gain.gain.value = this.volume;
    }
  }
}