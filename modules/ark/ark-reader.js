const fs = require("fs");
const path = require("path");

function getMapNameFromSave(save) {

    let name = save.folder || save.file;

    name = name
        .replace(".ark", "")
        .replace("_WP", "");

    const mapNames = {
        TheIsland: "The Island",
        ScorchedEarth: "Scorched Earth",
        Aberration: "Aberration",
        Extinction: "Extinction",
        Ragnarok: "Ragnarok",
        Valguero: "Valguero",
        TheCenter: "The Center",
        LostIsland: "Lost Island",
        Fjordur: "Fjordur"
    };

    return mapNames[name] || name;
}

async function readArkSave(save) {

    if (!save || !fs.existsSync(save.fullPath)) {
        throw new Error(
            "Sauvegarde ARK introuvable."
        );
    }

    const map = getMapNameFromSave(save);

    /*
        IMPORTANT

        Le fichier .ark est binaire.

        On branchera ici notre parseur ASA
        dans l'étape suivante.

        Pour l'instant on retourne les infos
        sûres du fichier.
    */

    return {
        map,

        save: {
            file: path.basename(save.fullPath),
            folder: save.folder,
            size: save.size,
            modifiedAt: new Date(
                save.modifiedAt
            ).toISOString()
        },

        player: null,

        world: {
            map
        },

        dinos: []
    };
}

module.exports = {
    readArkSave,
    getMapNameFromSave
};
