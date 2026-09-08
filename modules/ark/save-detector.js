const fs = require("fs");
const path = require("path");

function findArkSaves(savedArksLocalPath) {
    if (!fs.existsSync(savedArksLocalPath)) {
        return [];
    }

    const results = [];

    const entries = fs.readdirSync(savedArksLocalPath, {
        withFileTypes: true
    });

    for (const entry of entries) {

        if (!entry.isDirectory()) continue;

        const folderPath = path.join(
            savedArksLocalPath,
            entry.name
        );

        const files = fs.readdirSync(folderPath);

        for (const file of files) {

            if (!file.toLowerCase().endsWith(".ark")) {
                continue;
            }

            const fullPath = path.join(
                folderPath,
                file
            );

            const stat = fs.statSync(fullPath);

            results.push({
                file,
                fullPath,
                folder: entry.name,
                modifiedAt: stat.mtimeMs,
                size: stat.size
            });
        }
    }

    return results.sort(
        (a, b) => b.modifiedAt - a.modifiedAt
    );
}

function getLatestArkSave(savedArksLocalPath) {

    const saves = findArkSaves(
        savedArksLocalPath
    );

    if (!saves.length) {
        return null;
    }

    return saves[0];
}

module.exports = {
    findArkSaves,
    getLatestArkSave
};
