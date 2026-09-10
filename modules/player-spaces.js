const {
  ChannelType
} = require('discord.js');

// ============================================================
// NARU GAMING COMMAND
// PLAYER SPACES — GESTIONNAIRE GÉNÉRAL
// ============================================================

// ─────────────────────────────
// ARK
// ─────────────────────────────

const {
  createArkPlayerSpace,
  deleteArkPlayerSpace
} =
  require('./ark/player-spaces');

// ─────────────────────────────
// GTA V
// ─────────────────────────────

const {
  createGtaPlayerSpace,
  deleteGtaPlayerSpace
} =
  require('./gta/player-spaces');

// ─────────────────────────────
// ATS / ETS2
// ─────────────────────────────

const {
  createPlayerSpace:
    createAtsEtsPlayerSpace,

  deletePlayerSpace:
    deleteAtsEtsPlayerSpace
} =
  require('./ATS-ETS/player-spaces');

// ============================================================
// RÔLES
// ============================================================

const ARK_ROLE_ID =
  process.env.ARK_ROLE_ID;

const GTA_ROLE_ID =
  '1546760047105806366';

const ATS_ROLE_ID =
  '1546760053741064242';

const ETS2_ROLE_ID =
  '1546760060879765544';

// ============================================================
// CATÉGORIES PRINCIPALES
// ============================================================

const ARK_MAIN_CATEGORY_ID =
  '1546771818596139059';

const GTA_MAIN_CATEGORY_ID =
  '1546772954447089765';

const ATS_MAIN_CATEGORY_ID =
  '1546773656615526520';

const ETS2_MAIN_CATEGORY_ID =
  '1546774027144532068';

// ============================================================
// CONFIGURATION JEUX
// ============================================================

const ATS_GAME = {
  key:
    'ats',

  name:
    'American Truck Simulator',

  shortName:
    'ATS',

  roleId:
    ATS_ROLE_ID,

  categoryEmoji:
    '🇺🇸'
};

const ETS2_GAME = {
  key:
    'ets2',

  name:
    'Euro Truck Simulator 2',

  shortName:
    'ETS2',

  roleId:
    ETS2_ROLE_ID,

  categoryEmoji:
    '🇪🇺'
};

// ============================================================
// CONFIGURATION DU RANGEMENT
// ============================================================

const SPACE_LAYOUTS = {
  ark: {
    key:
      'ark',

    name:
      'ARK',

    emoji:
      '🦖',

    mainCategoryId:
      ARK_MAIN_CATEGORY_ID,

    matches:
      category =>
        category.name.startsWith(
          '🦖 ARK — '
        )
  },

  gta: {
    key:
      'gta',

    name:
      'GTA V',

    emoji:
      '🚘',

    mainCategoryId:
      GTA_MAIN_CATEGORY_ID,

    matches:
      category =>
        category.name.startsWith(
          '🚘 GTA V — '
        )
  },

  ats: {
    key:
      'ats',

    name:
      'ATS',

    emoji:
      '🇺🇸',

    mainCategoryId:
      ATS_MAIN_CATEGORY_ID,

    matches:
      category => {
        const name =
          category.name
            .toLowerCase();

        return (
          name.endsWith(
            '-ats'
          ) &&
          category.id !==
            ATS_MAIN_CATEGORY_ID
        );
      }
  },

  ets2: {
    key:
      'ets2',

    name:
      'ETS2',

    emoji:
      '🇪🇺',

    mainCategoryId:
      ETS2_MAIN_CATEGORY_ID,

    matches:
      category => {
        const name =
          category.name
            .toLowerCase();

        return (
          name.endsWith(
            '-ets2'
          ) &&
          category.id !==
            ETS2_MAIN_CATEGORY_ID
        );
      }
  }
};

// ============================================================
// FILE D'ATTENTE
// ============================================================

const memberQueues =
  new Map();

let layoutQueue =
  Promise.resolve();

// ============================================================
// OUTILS
// ============================================================

function sleep(
  ms
) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function isUsableMember(
  member
) {
  return Boolean(
    member &&
    member.user &&
    !member.user.bot
  );
}

function hasRole(
  member,
  roleId
) {
  if (
    !member ||
    !roleId
  ) {
    return false;
  }

  return member.roles.cache.has(
    roleId
  );
}

function normalizeName(
  value
) {
  return String(
    value || ''
  )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase();
}

// ============================================================
// FILE D'ATTENTE PAR JOUEUR
// ============================================================

async function queueMemberTask(
  memberId,
  task
) {
  const previous =
    memberQueues.get(
      memberId
    ) ||
    Promise.resolve();

  const next =
    previous
      .catch(
        () => {}
      )
      .then(
        task
      );

  memberQueues.set(
    memberId,
    next
  );

  try {
    await next;
  } finally {
    if (
      memberQueues.get(
        memberId
      ) ===
      next
    ) {
      memberQueues.delete(
        memberId
      );
    }
  }
}

// ============================================================
// FILE D'ATTENTE POUR LE RANGEMENT
// ============================================================

async function queueLayoutTask(
  task
) {
  const next =
    layoutQueue
      .catch(
        () => {}
      )
      .then(
        task
      );

  layoutQueue =
    next;

  await next;
}

// ============================================================
// TROUVER LES CATÉGORIES PLAYER SPACE
// ============================================================

function findPlayerCategories(
  guild,
  layout
) {
  return Array.from(
    guild.channels.cache.values()
  )
    .filter(
      channel =>
        channel.type ===
          ChannelType.GuildCategory &&
        channel.id !==
          layout.mainCategoryId &&
        layout.matches(
          channel
        )
    )
    .sort(
      (
        a,
        b
      ) =>
        normalizeName(
          a.name
        ).localeCompare(
          normalizeName(
            b.name
          ),
          'fr'
        )
    );
}

// ============================================================
// RANGER UN JEU
// ============================================================

async function reorderGameSpaces(
  guild,
  gameKey
) {
  const layout =
    SPACE_LAYOUTS[
      gameKey
    ];

  if (
    !layout
  ) {
    return;
  }

  const mainCategory =
    guild.channels.cache.get(
      layout.mainCategoryId
    );

  if (
    !mainCategory
  ) {
    console.warn(
      `⚠️ ${layout.name} : catégorie principale introuvable (${layout.mainCategoryId}).`
    );

    return;
  }

  if (
    mainCategory.type !==
    ChannelType.GuildCategory
  ) {
    console.warn(
      `⚠️ ${layout.name} : l'ID principal ne correspond pas à une catégorie Discord.`
    );

    return;
  }

  const playerCategories =
    findPlayerCategories(
      guild,
      layout
    );

  if (
    playerCategories.length ===
    0
  ) {
    return;
  }

  console.log(
    `${layout.emoji} Rangement ${layout.name} : ${playerCategories.length} espace(s)...`
  );

  let targetPosition =
    mainCategory.position +
    1;

  for (
    const category
    of playerCategories
  ) {
    try {
      await category.setPosition(
        targetPosition,
        {
          reason:
            `Naru Gaming Command — rangement Player Spaces ${layout.name}`
        }
      );

      targetPosition++;

      await sleep(
        250
      );

    } catch (error) {
      console.error(
        `❌ Impossible de déplacer ${category.name} :`,
        error.message
      );
    }
  }

  console.log(
    `✅ ${layout.name} : catégories rangées.`
  );
}

// ============================================================
// RANGER TOUS LES JEUX
// ============================================================

async function reorderAllPlayerSpaces(
  guild
) {
  await queueLayoutTask(
    async () => {
      console.log('');
      console.log(
        `🗂️ Rangement des Player Spaces sur ${guild.name}...`
      );

      // IMPORTANT :
      // On fait les blocs du bas vers le haut.
      //
      // Comme déplacer une catégorie peut modifier
      // les positions des autres catégories,
      // cet ordre limite les déplacements parasites.

      await reorderGameSpaces(
        guild,
        'ets2'
      );

      await sleep(
        500
      );

      await reorderGameSpaces(
        guild,
        'ats'
      );

      await sleep(
        500
      );

      await reorderGameSpaces(
        guild,
        'gta'
      );

      await sleep(
        500
      );

      await reorderGameSpaces(
        guild,
        'ark'
      );

      console.log(
        '✅ Rangement général des Player Spaces terminé.'
      );
      console.log('');
    }
  );
}

// ============================================================
// RANGER UN SEUL BLOC
// ============================================================

async function reorderOneGame(
  guild,
  gameKey
) {
  await queueLayoutTask(
    async () => {
      await reorderGameSpaces(
        guild,
        gameKey
      );
    }
  );
}

// ============================================================
// SYNCHRONISATION D'UN MEMBRE
// ============================================================

async function syncMember(
  member
) {
  if (
    !isUsableMember(
      member
    )
  ) {
    return;
  }

  // ==========================================================
  // ARK
  // ==========================================================

  if (
    ARK_ROLE_ID &&
    hasRole(
      member,
      ARK_ROLE_ID
    )
  ) {
    await createArkPlayerSpace(
      member
    );
  }

  // ==========================================================
  // GTA
  // ==========================================================

  if (
    hasRole(
      member,
      GTA_ROLE_ID
    )
  ) {
    await createGtaPlayerSpace(
      member
    );
  }

  // ==========================================================
  // ATS
  // ==========================================================

  if (
    hasRole(
      member,
      ATS_ROLE_ID
    )
  ) {
    await createAtsEtsPlayerSpace(
      member,
      ATS_GAME
    );
  }

  // ==========================================================
  // ETS2
  // ==========================================================

  if (
    hasRole(
      member,
      ETS2_ROLE_ID
    )
  ) {
    await createAtsEtsPlayerSpace(
      member,
      ETS2_GAME
    );
  }
}

// ============================================================
// RÉCUPÉRATION UNIQUE DES MEMBRES
// ============================================================

async function fetchGuildMembersOnce(
  guild
) {
  console.log(
    `👥 Player Spaces : récupération des membres de ${guild.name}...`
  );

  try {
    const members =
      await guild.members.fetch();

    console.log(
      `✅ Player Spaces : ${members.size} membre(s) récupéré(s).`
    );

    return members;

  } catch (error) {
    console.warn(
      `⚠️ Player Spaces : récupération complète impossible sur ${guild.name}.`
    );

    console.warn(
      `⚠️ Utilisation du cache Discord (${guild.members.cache.size} membre(s)).`
    );

    console.warn(
      `⚠️ Détail : ${error.message}`
    );

    return guild.members.cache;
  }
}

// ============================================================
// SYNCHRONISATION D'UN SERVEUR
// ============================================================

async function syncGuild(
  guild
) {
  console.log('');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    `🎮 PLAYER SPACES — ${guild.name}`
  );

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  const members =
    await fetchGuildMembersOnce(
      guild
    );

  const realMembers =
    Array.from(
      members.values()
    ).filter(
      member =>
        isUsableMember(
          member
        )
    );

  // ==========================================================
  // COMPTAGE
  // ==========================================================

  let arkCount =
    0;

  let gtaCount =
    0;

  let atsCount =
    0;

  let ets2Count =
    0;

  for (
    const member
    of realMembers
  ) {
    if (
      ARK_ROLE_ID &&
      hasRole(
        member,
        ARK_ROLE_ID
      )
    ) {
      arkCount++;
    }

    if (
      hasRole(
        member,
        GTA_ROLE_ID
      )
    ) {
      gtaCount++;
    }

    if (
      hasRole(
        member,
        ATS_ROLE_ID
      )
    ) {
      atsCount++;
    }

    if (
      hasRole(
        member,
        ETS2_ROLE_ID
      )
    ) {
      ets2Count++;
    }
  }

  console.log(
    `🦖 ARK : ${arkCount} joueur(s)`
  );

  console.log(
    `🚘 GTA V : ${gtaCount} joueur(s)`
  );

  console.log(
    `🇺🇸 ATS : ${atsCount} joueur(s)`
  );

  console.log(
    `🇪🇺 ETS2 : ${ets2Count} joueur(s)`
  );

  // ==========================================================
  // ARK
  // ==========================================================

  console.log('');
  console.log(
    '🦖 Synchronisation ARK...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !ARK_ROLE_ID ||
      !hasRole(
        member,
        ARK_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createArkPlayerSpace(
        member
      );
    } catch (error) {
      console.error(
        `❌ ARK : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation ARK terminée.'
  );

  await sleep(
    750
  );

  // ==========================================================
  // GTA
  // ==========================================================

  console.log('');
  console.log(
    '🚘 Synchronisation GTA V...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !hasRole(
        member,
        GTA_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createGtaPlayerSpace(
        member
      );
    } catch (error) {
      console.error(
        `❌ GTA V : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation GTA V terminée.'
  );

  await sleep(
    750
  );

  // ==========================================================
  // ATS
  // ==========================================================

  console.log('');
  console.log(
    '🇺🇸 Synchronisation ATS...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !hasRole(
        member,
        ATS_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createAtsEtsPlayerSpace(
        member,
        ATS_GAME
      );
    } catch (error) {
      console.error(
        `❌ ATS : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation ATS terminée.'
  );

  await sleep(
    750
  );

  // ==========================================================
  // ETS2
  // ==========================================================

  console.log('');
  console.log(
    '🇪🇺 Synchronisation ETS2...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !hasRole(
        member,
        ETS2_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createAtsEtsPlayerSpace(
        member,
        ETS2_GAME
      );
    } catch (error) {
      console.error(
        `❌ ETS2 : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation ETS2 terminée.'
  );

  // ==========================================================
  // RANGEMENT AUTOMATIQUE
  // ==========================================================

  await sleep(
    1000
  );

  await reorderAllPlayerSpaces(
    guild
  );

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    '✅ PLAYER SPACES SYNCHRONISÉS'
  );

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );
}

// ============================================================
// SYNCHRONISATION DE TOUS LES SERVEURS
// ============================================================

async function syncAllGuilds(
  client
) {
  for (
    const guild
    of client.guilds.cache.values()
  ) {
    await syncGuild(
      guild
    );
  }
}

// ============================================================
// CHANGEMENT DE RÔLE
// ============================================================

async function handleRoleChange(
  oldMember,
  newMember
) {
  if (
    !isUsableMember(
      newMember
    )
  ) {
    return;
  }

  await queueMemberTask(
    newMember.id,
    async () => {
      // ======================================================
      // ARK
      // ======================================================

      if (
        ARK_ROLE_ID
      ) {
        const oldArk =
          hasRole(
            oldMember,
            ARK_ROLE_ID
          );

        const newArk =
          hasRole(
            newMember,
            ARK_ROLE_ID
          );

        if (
          !oldArk &&
          newArk
        ) {
          console.log(
            `🦖 Rôle ARK attribué à ${newMember.user.tag}`
          );

          await createArkPlayerSpace(
            newMember
          );

          await sleep(
            500
          );

          await reorderOneGame(
            newMember.guild,
            'ark'
          );
        }

        if (
          oldArk &&
          !newArk
        ) {
          console.log(
            `🦖 Rôle ARK retiré à ${newMember.user.tag}`
          );

          await deleteArkPlayerSpace(
            newMember
          );

          await sleep(
            500
          );

          await reorderOneGame(
            newMember.guild,
            'ark'
          );
        }
      }

      // ======================================================
      // GTA
      // ======================================================

      const oldGta =
        hasRole(
          oldMember,
          GTA_ROLE_ID
        );

      const newGta =
        hasRole(
          newMember,
          GTA_ROLE_ID
        );

      if (
        !oldGta &&
        newGta
      ) {
        console.log(
          `🚘 Rôle GTA V attribué à ${newMember.user.tag}`
        );

        await createGtaPlayerSpace(
          newMember
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'gta'
        );
      }

      if (
        oldGta &&
        !newGta
      ) {
        console.log(
          `🚘 Rôle GTA V retiré à ${newMember.user.tag}`
        );

        await deleteGtaPlayerSpace(
          newMember
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'gta'
        );
      }

      // ======================================================
      // ATS
      // ======================================================

      const oldAts =
        hasRole(
          oldMember,
          ATS_ROLE_ID
        );

      const newAts =
        hasRole(
          newMember,
          ATS_ROLE_ID
        );

      if (
        !oldAts &&
        newAts
      ) {
        console.log(
          `🇺🇸 Rôle ATS attribué à ${newMember.user.tag}`
        );

        await createAtsEtsPlayerSpace(
          newMember,
          ATS_GAME
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'ats'
        );
      }

      if (
        oldAts &&
        !newAts
      ) {
        console.log(
          `🇺🇸 Rôle ATS retiré à ${newMember.user.tag}`
        );

        await deleteAtsEtsPlayerSpace(
          newMember,
          ATS_GAME
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'ats'
        );
      }

      // ======================================================
      // ETS2
      // ======================================================

      const oldEts2 =
        hasRole(
          oldMember,
          ETS2_ROLE_ID
        );

      const newEts2 =
        hasRole(
          newMember,
          ETS2_ROLE_ID
        );

      if (
        !oldEts2 &&
        newEts2
      ) {
        console.log(
          `🇪🇺 Rôle ETS2 attribué à ${newMember.user.tag}`
        );

        await createAtsEtsPlayerSpace(
          newMember,
          ETS2_GAME
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'ets2'
        );
      }

      if (
        oldEts2 &&
        !newEts2
      ) {
        console.log(
          `🇪🇺 Rôle ETS2 retiré à ${newMember.user.tag}`
        );

        await deleteAtsEtsPlayerSpace(
          newMember,
          ETS2_GAME
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'ets2'
        );
      }
    }
  );
}

// ============================================================
// ARRIVÉE D'UN MEMBRE
// ============================================================

async function handleMemberAdd(
  member
) {
  if (
    !isUsableMember(
      member
    )
  ) {
    return;
  }

  await queueMemberTask(
    member.id,
    async () => {
      await syncMember(
        member
      );

      await sleep(
        500
      );

      await reorderAllPlayerSpaces(
        member.guild
      );
    }
  );
}

// ============================================================
// MODULE PRINCIPAL
// ============================================================

function startPlayerSpaces(
  client
) {
  console.log(
    '🎮 Player Spaces général : module chargé'
  );

  if (
    !ARK_ROLE_ID
  ) {
    console.warn(
      '⚠️ ARK_ROLE_ID manquant : espaces ARK désactivés.'
    );
  } else {
    console.log(
      `🦖 ARK → ${ARK_ROLE_ID}`
    );
  }

  console.log(
    `🚘 GTA V → ${GTA_ROLE_ID}`
  );

  console.log(
    `🇺🇸 ATS → ${ATS_ROLE_ID}`
  );

  console.log(
    `🇪🇺 ETS2 → ${ETS2_ROLE_ID}`
  );

  console.log(
    '🗂️ Catégories principales :'
  );

  console.log(
    `🦖 ARK → ${ARK_MAIN_CATEGORY_ID}`
  );

  console.log(
    `🚘 GTA V → ${GTA_MAIN_CATEGORY_ID}`
  );

  console.log(
    `🇺🇸 ATS → ${ATS_MAIN_CATEGORY_ID}`
  );

  console.log(
    `🇪🇺 ETS2 → ${ETS2_MAIN_CATEGORY_ID}`
  );

  // ==========================================================
  // CHANGEMENT DE RÔLE
  // ==========================================================

  client.on(
    'guildMemberUpdate',
    async (
      oldMember,
      newMember
    ) => {
      try {
        await handleRoleChange(
          oldMember,
          newMember
        );
      } catch (error) {
        console.error(
          '❌ Player Spaces : erreur changement de rôle :',
          error
        );
      }
    }
  );

  // ==========================================================
  // ARRIVÉE MEMBRE
  // ==========================================================

  client.on(
    'guildMemberAdd',
    async member => {
      try {
        await handleMemberAdd(
          member
        );
      } catch (error) {
        console.error(
          '❌ Player Spaces : erreur arrivée membre :',
          error
        );
      }
    }
  );

  // ==========================================================
  // SYNCHRONISATION INITIALE
  // ==========================================================

  setTimeout(
    async () => {
      try {
        await syncAllGuilds(
          client
        );
      } catch (error) {
        console.error(
          '❌ Player Spaces : synchronisation initiale impossible :',
          error
        );
      }
    },
    5000
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  startPlayerSpaces,
  syncAllGuilds,
  syncGuild,
  syncMember,
  reorderAllPlayerSpaces,
  reorderGameSpaces,

  createArkPlayerSpace,
  deleteArkPlayerSpace,

  createGtaPlayerSpace,
  deleteGtaPlayerSpace,

  createAtsPlayerSpace:
    member =>
      createAtsEtsPlayerSpace(
        member,
        ATS_GAME
      ),

  deleteAtsPlayerSpace:
    member =>
      deleteAtsEtsPlayerSpace(
        member,
        ATS_GAME
      ),

  createEts2PlayerSpace:
    member =>
      createAtsEtsPlayerSpace(
        member,
        ETS2_GAME
      ),

  deleteEts2PlayerSpace:
    member =>
      deleteAtsEtsPlayerSpace(
        member,
        ETS2_GAME
      )
};
