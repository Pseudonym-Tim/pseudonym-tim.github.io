class SpriteAnimation {
  constructor(src, options = {}) {
    this.image = new Image();
    this.image.src = src;
    this.frameWidth = options.frameWidth || null;
    this.frameHeight = options.frameHeight || null;
    this.frameCount = options.frameCount || 1;
    this.fps = options.fps || 1;
    this.loop = options.loop !== false;
  }

  get ready() {
    return this.image.complete && this.image.naturalWidth > 0;
  }

  getFrameIndex(time = 0) {
    if (this.frameCount <= 1) return 0;
    const frame = Math.floor(Math.max(0, time) * this.fps);
    return this.loop ? frame % this.frameCount : Math.min(frame, this.frameCount - 1);
  }

  getSourceRect(time = 0) {
    const sourceWidth = this.frameWidth || Math.floor(this.image.naturalWidth / this.frameCount);
    const sourceHeight = this.frameHeight || this.image.naturalHeight;
    const frameIndex = this.getFrameIndex(time);
    const framesPerRow = Math.max(1, Math.floor(this.image.naturalWidth / sourceWidth));
    const sx = (frameIndex % framesPerRow) * sourceWidth;
    const sy = Math.floor(frameIndex / framesPerRow) * sourceHeight;

    return { sx, sy, sourceWidth, sourceHeight };
  }

  draw(ctx, size, options = {}) {
    if (!this.ready) return false;

    const { sx, sy, sourceWidth, sourceHeight } = this.getSourceRect(options.time);
    const scale = Math.max(0.0001, options.scale ?? 1);
    const drawSize = size * scale;
    const half = drawSize / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (options.alpha !== undefined) ctx.globalAlpha *= options.alpha;
    ctx.drawImage(this.image, sx, sy, sourceWidth, sourceHeight, -half, -half, drawSize, drawSize);
    ctx.restore();

    return true;
  }

  drawFrame(ctx, x, y, width, height, options = {}) {
    if (!this.ready) return false;

    const { sx, sy, sourceWidth, sourceHeight } = this.getSourceRect(options.time);
    const scale = Math.max(0.0001, options.scale ?? 1);
    const drawWidth = width * scale;
    const drawHeight = height * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (options.alpha !== undefined) ctx.globalAlpha *= options.alpha;
    ctx.drawImage(this.image, sx, sy, sourceWidth, sourceHeight, x, y, drawWidth, drawHeight);
    ctx.restore();

    return true;
  }

  drawTiled(ctx, x, y, width, height, options = {}) {
    if (!this.ready) return false;

    const { sx, sy, sourceWidth, sourceHeight } = this.getSourceRect(options.time);
    const scale = Math.max(0.0001, options.scale ?? 1);
    const tileWidth = (options.tileWidth || sourceWidth) * scale;
    const tileHeight = (options.tileHeight || sourceHeight) * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (options.alpha !== undefined) ctx.globalAlpha *= options.alpha;

    for (let tileY = y; tileY < y + height; tileY += tileHeight) {
      for (let tileX = x; tileX < x + width; tileX += tileWidth) {
        const drawWidth = Math.min(tileWidth, x + width - tileX);
        const drawHeight = Math.min(tileHeight, y + height - tileY);
        
        ctx.drawImage(
          this.image,
          sx,
          sy,
          Math.floor((drawWidth / tileWidth) * sourceWidth),
          Math.floor((drawHeight / tileHeight) * sourceHeight),
          tileX,
          tileY,
          drawWidth,
          drawHeight
        );
      }
    }

    ctx.restore();
    return true;
  }
}

const pixelArt = {
  player: loadSprite('assets/sprites/player_ship.png', {
    frameWidth: 16,
    frameHeight: 18,
    frameCount: 3,
    fps: 5
  }),
  enemy: loadSprite('assets/sprites/enemy_ship.png', {
    frameWidth: 16,
    frameHeight: 18,
    frameCount: 3,
    fps: 5
  }),
  asteroid: loadSprite('assets/sprites/asteroid_1.png'),
  hullPickup: loadSprite('assets/sprites/hull_pickup.png'),
  playerBullet: loadSprite('assets/sprites/player_bullet.png'),
  enemyBullet: loadSprite('assets/sprites/enemy_bullet.png'),
  universeBackground: loadSprite('assets/sprites/universe_background.png', {
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 2,
    fps: 2
  })
};

function loadSprite(src, options = {}) {
  return new SpriteAnimation(src, options);
}

function drawPixelArt(ctx, sprite, size, options = {}) {
  return sprite?.draw(ctx, size, options) || false;
}

function drawPixelArtFrame(ctx, sprite, x, y, width, height, options = {}) {
  return sprite?.drawFrame(ctx, x, y, width, height, options) || false;
}

function drawPixelArtTiled(ctx, sprite, x, y, width, height, options = {}) {
  return sprite?.drawTiled(ctx, x, y, width, height, options) || false;
}