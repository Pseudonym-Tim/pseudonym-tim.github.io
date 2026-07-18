// Round messages...
Object.assign(Game.prototype, {
  clearMessageTimer() {
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.messageTimeout = null;
    this.messageExpiresAt = 0;
  },

  scheduleMessageHide(token, duration) {
    this.clearMessageTimer();
    this.messageRemainingMs = Math.max(0, duration);
    this.messageExpiresAt = performance.now() + this.messageRemainingMs;

    this.messageTimeout = setTimeout(() => {
      this.messageTimeout = null;

      if (token !== this.messageToken) {
        return;
      }

      messageOverlay.classList.add('hidden');
      this.messageExpiresAt = 0;
      this.messageRemainingMs = 0;
    }, this.messageRemainingMs);
  },

  pauseMessageTimer() {
    if (!this.messageTimeout) {
      return;
    }

    this.messageRemainingMs = Math.max(0, this.messageExpiresAt - performance.now());
    this.clearMessageTimer();
  },

  resumeMessageTimer() {
    if (messageOverlay.classList.contains('hidden') || this.messageRemainingMs <= 0) {
      return;
    }

    this.scheduleMessageHide(this.messageToken, this.messageRemainingMs);
  },

  showMessage(text, duration = 1000) {
    const token = ++this.messageToken;
    messageText.textContent = text;
    messageOverlay.classList.remove('hidden');
    messageOverlay.classList.remove('message-enter');
    void messageOverlay.offsetWidth;
    messageOverlay.classList.add('message-enter');

    this.clearMessageTimer();

    if (this.paused) {
      this.messageRemainingMs = Math.max(0, duration);
      return;
    }

    this.scheduleMessageHide(token, duration);
  },

  flashMessage(text, duration = 400) {
    this.showMessage(text, duration);
  }
});