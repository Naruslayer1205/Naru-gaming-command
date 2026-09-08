const path = require("path");

const {
    scanArkSave
} = require("./modules/ark");

const SAVE_PATH = path.join(
    "C:",
    "Program Files (x86)",
    "Steam",
    "steamapps",
    "common",
    "ARK Survival Ascended",
    "ShooterGame",
    "Saved",
    "SavedArksLocal"
);

async function test() {

    const result =
        await scanArkSave(
            SAVE_PATH
        );

    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );
}

test();
