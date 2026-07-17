// Universe windows...
class Universe {
  constructor(game, id, x, y, collapsed = false) {
    this.game = game;
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = LOGICAL_W;
    this.height = LOGICAL_H;
    this.headerHeight = HEADER_H;
    this.enemies = [];
    this.asteroids = [];
    this.hullPickups = [];
    this.theme = this.game.getUniverseTheme();

    this.element = document.createElement('div');
    this.element.className = collapsed ? 'universe universe-collapsed' : 'universe';

    this.header = document.createElement('div');
    this.header.className = 'universe-header';
    this.element.appendChild(this.header);

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.element.appendChild(this.canvas);

    this.element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    this.element.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        e.preventDefault();
        this.warpToPointer(e);
        return;
      }

      if (e.button !== 0) {
        return;
      }

      e.preventDefault();
      this.game.startDraggingUniverse(this, e);
    });

    container.appendChild(this.element);
    this.applyTheme();
    this.applyScale(this.game.scale);
    this.setPosition(x, y);
    this.setLabel();
  }

  applyTheme() {
    this.element.style.setProperty('--universe-color', this.theme.color);
    this.element.style.setProperty('--universe-color-soft', this.theme.soft);
    this.element.style.setProperty('--universe-color-glow', this.theme.glow);
  }

  setLogicalSize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.applyScale(this.scale || this.game.scale);
    this.setPosition(this.x, this.y);
  }

  applyScale(scale) {
    this.baseScale = scale;
    this.scale = scale;
    this.cssWidth = this.width * this.scale;
    this.cssHeight = this.height * this.scale;
    this.cssHeader = this.headerHeight * this.scale;
    this.element.style.width = `${this.cssWidth}px`;
    this.element.style.height = `${this.cssHeight + this.cssHeader}px`;
    this.header.style.height = `${this.cssHeader}px`;
    this.header.style.lineHeight = `${this.cssHeader}px`;
    const headerFontSize = Math.max(16, Math.round((16 * this.scale) / 16) * 16);
    this.header.style.fontSize = `${headerFontSize}px`;
    this.canvas.style.top = `${this.cssHeader}px`;
    this.canvas.style.left = '0px';
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
  }

  setLabel() {
    this.header.textContent = formatText('universe.label', { id: this.id });
  }

  warpToPointer(e) {
    const rect = this.getCanvasRect();

    if (e.clientX < rect.x || e.clientX > rect.x + rect.w || e.clientY < rect.y || e.clientY > rect.y + rect.h) {
      return;
    }

    const pos = this.worldToLocal(e.clientX, e.clientY);
    this.game.tryWarpTo(this, pos.x, pos.y);
  }

  setPosition(x, y) {
    const maxX = Math.max(0, window.innerWidth - this.cssWidth - 4);
    const maxY = Math.max(0, window.innerHeight - this.cssHeight - this.cssHeader - 4);
    this.x = clamp(x, 4, maxX);
    this.y = clamp(y, 4, maxY);
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
  }

  triggerDamageShake() {
    clearTimeout(this.damageShakeTimeout);
    this.element.classList.remove('damage-shake');
    void this.element.offsetWidth;
    this.element.classList.add('damage-shake');

    this.damageShakeTimeout = setTimeout(() => {
      this.element.classList.remove('damage-shake');
      this.damageShakeTimeout = null;
    }, 220);
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.cssWidth, h: this.cssHeight + this.cssHeader };
  }

  getCanvasRect() {
    return { x: this.x, y: this.y + this.cssHeader, w: this.cssWidth, h: this.cssHeight };
  }

  localToWorld(x, y) {
    return { x: this.x + x * this.scale, y: this.y + this.cssHeader + y * this.scale };
  }

  worldToLocal(x, y) {
    return { x: (x - this.x) / this.scale, y: (y - this.y - this.cssHeader) / this.scale };
  }

  update(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      
      if (!enemy.dead) {
        enemy.update(dt);
      }

      if (enemy.dead) {
        this.enemies.splice(i, 1);
        this.game.onEnemyDestroyed(enemy);
        continue;
      }

      if (enemy.universe !== this) {
        this.enemies.splice(i, 1);
        enemy.universe.enemies.push(enemy);
      }
    }

    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];

      if (!asteroid.dead) {
        asteroid.update(dt);
      }

      if (asteroid.dead) {
        this.asteroids.splice(i, 1);

        if (!asteroid.expired) {
          this.game.onAsteroidDestroyed(asteroid);
        }

        continue;
      }

      if (asteroid.universe !== this) {
        this.asteroids.splice(i, 1);
        asteroid.universe.asteroids.push(asteroid);
      }
    }

    for (let i = this.hullPickups.length - 1; i >= 0; i--) {
      const pickup = this.hullPickups[i];
      pickup.update(dt);

      if (pickup.collected) {
        this.hullPickups.splice(i, 1);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const hueShift = this.theme.hue;

    if (!drawPixelArtTiled(ctx, pixelArt.universeBackground, 0, 0, this.width, this.height, { time: this.game.spriteClock + this.id * 0.19, scale: UNIVERSE_BACKGROUND_TILE_SCALE })) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `hsla(${hueShift}, 100%, 55%, ${UNIVERSE_TINT_BACKGROUND_ALPHA})`;

    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    ctx.strokeStyle = `hsla(${hueShift}, 100%, 62%, ${UNIVERSE_TINT_GRID_ALPHA})`;
    ctx.lineWidth = 1;

    for (let x = 0; x <= this.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }

    for (let y = 0; y <= this.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Hull pickups render beneath asteroids so rocks can pass visibly over them...
    for (const pickup of this.hullPickups) {
      pickup.draw(ctx);
    }

    for (const asteroid of this.asteroids) {
      asteroid.draw(ctx);
    }

    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }
  }
}