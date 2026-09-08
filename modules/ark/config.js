const path = require('path');

module.exports = {
  channelId: '1546773481587216425',
  checkInterval: 15 * 60 * 1000,
  color: 0x5B8C3A,

  stateFile: path.join(
    __dirname,
    '..',
    '..',
    'data',
    'ark-update-state.json'
  ),

  // Ancien emplacement utilisé par ton bot avant le découpage en modules.
  legacyStateFile: path.join(
    __dirname,
    '..',
    '..',
    'ark-update-state.json'
  ),

  platforms: {
    pc: {
      name: 'PC',
      emoji: '🖥️',
      url: 'https://survivetheark.com/index.php?/forums/topic/708761-asa-pc-patch-notes/'
    },

    xbox: {
      name: 'Xbox',
      emoji: '🟩',
      url: 'https://survivetheark.com/index.php?/forums/topic/715262-asa-xbox-patch-notes/'
    },

    playstation: {
      name: 'PlayStation',
      emoji: '🟦',
      url: 'https://survivetheark.com/index.php?/forums/topic/715265-asa-playstation-patch-notes/'
    },

    server: {
      name: 'Serveurs',
      emoji: '🌐',
      url: 'https://survivetheark.com/index.php?/forums/topic/773786-asa-server-patch-notes/'
    }
  }
};
