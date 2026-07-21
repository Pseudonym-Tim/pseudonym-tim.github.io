// Sprite loading, animation, and pixel-art stuff...
class SpriteAnimation {
  constructor(srcOrOptions, options = {}) {
    const isImageElement = typeof HTMLImageElement !== 'undefined' && srcOrOptions instanceof HTMLImageElement;
    const config = typeof srcOrOptions === 'object' && srcOrOptions !== null && !isImageElement ? srcOrOptions : { ...options, image: srcOrOptions };

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
    if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
      return image;
    }

    const spriteImage = new Image();
    if (image) {
      spriteImage.src = image;
    }

    return spriteImage;
  }

  // This is kinda horrendous...
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
    if (!this.animations[name]) {
      return false;
    }

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
    if (frameCount <= 1) {
      return 0;
    }

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
    if (!this.ready) {
      return false;
    }

    if (options.animation) {
      this.play(options.animation, options.time, { restart: options.restartAnimation });
    }

    const { sx, sy, sourceWidth, sourceHeight } = this.getSourceRect(options.time, options.animation);

    // Normalize before affecting requested size... fractional scale values are not valid for pixel art...
    const requestedScale = Math.max(1, pixelSnap(options.scale ?? 1));

    const naturalSize = Math.max(sourceWidth, sourceHeight);

    // A pixel-art image may only be enlarged by a whole-number multiplier...
    // Rounding the destination bounds alone avoids blur, but still gives source
    // pixels uneven widths, this preserves both aspect ratio and pixel cadence...
    const pixelScale = Math.max(1, pixelSnap(options.pixelScale ?? (size * requestedScale) / naturalSize));
    const drawWidth = sourceWidth * pixelScale;
    const drawHeight = sourceHeight * pixelScale;
    const drawX = -Math.floor(drawWidth / 2);
    const drawY = -Math.floor(drawHeight / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (options.alpha !== undefined) {
      ctx.globalAlpha *= options.alpha;
    }

    ctx.drawImage(this.image, sx, sy, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);

    const flashAlpha = clamp(options.flashAlpha ?? 0, 0, 1);

    if (flashAlpha > 0) {
      const flashCanvas = SpriteAnimation.getFlashCanvas(sourceWidth, sourceHeight);
      const flashCtx = flashCanvas?.getContext('2d');

      if (flashCtx) {
        flashCtx.clearRect(0, 0, sourceWidth, sourceHeight);
        flashCtx.imageSmoothingEnabled = false;
        flashCtx.globalCompositeOperation = 'source-over';
        flashCtx.globalAlpha = 1;
        flashCtx.drawImage(this.image, sx, sy, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
        flashCtx.globalCompositeOperation = 'source-in';
        flashCtx.fillStyle = '#ffffff';
        flashCtx.fillRect(0, 0, sourceWidth, sourceHeight);
        flashCtx.globalCompositeOperation = 'source-over';

        ctx.globalAlpha *= flashAlpha;
        ctx.drawImage(flashCanvas, 0, 0, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
      }
    }

    ctx.restore();

    return true;
  }

  static getFlashCanvas(width, height) {
    if (typeof document === 'undefined') {
      return null;
    }

    if (!SpriteAnimation.flashCanvas) {
      SpriteAnimation.flashCanvas = document.createElement('canvas');
    }

    if (SpriteAnimation.flashCanvas.width !== width) {
      SpriteAnimation.flashCanvas.width = width;
    }

    if (SpriteAnimation.flashCanvas.height !== height) {
      SpriteAnimation.flashCanvas.height = height;
    }

    return SpriteAnimation.flashCanvas;
  }

  drawFrame(ctx, x, y, width, height, options = {}) {
    if (!this.ready) {
      return false;
    }

    if (options.animation) {
      this.play(options.animation, options.time, { restart: options.restartAnimation });
    }

    const { sx, sy, sourceWidth, sourceHeight } = this.getSourceRect(options.time, options.animation);
    const requestedScale = Math.max(1, pixelSnap(options.scale ?? 1));
    const pixelScale = Math.max(1, pixelSnap(options.pixelScale ?? (width * requestedScale) / sourceWidth));
    const drawWidth = sourceWidth * pixelScale;
    const drawHeight = sourceHeight * pixelScale;
    const drawX = pixelSnap(x);
    const drawY = pixelSnap(y);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (options.alpha !== undefined) {
      ctx.globalAlpha *= options.alpha;
    }

    ctx.drawImage(this.image, sx, sy, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);

    const flashAlpha = clamp(options.flashAlpha ?? 0, 0, 1);

    if (flashAlpha > 0) {
      const flashCanvas = SpriteAnimation.getFlashCanvas(sourceWidth, sourceHeight);
      const flashCtx = flashCanvas?.getContext('2d');

      if (flashCtx) {
        flashCtx.clearRect(0, 0, sourceWidth, sourceHeight);
        flashCtx.imageSmoothingEnabled = false;
        flashCtx.globalCompositeOperation = 'source-over';
        flashCtx.globalAlpha = 1;
        flashCtx.drawImage(this.image, sx, sy, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
        flashCtx.globalCompositeOperation = 'source-in';
        flashCtx.fillStyle = '#ffffff';
        flashCtx.fillRect(0, 0, sourceWidth, sourceHeight);
        flashCtx.globalCompositeOperation = 'source-over';

        ctx.globalAlpha *= flashAlpha;
        ctx.drawImage(flashCanvas, 0, 0, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
      }
    }

    ctx.restore();

    return true;
  }

  drawTiled(ctx, x, y, width, height, options = {}) {
    if (!this.ready) {
      return false;
    }

    if (options.animation) {
      this.play(options.animation, options.time, { restart: options.restartAnimation });
    }

    const { sx, sy, sourceWidth, sourceHeight } = this.getSourceRect(options.time, options.animation);
    const scale = Math.max(0.0001, options.scale ?? 1);
    const tileWidth = Math.max(1, pixelSnap((options.tileWidth || sourceWidth) * scale));
    const tileHeight = Math.max(1, pixelSnap((options.tileHeight || sourceHeight) * scale));

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    
    if (options.alpha !== undefined) {
      ctx.globalAlpha *= options.alpha;
    }

    for (let tileY = y; tileY < y + height; tileY += tileHeight) {
      for (let tileX = x; tileX < x + width; tileX += tileWidth) {
        const drawWidth = Math.min(tileWidth, x + width - tileX);
        const drawHeight = Math.min(tileHeight, y + height - tileY);

        ctx.drawImage(this.image, sx, sy, Math.floor((drawWidth / tileWidth) * sourceWidth), Math.floor((drawHeight / tileHeight) * sourceHeight), tileX, tileY, drawWidth, drawHeight);
      }
    }

    ctx.restore();
    return true;
  }
}

const pixelArt = {
  player: createAnimatedSprite({
    image: 'assets/sprites/player_ship.png',
    frameWidth: 18,
    frameHeight: 22,
    frameCount: 3,
    fps: 5,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 5 }
    }
  }),
  enemyNormal: createAnimatedSprite({
    image: 'assets/sprites/enemy_normal_ship.png',
    frameWidth: 20,
    frameHeight: 22,
    frameCount: 3,
    fps: 5,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 5 }
    }
  }),
  enemyShotgun: createAnimatedSprite({
    image: 'assets/sprites/enemy_shotgun_ship.png',
    frameWidth: 20,
    frameHeight: 24,
    frameCount: 3,
    fps: 5,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 5 }
    }
  }),
  enemyMachineGun: createAnimatedSprite({
    image: 'assets/sprites/enemy_machine_gun_ship.png',
    frameWidth: 20,
    frameHeight: 22,
    frameCount: 3,
    fps: 8,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 8 }
    }
  }),
  enemyDoubleShot: createAnimatedSprite({
    image: 'assets/sprites/enemy_double_shot_ship.png',
    frameWidth: 20,
    frameHeight: 22,
    frameCount: 3,
    fps: 6,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 6 }
    }
  }),
  enemyChargeSniper: createAnimatedSprite({
    image: 'assets/sprites/enemy_sniper_ship.png',
    frameWidth: 20,
    frameHeight: 22,
    frameCount: 3,
    fps: 5,
    defaultAnimation: 'idle',
    animations: {
      idle: { row: 0, frames: 3, fps: 5 }
    }
  }),
  bossDreadnought: {
    intact: createAnimatedSprite({
      image: 'assets/sprites/boss/boss_dreadnought_intact.png',
      frameWidth: 96,
      frameHeight: 66,
      frameCount: 1,
      fps: 1,
      defaultAnimation: 'idle',
      animations: { idle: { row: 0, frames: 1, fps: 1 } }
    }),
    leftLauncherBroken: createAnimatedSprite({
      image: 'assets/sprites/boss/boss_dreadnought_left_launcher_broken.png',
      frameWidth: 96,
      frameHeight: 66,
      frameCount: 1,
      fps: 1,
      defaultAnimation: 'idle',
      animations: { idle: { row: 0, frames: 1, fps: 1 } }
    }),
    rightLauncherBroken: createAnimatedSprite({
      image: 'assets/sprites/boss/boss_dreadnought_right_launcher_broken.png',
      frameWidth: 96,
      frameHeight: 66,
      frameCount: 1,
      fps: 1,
      defaultAnimation: 'idle',
      animations: { idle: { row: 0, frames: 1, fps: 1 } }
    }),
    bothLaunchersBroken: createAnimatedSprite({
      image: 'assets/sprites/boss/boss_dreadnought_both_launchers_broken.png',
      frameWidth: 96,
      frameHeight: 66,
      frameCount: 1,
      fps: 1,
      defaultAnimation: 'idle',
      animations: { idle: { row: 0, frames: 1, fps: 1 } }
    })
  },
  asteroids: {
    big: [
      loadSprite('assets/sprites/asteroid_big_1.png'),
      loadSprite('assets/sprites/asteroid_big_2.png'),
      loadSprite('assets/sprites/asteroid_big_3.png')
    ],
    small: [
      //loadSprite('assets/sprites/asteroid_small_1.png'), // (This one is a bit TOO small)...
      loadSprite('assets/sprites/asteroid_small_2.png'),
      loadSprite('assets/sprites/asteroid_small_3.png')
    ]
  },  
  explosionFX: createAnimatedSprite({
    image: 'assets/sprites/explosion_fx.png',
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 5,
    fps: 10,
    loop: false,
    defaultAnimation: 'explode',
    animations: {
      explode: { row: 0, frames: 5, fps: 10, loop: false }
    }
  }),
  hullPickup: loadSprite('assets/sprites/hull_pickup.png'),
  playerBullet: loadSprite('assets/sprites/player_bullet.png'),
  enemyBullet: loadSprite('assets/sprites/enemy_bullet.png'),
  bossShotgunBullet: loadSprite('assets/sprites/boss_shotgun_bullet.png'),
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

function drawPixelArt(ctx, sprite, sizeOrOptions, options = {}) {
  const hasExplicitOptions = typeof sizeOrOptions === 'object';
  const drawOptions = hasExplicitOptions ? sizeOrOptions : options;
  const size = hasExplicitOptions ? Math.max(sprite?.frameWidth || 1, sprite?.frameHeight || 1) : sizeOrOptions;
  return sprite?.draw(ctx, size, drawOptions) || false;
}

function drawPixelArtFrame(ctx, sprite, x, y, width, height, options = {}) {
  return sprite?.drawFrame(ctx, x, y, width, height, options) || false;
}

function drawPixelArtTiled(ctx, sprite, x, y, width, height, options = {}) {
  return sprite?.drawTiled(ctx, x, y, width, height, options) || false;
}
