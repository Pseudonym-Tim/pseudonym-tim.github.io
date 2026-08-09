// Generic Bytebeat/Floatbeat interpreter...
// (Track formulas are loaded as raw text on the main thread and sent here)...

const MATH_NAMES = Object.getOwnPropertyNames(Math).filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));

const FORMULA_HELPER_NAMES = [...MATH_NAMES, 'int'];
const FORMULA_HELPER_VALUES = [...MATH_NAMES.map((name) => Math[name]), Math.floor];

// Tolerate formulas copied through Markdown/chat where operators may
// have been escaped. Normal source is unchanged by this...
function normalizeFormulaSource(source) {
  return String(source || '')
    .replace(/^\uFEFF/, '')
    .replace(/\\([:*<>_])/g, '$1')
    .trim()
    .replace(/;\s*$/, '');
}

function collectStateIdentifiers(source) {
  const names = new Set();
  const assignment = /(^|[^\w.$])([A-Za-z_$][\w$]*)\s*(?:\+\+|--|\*\*=|<<=|>>>=|>>=|[+\-*/%&|^]=|=(?!=|>))/g;
  const prefixUpdate = /(?:\+\+|--)\s*([A-Za-z_$][\w$]*)/g;

  let match;

  while ((match = assignment.exec(source))) { names.add(match[2]); }
  while ((match = prefixUpdate.exec(source))) { names.add(match[1]); }

  names.delete('t');

  return [...names];
}

function compileExpressionFormula(source) {
  const formula = normalizeFormulaSource(source);

  if (!formula) { throw new Error('Formula is empty'); }

  const stateNames = collectStateIdentifiers(formula);
  const stateDeclaration = stateNames.length ? `let ${stateNames.join(',')};` : '';

  const factory = new Function(
    ...FORMULA_HELPER_NAMES,
    'compatGlobal',
    `
      return (() => {
        ${stateDeclaration}
        const window = compatGlobal;
        const self = compatGlobal;
        const globalThis = compatGlobal;

        const sample = function(t) {
          return (${formula});
        };

        return sample.bind(compatGlobal);
      })();
    `
  );

  return factory(...FORMULA_HELPER_VALUES, Object.create(null));
}

function compileFuncbeat(source) {
  const code = String(source || '').replace(/^\uFEFF/, '').trim();

  if (!code) { throw new Error('Funcbeat code is empty'); }

  const compatGlobal = Object.create(null);
  const factory = new Function(...FORMULA_HELPER_NAMES, 'window', 'self', 'globalThis', code);
  const sample = factory(...FORMULA_HELPER_VALUES, compatGlobal, compatGlobal, compatGlobal);

  if (typeof sample !== 'function') { throw new Error('Funcbeat code must return a function'); }

  return sample.bind(compatGlobal);
}

function normalizeMode(mode) {
  switch (String(mode || '').toLowerCase()) {
    case 'float':
    case 'floatbeat':
      return 'floatbeat';

    case 'signed':
    case 'signed-bytebeat':
    case 'signedbytebeat':
      return 'signed-bytebeat';

    case 'func':
    case 'funcbeat':
      return 'funcbeat';

    default:
      return 'bytebeat';
  }
}

function normalizeSampleRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) { return 8000; }
  return Math.max(1000, Math.min(192000, rate));
}

function normalizeChannelValue(mode, value) {
  if (!Number.isFinite(value)) { return 0; }
  if (mode === 'floatbeat' || mode === 'funcbeat') { return Math.max(-1, Math.min(1, value)); }

  const integer = Math.floor(value);

  if (mode === 'signed-bytebeat') {
    const signed = ((integer + 128) % 256 + 256) % 256 - 128;
    return signed / 128;
  }

  const byte = ((integer % 256) + 256) % 256;

  return (byte - 128) / 128;
}

class BytebeatProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.trackName = null;
    this.tracks = new Map();
    this.sourcePosition = 0;
    this.currentSourceSample = -1;
    this.currentSample = [0, 0];
    this.playing = false;
    this.sampleFunction = null;

    this.meterLowpass = 0;
    this.meterLowpassAmount = 1 - Math.exp(-2 * Math.PI * 220 / sampleRate);
    this.meterSquareSum = 0;
    this.meterLowSquareSum = 0;
    this.meterPeak = 0;
    this.meterSampleCount = 0;
    this.meterIntervalSamples = 256;

    this.port.onmessage = ({ data }) => {
      if (!data) { return; }

      if (data.type === 'configure-track') {
        this.configureTrack(data);
        return;
      }

      if (data.type === 'play') {
        if (data.track !== this.trackName || data.restart) {
          this.trackName = data.track;
          this.restartTrack();
        }

        this.playing = Boolean(this.sampleFunction);

        return;
      }

      if (data.type === 'stop') {
        this.playing = false;
        this.currentSample = [0, 0];
        this.resetMeter();
        this.port.postMessage({ type: 'meter', rms: 0, lowRms: 0, peak: 0 });
      }
    };
  }

  configureTrack(data) {
    const trackName = String(data.track || '');

    if (!trackName) { return; }

    this.tracks.set(trackName, {
      mode: normalizeMode(data.mode),
      sampleRate: normalizeSampleRate(data.sampleRate),
      formula: String(data.formula || ''),
    });

    // Recompile immediately...
    if (trackName === this.trackName) {
      this.restartTrack();
      this.playing = Boolean(this.sampleFunction);
    }
  }

  restartTrack() {
    this.sourcePosition = 0;
    this.currentSourceSample = -1;
    this.currentSample = [0, 0];
    this.resetMeter();
    this.resetTrackRenderer();
  }

  resetTrackRenderer() {
    const track = this.tracks.get(this.trackName);

    this.sampleFunction = null;

    if (!track) { return; }

    try {
      this.sampleFunction = track.mode === 'funcbeat' ? compileFuncbeat(track.formula) : compileExpressionFormula(track.formula);
    } catch (error) {
      this.port.postMessage({
        type: 'track-error',
        track: this.trackName,
        message: error?.message || String(error),
      });
    }
  }

  resetMeter() {
    this.meterLowpass = 0;
    this.meterSquareSum = 0;
    this.meterLowSquareSum = 0;
    this.meterPeak = 0;
    this.meterSampleCount = 0;
  }

  meterSample(value) {
    // Meter the samples so visuals are driven by the exact signal being sent, (independent of AnalyserNode)
    // The one-pole low pass gives extra weight to the bass/kick movement...
    this.meterLowpass += (value - this.meterLowpass) * this.meterLowpassAmount;
    this.meterSquareSum += value * value;
    this.meterLowSquareSum += this.meterLowpass * this.meterLowpass;
    this.meterPeak = Math.max(this.meterPeak, Math.abs(value));
    this.meterSampleCount += 1;

    if (this.meterSampleCount < this.meterIntervalSamples) { return; }

    const rms = Math.sqrt(this.meterSquareSum / this.meterSampleCount);
    const lowRms = Math.sqrt(this.meterLowSquareSum / this.meterSampleCount);

    this.port.postMessage({ type: 'meter', rms: Math.min(1, rms), lowRms: Math.min(1, lowRms), peak: Math.min(1, this.meterPeak), });

    this.meterSquareSum = 0;
    this.meterLowSquareSum = 0;
    this.meterPeak = 0;
    this.meterSampleCount = 0;
  }

  renderTrackSample(track, sourceSample) {
    let rawValue = 0;

    try {
      const t = track.mode === 'funcbeat' ? sourceSample / track.sampleRate : sourceSample;

      rawValue = this.sampleFunction ? this.sampleFunction(t) : 0;
    } catch (error) {
      rawValue = 0;
    }

    if (Array.isArray(rawValue) || ArrayBuffer.isView(rawValue)) {
      const left = normalizeChannelValue(track.mode, Number(rawValue[0]));
      const right = normalizeChannelValue(track.mode, Number(rawValue.length > 1 ? rawValue[1] : rawValue[0]));
      return [left, right];
    }

    const mono = normalizeChannelValue(track.mode, Number(rawValue));

    return [mono, mono];
  }

  process(inputs, outputs) {
    const channels = outputs[0];
    const track = this.tracks.get(this.trackName);

    if (!track || !this.playing || channels.length === 0) {
      for (const channel of channels) { channel.fill(0); }
      return true;
    }

    const sourceStep = track.sampleRate / sampleRate;

    for (let i = 0; i < channels[0].length; i++) {
      const sourceSample = Math.floor(this.sourcePosition);

      if (sourceSample !== this.currentSourceSample) {
        const firstSample = Math.max(0, this.currentSourceSample + 1);
        for (let t = firstSample; t <= sourceSample; t++) { this.currentSample = this.renderTrackSample(track, t); }
        this.currentSourceSample = sourceSample;
      }

      for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
        channels[channelIndex][i] = this.currentSample[Math.min(channelIndex, 1)];
      }

      this.meterSample((this.currentSample[0] + this.currentSample[1]) * 0.5);
      this.sourcePosition += sourceStep;
    }

    return true;
  }
}

registerProcessor('bytebeat-player', BytebeatProcessor);