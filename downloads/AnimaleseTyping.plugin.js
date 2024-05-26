/**
 * @name AnimaleseTyping
 * @version 1.0
 * @description Play animal crossing villager sounds whenever you type!
 * @author Pseudonym_Tim
 * @authorId 303267633338253313
 */

module.exports = (() => {
    const config = {
      info: {
        name: 'AnimaleseTyping',
        authors: [
          {
            name: 'Pseudonym_Tim',
            discord_id: '303267633338253313',
          }
        ],
        version: '1.0',
        description: 'Play animal crossing villager sounds whenever you type!',
      },
      defaultConfig: [
        {
          type: 'slider',
          id: 'volume',
          name: 'Volume',
          note: 'Change the volume of animalese typing sounds',
          value: 30,
          min: 0,
          max: 100,
          markers: Array.from(Array(11), (_, i) => 10 * i),
          stickToMarkers: true
        },
        {
            type: 'slider',
            id: 'pitch',
            name: 'Pitch',
            note: 'Change the pitch of animalese typing sounds',
            value: 100,
            min: 0,
            max: 100,
            markers: Array.from(Array(11), (_, i) => 10 * i),
            stickToMarkers: true
          },
        {
          type: 'textbox',
          id: 'exceptions',
          name: 'Animalese Key Exceptions (Requires Reload)',
          note: 'To prevent keys from producing animalese typing sounds, you can specify the keys you want to exclude by adding them to the list. Use JavaScript KeyboardEvent codes. You can grab keycodes using this handy website: [https://keyjs.dev/]',
          value: ',,ControlLeft,ControlRight,ShiftLeft,ShiftRight,AltLeft,AltRight,ArrowUp,ArrowRight,ArrowLeft,ArrowDown,CapsLock,MetaLeft,MetaRight,MediaPlayPause,'
        }
      ]
    };
  
    return !global.ZeresPluginLibrary ? class {
  
      constructor() { this._config = config; }
      getName() { return config.info.name; }
      getAuthor() { return config.info.authors.map(a => a.name).join(', '); }
      getDescription() { return config.info.description; }
      getVersion() { return config.info.version; }
      load() {
        BdApi.showConfirmationModal('Library Missing', `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
          confirmText: 'Download Now',
          cancelText: 'Cancel',
          onConfirm: () => {
            require('request').get('https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js', async (error, response, body) => {
              if (error) return require('electron').shell.openExternal('https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js');
              await new Promise(r => require('fs').writeFile(require('path').join(BdApi.Plugins.folder, '0PluginLibrary.plugin.js'), body, r));
            });
          }
        });
      }
      start() {
        
      }
      stop() { }
  
    } : (([Plugin, Api]) => {
      const plugin = (Plugin, Api) => {
        const { DiscordModules } = Api;
        const { DiscordConstants } = DiscordModules;
  
        const letterLengths = {
          A: 0.157,
          B: 0.161,
          C: 0.090,
          D: 0.159,
          E: 0.095,
          F: 0.097,
          G: 0.096,
          H: 0.093,
          I: 0.159,
          J: 0.098,
          K: 0.1,
          L: 0.158,
          M: 0.157,
          N: 0.158,
          O: 0.095,
          P: 0.097,
          Q: 0.094,
          R: 0.156,
          S: 0.157,
          T: 0.098,
          U: 0.161,
          V: 0.098,
          W: 0.160,
          X: 0.096,
          Y: 0.097,
          Z: 0.160,
        };
  
        return class AnimaleseTyping extends Plugin {
          constructor() {
            super();
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.letterLength = 0.15; // Default letter length
            this.pitch = this.settings.pitch / 100;; // Pitch adjustment
            this.keyExceptions = this.settings.exceptions.split(',');
            this.volume = this.settings.volume / 100;
            this.letterLibrary = null;
            this.source = null;
          }
  
          async onStart() {
            let response = await fetch('https://dl.dropboxusercontent.com/s/r5fyhhmapc4ivm8/animalese.wav?raw=1');
            let buffer = await response.arrayBuffer();
            this.letterLibrary = await this.context.decodeAudioData(buffer);
  
            document.addEventListener('keydown', this.onKeydown);
          }
  
          onKeydown = (event) => {
            // Ignore if the key is an exception...
            if (this.keyExceptions.includes(event.code)) {
              return;
            }
  
            // Check if the key is a letter or digit...
            if (!/^[A-Za-z0-9]$/.test(event.key)) {
              return;
            }
  
            // Get the character code of the key
            let charCode = event.key.toUpperCase().charCodeAt(0);
  
            // Check if the key is a letter and if a custom length is defined
            const letter = String.fromCharCode(charCode);
            if (charCode >= 65 && charCode <= 90 && letterLengths.hasOwnProperty(letter)) {
              this.letterLength = letterLengths[letter];
            }
  
            // Calculate the start time of the letter in the audio buffer
            let startTime = 0;
            for (let i = 65; i < charCode; i++) {
              const prevLetter = String.fromCharCode(i);
              if (letterLengths.hasOwnProperty(prevLetter)) {
                startTime += letterLengths[prevLetter];
              } else {
                startTime += 0.15; // Default letter length...
              }
            }
  
            // Calculate the end time based on the start time and letter length
            let endTime = startTime + this.letterLength;
  
            // Create a buffer source and set the buffer to the letter library
            this.source = this.context.createBufferSource();
            this.source.buffer = this.letterLibrary;
  
            // Set the playback rate to adjust the pitch
            this.source.playbackRate.value = this.pitch;
  
            // Adjust volume
            let gainNode = this.context.createGain();
            gainNode.gain.value = this.volume;
            this.source.connect(gainNode);
            gainNode.connect(this.context.destination);
  
            // Start playing
            this.source.start(0, startTime, endTime - startTime);
          };
  
          onStop() {
            document.removeEventListener('keydown', this.onKeydown);
  
            // Stop the audio source, if any
            if (this.source && this.source.stop) {
              this.source.stop();
            }
          }
  
          changeVolume() {
            this.volume = this.settings.volume / 100;
            
            if (this.source) {
              let gainNode = this.context.createGain();
              gainNode.gain.value = this.volume;
              this.source.disconnect();
              this.source.connect(gainNode);
              gainNode.connect(this.context.destination);
            }
          }

          changePitch() {
            this.pitch = this.settings.pitch / 100;
          }
  
          createExceptions() {
            return this.settings.exceptions.split(",");
          }
  
          getSettingsPanel() {
            const panel = this.buildSettingsPanel();
  
            panel.addListener((id) => {
              if (id == "volume") {
                this.changeVolume();
              } else if (id == "exceptions") {
                this.createExceptions();
              } else if(id == "pitch"){
                this.changePitch();
              }
            });
  
            return panel.getElement();
          }
        };
      };
  
      return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
  })();
  