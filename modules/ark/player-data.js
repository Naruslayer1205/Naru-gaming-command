const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(
    __dirname,
    "data"
);

const DATA_FILE = path.join(
    DATA_DIR,
    "players.json"
);

function ensureDataFile() {

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, {
            recursive: true
        });
    }

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify({}, null, 2)
        );
    }
}

function loadPlayers() {

    ensureDataFile();

    try {

        return JSON.parse(
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            )
        );

    } catch {

        return {};
    }
}

function savePlayers(players) {

    ensureDataFile();

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
            players,
            null,
            2
        )
    );
}

function getPlayer(discordId) {

    const players = loadPlayers();

    return players[discordId] || null;
}

function updatePlayer(
    discordId,
    data
) {

    const players = loadPlayers();

    players[discordId] = {
        ...(players[discordId] || {}),
        ...data,
        discordId,
        updatedAt:
            new Date().toISOString()
    };

    savePlayers(players);

    return players[discordId];
}

module.exports = {
    getPlayer,
    updatePlayer,
    loadPlayers
};
