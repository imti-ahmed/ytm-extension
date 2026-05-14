/**
 * Background service worker
 * Receives song data from content script and forwards it to your API.
 */

importScripts("config.js");

let lastSong = null;

async function init() {
    const stored = await chrome.storage.local.get(["lastSong"]);
    if (stored.lastSong) {
        lastSong = stored.lastSong;
        console.log("[YTM Background] Restored last song:", lastSong.title);
    }
}

init();

async function sendNowPlaying({ title, artist, albumArt }) {
    const res = await fetch(config.apiUrl + "/api/update-song", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey
        },
        body: JSON.stringify({ title, artist, thumbnail: albumArt })
    });

    if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
    }

    console.log("[YTM Background] Sent:", title, "-", artist);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SONG_UPDATE") {
        lastSong = message.payload;
        chrome.storage.local.set({ lastSong });

        sendNowPlaying(message.payload)
            .then(() => sendResponse({ success: true }))
            .catch((err) => {
                console.error("[YTM Background] Send failed:", err);
                sendResponse({ success: false, error: err.message });
            });

        return true; // keep channel open for async response
    }

    if (message.type === "GET_SONG") {
        if (lastSong) {
            sendResponse({ song: lastSong });
        } else {
            chrome.storage.local.get(["lastSong"]).then((stored) => {
                lastSong = stored.lastSong || null;
                sendResponse({ song: lastSong });
            });
            return true; // keep channel open for async
        }
        return;
    }
});
