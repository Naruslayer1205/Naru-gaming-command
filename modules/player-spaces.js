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
// CONFIG ATS / ETS2
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
// ÉTAT
// ============================================================

let startupRunning =
  false;

let startupDone =
  false;

// Évite de traiter deux changements
// du même joueur en même temps.

const memberQueues =
  new Map();

// ============================================================
// OUTILS
// ============================================================

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

function isUsableMember(
  member
) {
  return Boolean(
    member &&
    member.user &&
    !member.user.bot
  );
}

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
// ARK
// ============================================================

async function syncArkMember(
  member
) {
  if (
    !ARK_ROLE_ID
  ) {
    return;
  }

  if (
    hasRole(
      member,
      ARK_ROLE_ID
    )
  ) {
    await createArkPlayerSpace(
      member
    );
  }
}

// ============================================================
// GTA
// ============================================================

async function syncGtaMember(
  member
) {
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
}

// ============================================================
// ATS
// ============================================================

async function syncAtsMember(
  member
) {
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
}

// ============================================================
// ETS2
// ============================================================

async function syncEts2Member(
  member
) {
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
// SYNCHRONISATION D'UN JOUEUR
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

  // Ordre volontaire :
  //
  // 1. ARK
  // 2. GTA
  // 3. ATS
  // 4. ETS2

  await syncArkMember(
    member
  );

  await syncGtaMember(
    member
  );

  await syncAtsMember(
    member
  );

  await syncEts2Member(
    member
  );
}

// ============================================================
// RÉCUPÉRATION DES MEMBRES
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
// SYNCHRONISATION SERVEUR
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
  // 1 — ARK
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

  // Petit délai entre les jeux pour éviter
  // d'enchaîner trop vite les créations Discord.

  await sleep(
    1000
  );

  // ==========================================================
  // 2 — GTA V
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
    1000
  );

  // ==========================================================
  // 3 — ATS
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
    1000
  );

  // ==========================================================
  // 4 — ETS2
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

  console.log('');
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
// SYNCHRONISATION GÉNÉRALE
// ============================================================

async function syncAllGuilds(
  client
) {
  if (
    startupRunning
  ) {
    return;
  }

  startupRunning =
    true;

  try {
    for (
      const guild
      of client.guilds.cache.values()
    ) {
      await syncGuild(
        guild
      );
    }

    startupDone =
      true;

  } finally {
    startupRunning =
      false;
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
        }
      }

      // ======================================================
      // GTA V
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

  // ==========================================================
  // UN SEUL LISTENER DE CHANGEMENT DE RÔLE
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
  // UNE SEULE SYNCHRONISATION AU DÉMARRAGE
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
