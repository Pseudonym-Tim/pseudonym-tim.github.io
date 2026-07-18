// Browser entry point...
window.addEventListener('load', async () => {
  await loadGameText();
  applyStaticText();
  spawnBanner.innerHTML = formatText('spawn.nextUniverseIn', { seconds: '<span id="spawn-timer">10</span>' });
  const game = new Game();

  focusOverlay.classList.remove('hidden');
  focusOverlay.focus();

  let focusStarted = false;

  const beginFocusedGame = async () => {
    if (focusStarted) {
      return;
    }

    focusStarted = true;
    document.body.classList.remove('focus-pending');
    focusOverlay.classList.add('hidden');
    await game.enterFullscreenMode();
    game.start();
  };

  focusOverlay.addEventListener('click', beginFocusedGame);

  focusOverlay.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'Space') {
      return;
    }

    e.preventDefault();
    beginFocusedGame();
  });
});