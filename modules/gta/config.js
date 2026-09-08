const path = require('path');

module.exports = {

  channelId:
    '1546773502336442420',

  checkInterval:
    15 * 60 * 1000,

  color:
    0xF2A900,

  newswireUrl:
    'https://www.rockstargames.com/newswire',

  frenchNewswireUrl:
    'https://www.rockstargames.com/fr/newswire',

  maxCandidates:
    25,

  stateFile:
    path.join(
      __dirname,
      '..',
      '..',
      'data',
      'gta-update-state.json'
    )

};
