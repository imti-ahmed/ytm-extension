/**
 * Content script for music.youtube.com
 * Watches the player bar for song changes and sends them to the background worker.
 */

const SELECTORS = {
    playerBar: "ytmusic-player-bar",
    title: "ytmusic-player-bar .title",
    byline: "ytmusic-player-bar .byline",
    artistLink: "ytmusic-player-bar .byline a:first-child",
    albumLink: "ytmusic-player-bar .byline a:nth-child(2)",
    albumArt: "ytmusic-player-bar .image",
    timeInfo: "ytmusic-player-bar .time-info",
    playPauseBtn: "ytmusic-player-bar #play-pause-button",
};

let lastSongData = null;
let debounceTimer = null;

/**
 * Extract current song data from the DOM
 */
function extractSongData() {
    const title = document.querySelector(SELECTORS.title);
    const artistLink = document.querySelector(SELECTORS.artistLink);
    const albumLink = document.querySelector(SELECTORS.albumLink);
    const albumArt = document.querySelector(SELECTORS.albumArt);
    const timeInfo = document.querySelector(SELECTORS.timeInfo);
    const playPauseBtn = document.querySelector(SELECTORS.playPauseBtn);

    if (!title || !title.textContent.trim()) return null;

    // Determine play state from the play/pause button
    const isPlaying = playPauseBtn
        ? playPauseBtn.getAttribute("aria-label")?.toLowerCase().includes("pause")
        : false;

    // Parse duration from time info (format: "1:23 / 3:45")
    const timeText = timeInfo?.textContent?.trim() || "";
    const durationMatch = timeText.match(/\/\s*(.+)/);
    const duration = durationMatch ? durationMatch[1].trim() : "";

    return {
        title: title.textContent.trim(),
        artist: artistLink?.textContent?.trim() || "",
        album: albumLink?.textContent?.trim() || "",
        albumArt: albumArt?.src || "",
        duration,
        isPlaying,
    };
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
 */
function sendUpdate(data) {
    chrome.runtime.sendMessage({
        type: "SONG_UPDATE",
        payload: data,
    });
}

/**
 * Main observer callback — debounced
 */
function onPlayerChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const data = extractSongData();
        if (data && hasChanged(data)) {
            lastSongData = data;
            sendUpdate(data);
            console.log("[YTM Now Playing] Song updated:", data.title, "-", data.artist);
        }
    }, 500);
}

/**
 * Set up a MutationObserver on the player bar
 */
function startObserving() {
    const playerBar = document.querySelector(SELECTORS.playerBar);
    if (!playerBar) {
        // Player bar not yet in DOM, retry
        setTimeout(startObserving, 1000);
        return;
    }

    console.log("[YTM Now Playing] Player bar found, observing...");

    // Initial extraction
    onPlayerChange();

    // Watch for DOM changes in the player bar
    const observer = new MutationObserver(onPlayerChange);
    observer.observe(playerBar, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["src", "aria-label"],
    });

    // Also poll the play/pause state every 2 seconds as a fallback
    setInterval(() => {
        const data = extractSongData();
        if (data && hasChanged(data)) {
            lastSongData = data;
            sendUpdate(data);
        }
    }, 2000);
}

// Start
startObserving();
