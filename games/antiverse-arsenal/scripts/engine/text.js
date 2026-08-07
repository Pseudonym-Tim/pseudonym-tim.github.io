// Text loading and formatting...
const DEFAULT_GAME_TEXT = {};
let gameText = DEFAULT_GAME_TEXT;

function formatText(key, placeholders = {}) {
  const template = gameText[key] ?? DEFAULT_GAME_TEXT[key] ?? key;
  const formatted = template.replace(/%([a-zA-Z0-9_]+)%/g, (match, name) => (Object.prototype.hasOwnProperty.call(placeholders, name) ? String(placeholders[name]) : match));
  return formatted;
}

async function loadGameText() {
  try {
    const response = await fetch('assets/text.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load text.json: ${response.status}`);
    }

    gameText = await response.json();
  } catch (error) {
    console.error(error);
  }
}

function applyStaticText() {
  document.title = formatText('page.title');
  focusTitle.textContent = formatText('menu.title');
  startGameButton.textContent = formatText('menu.start');
  mainMenuControlsButton.textContent = formatText('menu.controls');

  document.getElementById('controls-title').textContent = formatText('controls.title');
  document.getElementById('control-move').textContent = formatText('controls.move');
  document.getElementById('control-aim').textContent = formatText('controls.aim');
  document.getElementById('control-fire').textContent = formatText('controls.fire');
  document.getElementById('control-dash').textContent = formatText('controls.dash');
  document.getElementById('control-warp').textContent = formatText('controls.warp');
  document.getElementById('control-laser').textContent = formatText('controls.laser');
  document.getElementById('control-drag').textContent = formatText('controls.drag');
  document.getElementById('control-swap').textContent = formatText('controls.swap');
  controlsBackButton.textContent = formatText('controls.back');

  document.getElementById('shop-title').textContent = formatText('shop.title');
  document.getElementById('shop-subtitle').textContent = formatText('shop.subtitle');
  shopContinueButton.textContent = formatText('shop.continue');
  document.getElementById('gameover-title').textContent = formatText('gameover.title');
  restartButton.textContent = formatText('gameover.restart');
  multiverseCompleteTitle.textContent = formatText('multiverseComplete.title', { value: 1 });
  multiverseCompleteContinueButton.textContent = formatText('multiverseComplete.continue');
  pauseTitle.textContent = formatText('pause.title');
  resumeButton.textContent = formatText('pause.resume');
  controlsButton.textContent = formatText('pause.controls');
  pauseRestartButton.textContent = formatText('pause.restart');
  quitButton.textContent = formatText('pause.quit');
}