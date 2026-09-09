const ARK_CHALLENGES = [
  {
    id: 'ark_easy_xp_5000',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'Petit progrès',
    description: 'Gagne 5 000 XP avec ton survivant.',
    metric: 'xpGained',
    target: 5000
  },
  {
    id: 'ark_easy_xp_10000',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'En route',
    description: 'Gagne 10 000 XP avec ton survivant.',
    metric: 'xpGained',
    target: 10000
  },
  {
    id: 'ark_easy_level_1',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'Level Up',
    description: 'Gagne 1 niveau avec ton survivant.',
    metric: 'playerLevelsGained',
    target: 1
  },
  {
    id: 'ark_easy_distance_1km',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'Petite balade',
    description: 'Parcours 1 km.',
    metric: 'distanceMeters',
    target: 1000
  },
  {
    id: 'ark_easy_tame_1',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'Nouveau compagnon',
    description: 'Apprivoise 1 créature.',
    metric: 'tamedWildCount',
    target: 1
  },
  {
    id: 'ark_easy_tame_2',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'Duo de survivants',
    description: 'Apprivoise 2 créatures.',
    metric: 'tamedWildCount',
    target: 2
  },
  {
    id: 'ark_easy_structures_5',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'Bâtisseur',
    description: 'Place 5 structures.',
    metric: 'structuresPlaced',
    target: 5
  },
  {
    id: 'ark_easy_structures_10',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'Petit chantier',
    description: 'Place 10 structures.',
    metric: 'structuresPlaced',
    target: 10
  },
  {
    id: 'ark_easy_birth_1',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'Nouvelle naissance',
    description: 'Fais naître 1 bébé.',
    metric: 'birthsCount',
    target: 1
  },
  {
    id: 'ark_easy_imprint_1',
    difficulty: 'easy',
    emoji: '🟢',
    points: 1,
    title: 'Premier lien',
    description: 'Effectue au moins 1 imprint.',
    metric: 'imprintActions',
    target: 1
  },

  {
    id: 'ark_medium_xp_25000',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Survivant aguerri',
    description: 'Gagne 25 000 XP avec ton survivant.',
    metric: 'xpGained',
    target: 25000
  },
  {
    id: 'ark_medium_level_2',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Double montée',
    description: 'Gagne 2 niveaux avec ton survivant.',
    metric: 'playerLevelsGained',
    target: 2
  },
  {
    id: 'ark_medium_distance_3km',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Explorateur',
    description: 'Parcours 3 km.',
    metric: 'distanceMeters',
    target: 3000
  },
  {
    id: 'ark_medium_tame_3',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Dresseur',
    description: 'Apprivoise 3 créatures.',
    metric: 'tamedWildCount',
    target: 3
  },
  {
    id: 'ark_medium_tame_150',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Belle prise',
    description: 'Apprivoise une créature sauvage niveau 150 minimum.',
    metric: 'highestWildTameLevel',
    target: 150
  },
  {
    id: 'ark_medium_tame_200',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Très belle prise',
    description: 'Apprivoise une créature sauvage niveau 200 minimum.',
    metric: 'highestWildTameLevel',
    target: 200
  },
  {
    id: 'ark_medium_birth_2',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Éleveur',
    description: 'Fais naître 2 bébés.',
    metric: 'birthsCount',
    target: 2
  },
  {
    id: 'ark_medium_imprint_50',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Bonne éducation',
    description: 'Fais passer un bébé à 50 % d’imprint ou plus.',
    metric: 'babiesAt50Imprint',
    target: 1
  },
  {
    id: 'ark_medium_structures_25',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Constructeur',
    description: 'Place 25 structures.',
    metric: 'structuresPlaced',
    target: 25
  },
  {
    id: 'ark_medium_dino_levels_10',
    difficulty: 'medium',
    emoji: '🟠',
    points: 2,
    title: 'Entraîneur',
    description: 'Fais gagner 10 niveaux cumulés à tes dinos.',
    metric: 'dinoLevelsGained',
    target: 10
  },

  {
    id: 'ark_hard_xp_75000',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Machine à XP',
    description: 'Gagne 75 000 XP avec ton survivant.',
    metric: 'xpGained',
    target: 75000
  },
  {
    id: 'ark_hard_level_5',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Grosse progression',
    description: 'Gagne 5 niveaux avec ton survivant.',
    metric: 'playerLevelsGained',
    target: 5
  },
  {
    id: 'ark_hard_distance_10km',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Grand explorateur',
    description: 'Parcours 10 km.',
    metric: 'distanceMeters',
    target: 10000
  },
  {
    id: 'ark_hard_tame_5',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Maître dresseur',
    description: 'Apprivoise 5 créatures.',
    metric: 'tamedWildCount',
    target: 5
  },
  {
    id: 'ark_hard_tame_250',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Tame d’élite',
    description: 'Apprivoise une créature sauvage niveau 250 minimum.',
    metric: 'highestWildTameLevel',
    target: 250
  },
  {
    id: 'ark_hard_tame_300',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Parfait spécimen',
    description: 'Apprivoise une créature sauvage niveau 300 minimum.',
    metric: 'highestWildTameLevel',
    target: 300
  },
  {
    id: 'ark_hard_birth_5',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Nurserie',
    description: 'Fais naître 5 bébés.',
    metric: 'birthsCount',
    target: 5
  },
  {
    id: 'ark_hard_imprint_100',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Parent modèle',
    description: 'Fais passer un bébé à 100 % d’imprint.',
    metric: 'babiesAt100Imprint',
    target: 1
  },
  {
    id: 'ark_hard_structures_50',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Grand bâtisseur',
    description: 'Place 50 structures.',
    metric: 'structuresPlaced',
    target: 50
  },
  {
    id: 'ark_hard_dino_levels_25',
    difficulty: 'hard',
    emoji: '🔴',
    points: 3,
    title: 'Maître entraîneur',
    description: 'Fais gagner 25 niveaux cumulés à tes dinos.',
    metric: 'dinoLevelsGained',
    target: 25
  }
];

function getChallengesByDifficulty(
  difficulty
) {
  return ARK_CHALLENGES.filter(
    challenge =>
      challenge.difficulty === difficulty
  );
}

function getChallengeById(id) {
  return (
    ARK_CHALLENGES.find(
      challenge =>
        challenge.id === id
    ) ||
    null
  );
}

function getChallengeProgress(
  challenge,
  metrics
) {
  if (!challenge || !metrics) {
    return {
      current: 0,
      target:
        challenge?.target ?? 0,
      completed: false,
      percent: 0
    };
  }

  const current =
    Number(
      metrics[
        challenge.metric
      ] ?? 0
    );

  const target =
    Number(
      challenge.target ?? 0
    );

  const completed =
    current >= target;

  const percent =
    target > 0
      ? Math.min(
          100,
          Math.floor(
            (current / target) * 100
          )
        )
      : 0;

  return {
    current,
    target,
    completed,
    percent
  };
}

module.exports = {
  ARK_CHALLENGES,
  getChallengesByDifficulty,
  getChallengeById,
  getChallengeProgress
};
