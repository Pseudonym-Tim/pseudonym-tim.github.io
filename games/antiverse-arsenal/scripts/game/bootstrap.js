// Browser entry point...
window.addEventListener('load', async () => {
  await loadGameText();
  applyStaticText();
  spawnBanner.innerHTML = formatText('spawn.nextUniverseIn', { seconds: '<span id="spawn-timer">10</span>' });
  const game = new Game();

  const refreshMenuHighscore = () => {
    mainMenuHighscore.textContent = formatText('menu.highscore', { value: Math.floor(game.highscore) });
  };

  game.refreshMenuHighscore = refreshMenuHighscore;
  refreshMenuHighscore();
  focusOverlay.classList.remove('hidden');
  startGameButton.focus();

  let starting = false;

  const beginGame = async () => {
    if (starting || game.running) {
      return;
    }

    starting = true;
    startGameButton.disabled = true;
    await game.enterFullscreenMode();
    game.start();
    startGameButton.disabled = false;
    starting = false;
  };

  startGameButton.addEventListener('click', beginGame);
  mainMenuControlsButton.addEventListener('click', () => game.showControlsPanel(mainMenuControlsButton));
});
