class TunnelBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas?.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'high-performance'
    });

    this.pulse = 0;
    this.currentUniverse = null;
    this.universeDwellTime = 0;

    this.defaultThemeDark = [0.015, 0.028, 0.095];
    this.defaultThemeBright = [0.11, 0.20, 0.52];

    this.themeDark = [...this.defaultThemeDark];
    this.themeBright = [...this.defaultThemeBright];
    this.pendingThemeDark = [...this.defaultThemeDark];
    this.pendingThemeBright = [...this.defaultThemeBright];

    this.hasUniverseTheme = false;
    this.lastFrameTime = performance.now();
    this.startTime = this.lastFrameTime;
    this.paused = false;
    this.pauseStartedAt = 0;
    this.totalPausedTime = 0;

    if (!this.gl || !this.createProgram()) {
      return;
    }

    this.positionLocation = this.gl.getAttribLocation(this.program, 'aPosition');
    this.resolutionLocation = this.gl.getUniformLocation(this.program, 'iResolution');
    this.timeLocation = this.gl.getUniformLocation(this.program, 'iTime');
    this.pulseLocation = this.gl.getUniformLocation(this.program, 'uKillPulse');
    this.themeDarkLocation = this.gl.getUniformLocation(this.program, 'uThemeDark');
    this.themeBrightLocation = this.gl.getUniformLocation(this.program, 'uThemeBright');

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.createBuffer());

    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), this.gl.STATIC_DRAW);

    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);

    window.addEventListener('resize', this.resize);
    this.resize();
    requestAnimationFrame(this.render);
  }

  createProgram() {
    const vertexSource = `
      attribute vec2 aPosition;

      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;

      #define tau 6.28318

      const float MAX_DISTANCE = 100.0;

      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uKillPulse;
      uniform vec3 uThemeDark;
      uniform vec3 uThemeBright;

      vec2 path(vec3 p) {
        float speed = 2.5;
        p.x = sin(p.z * speed);
        p.y = cos(p.z * speed);
        return p.xy;
      }

      float df(vec3 p, vec3 eye) {
        float tunnelRadius = 2.0 - 2.0 * (p.z - eye.z) / 1.4;
        p.xy += path(p);
        return tunnelRadius - length(p.xy);
      }

      vec3 dcol(vec3 p) {
        p.xy += path(p);

        return mix(
          uThemeDark,
          uThemeBright,
          step(fract(2.0 * (2.0 * p.z + atan(p.y, p.x) / tau)), 0.5)
        );
      }

      void main() {
        vec2 shake = vec2(
          sin(iTime * 83.0) + sin(iTime * 47.0),
          cos(iTime * 71.0) + sin(iTime * 59.0)
        ) * 0.05 * uKillPulse;

        vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
        uv.y *= -1.0;
        uv += shake;

        float pixel = 70.0;
        uv = floor(uv * pixel) / pixel;

        float t = iTime * 0.3;
        vec3 eye = vec3(0.0, 0.0, t);
        eye.xy -= path(eye);

        vec3 dir = normalize(vec3(uv, 0.2));
        float dist = 0.1;
        float tot = -0.2;
        vec3 p = eye + dir * tot;

        vec3 col = vec3(0.005, 0.008, 0.025);

        for (int i = 0; i < 70; i++) {
          if (dist < 0.001 || tot > MAX_DISTANCE) {
            break;
          }

          p = eye + dir * tot;
          tot += dist = df(p, eye) * 0.1;
          col = dcol(p) * (1.0 - (p.z - eye.z) / 0.75);
        }

        col *= 0.82 + 0.32 * uKillPulse;
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }
    `;

    const gl = this.gl;

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Tunnel background shader failed to compile:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertex || !fragment) {
      return false;
    }

    this.program = gl.createProgram();
    gl.attachShader(this.program, vertex);
    gl.attachShader(this.program, fragment);
    gl.linkProgram(this.program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.warn('Tunnel background shader failed to link:', gl.getProgramInfoLog(this.program));
      gl.deleteProgram(this.program);
      this.program = null;
      return false;
    }

    gl.useProgram(this.program);
    return true;
  }

  resize() {
    const scale = Math.min(0.5, 800 / window.innerWidth, 450 / window.innerHeight);

    this.canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
    this.canvas.height = Math.max(1, Math.round(window.innerHeight * scale));

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  pulseOnKill() {
    this.pulse = Math.min(1.5, this.pulse + 1);
  }

  pause(now = performance.now()) {
    if (this.paused) {
      return;
    }

    this.paused = true;
    this.pauseStartedAt = now;
  }

  resume(now = performance.now()) {
    if (!this.paused) {
      return;
    }

    this.totalPausedTime += Math.max(0, now - this.pauseStartedAt);
    this.pauseStartedAt = 0;
    this.lastFrameTime = now;
    this.paused = false;
  }

  updateUniverseTheme(universe, dt) {
    if (!TUNNEL_FOLLOWS_UNIVERSE_THEME) {
      this.currentUniverse = null;
      this.universeDwellTime = 0;
      this.lerpThemeColors(this.defaultThemeDark, this.defaultThemeBright, dt);
      return;
    }

    if (!universe) {
      this.currentUniverse = null;
      this.universeDwellTime = 0;
      this.lerpThemeColors(this.defaultThemeDark, this.defaultThemeBright, dt);
      return;
    }

    if (universe !== this.currentUniverse) {
      this.currentUniverse = universe;
      this.universeDwellTime = 0;

      [this.pendingThemeDark, this.pendingThemeBright] = this.getUniverseColors(universe);

      // The first universe applies immediately...
      if (!this.hasUniverseTheme) {
        this.themeDark = [...this.pendingThemeDark];
        this.themeBright = [...this.pendingThemeBright];
        this.hasUniverseTheme = true;
      }
    } else {
      this.universeDwellTime += dt;
    }

    if (this.universeDwellTime >= TUNNEL_THEME_DWELL_SECONDS) {
      this.lerpThemeColors(this.pendingThemeDark, this.pendingThemeBright, dt);
    }
  }

  resetUniverseTheme() {
    this.currentUniverse = null;
    this.universeDwellTime = 0;
    this.hasUniverseTheme = false;

    this.themeDark = [...this.defaultThemeDark];
    this.themeBright = [...this.defaultThemeBright];
    this.pendingThemeDark = [...this.defaultThemeDark];
    this.pendingThemeBright = [...this.defaultThemeBright];
  }

  getUniverseColors(universe) {
    // Universe colors remain brighter and more saturated than the starting palette...
    const themedColor = this.hslToRgb(universe.theme.hue, 0.95, 0.28);
    const windowBackground = [2 / 255, 6 / 255, 23 / 255];

    const darkColor = windowBackground.map(
      (channel, index) => channel * 0.6 + themedColor[index] * 0.4
    );

    return [darkColor, themedColor];
  }

  lerpThemeColors(darkTarget, brightTarget, dt) {
    const amount = 1 - Math.exp(-2.5 * dt);

    this.themeDark = this.themeDark.map(
      (channel, index) => channel + (darkTarget[index] - channel) * amount
    );

    this.themeBright = this.themeBright.map(
      (channel, index) => channel + (brightTarget[index] - channel) * amount
    );
  }

  hslToRgb(hue, saturation, lightness) {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const normalizedHue = ((hue % 360) + 360) % 360;
    const segment = normalizedHue / 60;
    const secondary = chroma * (1 - Math.abs(segment % 2 - 1));
    const match = lightness - chroma / 2;

    const pairs = [
      [chroma, secondary, 0],
      [secondary, chroma, 0],
      [0, chroma, secondary],
      [0, secondary, chroma],
      [secondary, 0, chroma],
      [chroma, 0, secondary]
    ];

    return pairs[Math.floor(segment)].map((channel) => channel + match);
  }

  render(now) {
    if (this.paused) {
      this.lastFrameTime = now;
      requestAnimationFrame(this.render);
      return;
    }

    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    this.pulse += (0 - this.pulse) * (1 - Math.exp(-7 * dt));

    this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
    this.gl.uniform1f(this.timeLocation, (now - this.startTime - this.totalPausedTime) / 1000);
    this.gl.uniform1f(this.pulseLocation, this.pulse);
    this.gl.uniform3fv(this.themeDarkLocation, this.themeDark);
    this.gl.uniform3fv(this.themeBrightLocation, this.themeBright);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    requestAnimationFrame(this.render);
  }
}