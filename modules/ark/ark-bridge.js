function startArkBridge(client) {
  console.log('🦖 ARK Bridge : module chargé');

  /*
    Pour le moment, ce module ne lit pas encore
    les sauvegardes ARK.

    Plus tard il recevra les données envoyées
    par le programme local installé sur le PC
    du joueur.
  */

  client.arkBridge = {
    players: new Map()
  };
}

module.exports = startArkBridge;
