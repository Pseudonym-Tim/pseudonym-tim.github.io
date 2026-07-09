// Sprite loading, animation, and pixel-art stuff...
class SpriteAnimation {
  constructor(srcOrOptions, options = {}) {
    const isImageElement = typeof HTMLImageElement !== 'undefined' && srcOrOptions instanceof HTMLImageElement;
    const config = typeof srcOrOptions === 'object' && srcOrOptions !== null && !isImageElement
      ? srcOrOptions
      : { ...options, image: srcOrOptions };

    this.image = this.createImage(config.image || config.src);
    this.frameWidth = config.frameWidth || null;
    this.frameHeight = config.frameHeight || null;
    this.frameCount = config.frameCount || 1;
    this.fps = config.fps || 1;
    this.loop = config.loop !== false;
    this.animations = this.normalizeAnimations(config.animations || {});
    this.currentAnimationName = config.defaultAnimation || Object.keys(this.animations)[0] || null;
    this.animationStartedAt = 0;
  }

  createImage(image) {
    if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) return image;

    const spriteImage = new Image();
    if (image) spriteImage.src = image;
    return spriteImage;
  }

  normalizeAnimations(animations) {
    return Object.fromEntries(Object.entries(animations).map(([name, animation]) => [
      name,
      {
        row: animation.row || 0,
        column: animation.column || 0,
        frames: animation.frames || animation.frameCount || 1,
        fps: animation.fps || this.fps,
        loop: animation.loop ?? this.loop
      }
    ]));
  }

  get ready() {
    return this.image.complete && this.image.naturalWidth > 0;
  }

  get currentAnimation() {
    return this.currentAnimationName ? this.animations[this.currentAnimationName] : null;
  }

  play(name, time = 0, options = {}) {
    if (!this.animations[name]) return false;
    if (this.currentAnimationName !== name || options.restart) {
      this.currentAnimationName = name;
      this.animationStartedAt = Math.max(0, time);
    }
    return true;
  }

  getAnimation(name) {
    return this.animations[name] || null;
  }

  getFrameIndex(time = 0, animation = null) {
    const frameCount = animation?.frames ?? this.frameCount;
    if (frameCount <= 1) return 0;

    const fps = animation?.fps ?? this.fps;
    const loop = animation?.loop ?? this.loop;
    const elapsed = Math.max(0, time - (animation ? this.animationStartedAt : 0));
    const frame = Math.floor(elapsed * fps);
    return loop ? frame % frameCount : Math.min(frame, frameCount - 1);
  }

  getSourceRect(time = 0, animationName = null) {
    const sourceWidth = this.frameWidth || Math.floor(this.image.naturalWidth / this.frameCount);
    const sourceHeight = this.frameHeight || this.image.naturalHeight;
    const animation = animationName ? this.getAnimation(animationName) : this.currentAnimation;

    if (animation) {
      const frameIndex = this.getFrameIndex(time, animation);
      const sx = (animation.column + frameIndex) * sourceWidth;
      const sy = animation.row * sourceHeight;
      return { sx, sy, sourceWidth, sourceHeight };
    }

    const frameIndex = this.getFrameIndex(time);
    const framesPerRow = Math.max(1, Math.floor(this.image.naturalWidth / sourceWidth));
    const sx = (frameIndex % framesPerRow) * sourceWidth;
    const sy = Math.floor(frameIndex / framesPerRow) * sourceHeight;

    return { sx, sy, sourceWidth, sourceHeight };
  }

  draw(ctx, size, options = {}) {
    if (!this.ready) return false;
    if (options.animation) this.play(options.animation, options.time, { restart: options.restartAnimation });

    const { sx, sy, sourceWidth, sourceHeight } = this.getSourceRect(options.time, options.animation);
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
    if (options.animation) this.play(options.animation, options.time, { restart: options.restartAnimation });

    const { sx, sy, sourceWidth, sourceHeight } = this.getSourceRect(options.time, options.animation);
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
    if (options.animation) this.play(options.animation, options.time, { restart: options.restartAnimation });

    const { sx, sy, sourceWidth, sourceHeight } = this.getSourceRect(options.time, options.animation);
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
  player: createAnimatedSprite({
    image: 'assets/sprites/player_ship.png',
    frameWidth: 16,
    frameHeight: 18,
    frameCount: 3,
    fps: 5,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 5 }
    }
  }),
  enemyNormal: createAnimatedSprite({
    image: 'assets/sprites/enemy_normal_ship.png',
    frameWidth: 16,
    frameHeight: 18,
    frameCount: 3,
    fps: 5,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 5 }
    }
  }),
  enemyShotgun: createAnimatedSprite({
    image: 'assets/sprites/enemy_shotgun_ship.png',
    frameWidth: 16,
    frameHeight: 18,
    frameCount: 3,
    fps: 5,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 5 }
    }
  }),
  enemyMachineGun: createAnimatedSprite({
    image: 'assets/sprites/enemy_machine_gun_ship.png',
    frameWidth: 16,
    frameHeight: 18,
    frameCount: 3,
    fps: 8,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 8 }
    }
  }),
  asteroid: loadSprite('assets/sprites/asteroid_1.png'),
  hullPickup: loadSprite('assets/sprites/hull_pickup.png'),
  playerBullet: loadSprite('assets/sprites/player_bullet.png'),
  enemyBullet: loadSprite('assets/sprites/enemy_bullet.png'),
  universeBackground: createAnimatedSprite({
    image: 'assets/sprites/universe_background.png',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 2,
    fps: 2,
    defaultAnimation: 'starryLoop',
    animations: {
      starryLoop: { row: 0, frames: 2, fps: 2 }
    }
  })
};

function createAnimatedSprite(options = {}) {
  return new SpriteAnimation(options);
}

function loadSprite(src, options = {}) {
  return createAnimatedSprite({ ...options, image: src });
}

function playPixelArtAnimation(sprite, name, time = 0, options = {}) {
  return sprite?.play(name, time, options) || false;
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