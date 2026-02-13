/**
 * Content script for music.youtube.com
 * Watches the player bar for song changes and sends them to the background worker.
 */

console.log("[YTM Now Playing] Content script loaded on:", window.location.href);

const SELECTORS = {
    playerBar: "ytmusic-player-bar",
    title: "ytmusic-player-bar .title",
    byline: "ytmusic-player-bar .byline",
    artistLink: "ytmusic-player-bar .byline a:first-child",
    albumLink: "ytmusic-player-bar .byline a:nth-child(2)",
    albumArt: "ytmusic-player-bar .image",
    timeInfo: "ytmusic-player-bar .time-info",
    playPauseBtn: "ytmusic-player-bar #play-pause-button #button",
};

let lastSongData = null;
let debounceTimer = null;

/**
 * Convert time string like "1:23" or "1:23:45" to milliseconds
 */
function timeToMs(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(":").map(Number);
    if (parts.length === 2) {
        return (parts[0] * 60 + parts[1]) * 1000;
    } else if (parts.length === 3) {
        return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    return 0;
}

/**
 * Extract current song data from the DOM
 */
function extractSongData() {
    const title = document.querySelector(SELECTORS.title);
    const byline = document.querySelector(SELECTORS.byline);
    const artistLink = document.querySelector(SELECTORS.artistLink);
    const albumArt = document.querySelector(SELECTORS.albumArt);
    const timeInfo = document.querySelector(SELECTORS.timeInfo);
    const playPauseBtn = document.querySelector(SELECTORS.playPauseBtn);

    if (!title || !title.textContent.trim()) {
        return null;
    }

    // Artist: try link first, then parse byline text ("Artist • Album • Year")
    let artist = artistLink?.textContent?.trim() || "";
    let album = "";
    if (!artist && byline) {
        const parts = byline.textContent.split("•").map(p => p.trim());
        artist = parts[0] || "";
        album = parts[1] || "";
    } else if (byline) {
        const parts = byline.textContent.split("•").map(p => p.trim());
        album = parts[1] || "";
    }

    // Determine play state: if button says "Pause", music IS playing
    const ariaLabel = playPauseBtn?.getAttribute("aria-label") || "";
    const isPlaying = ariaLabel.toLowerCase().includes("pause");

    // Parse time info (format: "1:23 / 3:45")
    const timeText = timeInfo?.textContent?.trim() || "";
    const timeParts = timeText.split("/").map(p => p.trim());
    const elapsed = timeParts[0] || "";
    const duration = timeParts[1] || "";

    const data = {
        title: title.textContent.trim(),
        artist,
        album,
        albumArt: albumArt?.src || "",
        duration,
        isPlaying,
        songUrl: window.location.href,
        progressMs: timeToMs(elapsed),
        durationMs: timeToMs(duration),
    };

    return data;
}

/**
 * Check if song data has meaningfully changed
 */
function hasChanged(newData) {
    if (!lastSongData || !newData) return true;
    return (
        newData.title !== lastSongData.title ||
        newData.artist !== lastSongData.artist ||
        newData.isPlaying !== lastSongData.isPlaying
    );
}

/**
 * Send song data to the background service worker
 * RETURNS: Promise<boolean> (true if success)
 */
let contextValid = true;
let observer = null;
let pollInterval = null;
let lastAttemptedJson = ""; // To suppress repeated error logs for same song

function sendUpdate(data) {
    if (!contextValid) return Promise.resolve(false);
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(
                { type: "SONG_UPDATE", payload: data },
                (response) => {
                    const currentJson = JSON.stringify(data);

                    if (chrome.runtime.lastError) {
                        const msg = chrome.runtime.lastError.message;
                        // Ignore common "port closed" errors
                        if (msg.includes("The message port closed before a response was received")) {
                            console.log("[YTM Now Playing] Background worker starting up...");
                        } else if (msg.includes("Extension context invalidated")) {
                            console.warn("[YTM Now Playing] Extension was reloaded. Refresh this tab to reconnect.");
                            contextValid = false;
                            clearInterval(pollInterval);
                            if (observer) observer.disconnect();
                        } else {
                            // Only log error once per song state to avoid spamming
                            if (lastAttemptedJson !== currentJson) {
                                console.warn("[YTM Now Playing] Failed to send:", msg);
                            }
                        }
                        lastAttemptedJson = currentJson;
                        resolve(false);
                    } else if (response && response.success) {
                        // Success!
                        // console.log("[YTM Now Playing] Update sent successfully");
                        lastAttemptedJson = ""; // Reset error log state
                        resolve(true);
                    } else {
                        // Background returned success: false
                        if (lastAttemptedJson !== currentJson) {
                            console.warn("[YTM Now Playing] Background failed to update:", response?.error);
                        }
                        lastAttemptedJson = currentJson;
                        resolve(false);
                    }
                }
            );
        } catch (e) {
            console.warn("[YTM Now Playing] Extension context lost. Refresh this tab.");
            contextValid = false;
            resolve(false);
        }
    });
}

/**
 * Attempt to update. If successful, update local state.
 * If failed, leave local state stale so next poll retries.
 */
async function tryUpdate(data) {
    // Optimistic log (so user sees it detected)
    if (data.title !== lastSongData?.title) {
        console.log("[YTM Now Playing] 🎵 Song detected:", data.title, "-", data.artist);
    }

    const success = await sendUpdate(data);

    if (success) {
        lastSongData = data;
        // console.log("[YTM Now Playing] ✅ State updated");
    } else {
        // console.log("[YTM Now Playing] ❌ Update failed, will retry on next poll");
    }
}

/**
 * Main observer callback — debounced
 */
function onPlayerChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const data = extractSongData();
        if (data && hasChanged(data)) {
            tryUpdate(data);
        }
    }, 1000);
}

/**
 * Set up a MutationObserver on the player bar
 */
function startObserving() {
    const playerBar = document.querySelector(SELECTORS.playerBar);
    if (!playerBar) {
        console.log("[YTM Now Playing] Player bar not found, retrying in 1s...");
        setTimeout(startObserving, 1000);
        return;
    }

    console.log("[YTM Now Playing] ✅ Player bar found, starting observer...");

    // Initial extraction
    onPlayerChange();

    // Watch for DOM changes in the player bar
    observer = new MutationObserver(onPlayerChange);
    observer.observe(playerBar, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["src", "aria-label"],
    });

    // Also poll every 2 seconds as a fallback / retry mechanism
    pollInterval = setInterval(() => {
        const data = extractSongData();
        if (data && hasChanged(data)) {
            tryUpdate(data);
        }
    }, 2000);
}

// Start
startObserving();
