const path = require('path');

module.exports = {
  channelId: '1546773502336442420',
  checkInterval: 15 * 60 * 1000,
  color: 0xF2A900,

  newswireUrl:
    'https://www.rockstargames.com/newswire',

  frenchNewswireBase:
    'https://www.rockstargames.com/fr/newswire/',

  stateFile: path.join(
    __dirname,
    '..',
    '..',
    'data',
    'gta-update-state.json'
  ),

  // Nombre maximum d’articles récents inspectés à chaque passage.
  maxCandidates: 20,

  // GTA VI est volontairement exclu.
  acceptedTerms: [
    'gta online',
    'grand theft auto online',
    'grand theft auto v',
    'gtav',
    'gta v'
  ]
};
