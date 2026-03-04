/**
 * Background service worker
 * Receives song data from content script and upserts to Supabase.
 */

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

// In-memory state
let currentUser = null;
let lastSong = null;
let initPromise = null;

/**
 * Initialize: load stored session
 */
async function init() {
    const stored = await chrome.storage.local.get(["session", "lastSong"]);
    if (stored.session) {
        currentUser = stored.session;
        console.log("[YTM Background] Restored session for:", currentUser.email);
    }
    if (stored.lastSong) {
        lastSong = stored.lastSong;
        console.log("[YTM Background] Restored last song:", lastSong.title);
    }
}

// Start initialization immediately
initPromise = init();

/**
 * Sign in with email/password via Supabase Auth
 */
async function signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error_description || err.msg || "Login failed");
    }

    const data = await res.json();
    currentUser = {
        id: data.user.id,
        email: data.user.email,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
    };

    await chrome.storage.local.set({ session: currentUser });
    console.log("[YTM Background] Signed in as:", currentUser.email);
    return currentUser;
}

/**
 * Sign up with email/password
 */
async function signUp(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error_description || err.msg || "Signup failed");
    }

    const data = await res.json();
    // If email confirmation is required, user won't have a session yet
    if (data.access_token) {
        currentUser = {
            id: data.user.id,
            email: data.user.email,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
        };
        await chrome.storage.local.set({ session: currentUser });
    }
    return data;
}

/**
 * Sign out
 */
async function signOut() {
    currentUser = null;
    await chrome.storage.local.remove(["session"]);
    console.log("[YTM Background] Signed out");
}

/**
 * Refresh the Supabase session using the stored refresh token.
 * Returns true if refresh succeeded, false otherwise.
 */
async function refreshSession() {
    if (!currentUser?.refreshToken) {
        console.warn("[YTM Background] No refresh token available");
        return false;
    }

    try {
        console.log("[YTM Background] Refreshing auth token...");
        const res = await fetch(
            `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: SUPABASE_KEY,
                },
                body: JSON.stringify({
                    refresh_token: currentUser.refreshToken,
                }),
            }
        );

        if (!res.ok) {
            console.error("[YTM Background] Token refresh failed:", res.status);
            return false;
        }

        const data = await res.json();
        currentUser = {
            id: data.user.id,
            email: data.user.email,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
        };

        await chrome.storage.local.set({ session: currentUser });
        console.log("[YTM Background] Token refreshed successfully");
        return true;
    } catch (err) {
        console.error("[YTM Background] Token refresh error:", err);
        return false;
    }
}

/**
 * Helper: Fetch with retry + automatic token refresh on 401
 */
async function fetchWithRetry(url, options, retries = 2, backoff = 1000) {
    try {
        const res = await fetch(url, options);

        // If unauthorized, try refreshing the token
        if (res.status === 401) {
            const refreshed = await refreshSession();
            if (refreshed) {
                // Rebuild headers with new token
                const newOptions = {
                    ...options,
                    headers: {
                        ...options.headers,
                        Authorization: `Bearer ${currentUser.accessToken}`,
                    },
                };
                return fetch(url, newOptions);
            }
            throw new Error("Auth token expired and refresh failed");
        }

        if (!res.ok && res.status >= 500) {
            throw new Error(`Server error: ${res.status}`);
        }
        return res;
    } catch (err) {
        if (retries > 0) {
            console.warn(
                `[YTM Background] Fetch failed, retrying in ${backoff}ms...`,
                err.message
            );
            await new Promise((r) => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw err;
    }
}

/**
 * Upsert song data to Supabase.
 * On auth failure, refreshes the token and retries once.
 */
async function upsertNowPlaying(songData) {
    await initPromise; // Wait for session to load

    if (!currentUser) {
        console.warn("[YTM Background] Not signed in, skipping update");
        return;
    }

    const buildPayload = () => ({
        user_id: currentUser.id,
        title: songData.title,
        artist: songData.artist,
        album: songData.album || "",
        album_art: songData.albumArt || "",
        duration: songData.duration || "",
        is_playing: songData.isPlaying,
        song_url: songData.songUrl || "",
        progress_ms: songData.progressMs || 0,
        duration_ms: songData.durationMs || 0,
        updated_at: new Date().toISOString(),
    });

    const buildHeaders = (extra = {}) => ({
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${currentUser.accessToken}`,
        ...extra,
    });

    const payload = buildPayload();

    // Single upsert — if user_id exists, update; otherwise insert
    await fetchWithRetry(`${SUPABASE_URL}/rest/v1/now_playing?on_conflict=user_id`, {
        method: "POST",
        headers: buildHeaders({
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation",
        }),
        body: JSON.stringify(payload),
    });

    console.log(
        "[YTM Background] Upserted:",
        payload.title,
        "-",
        payload.artist
    );
}

/**
 * Listen for messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SONG_UPDATE") {
        lastSong = message.payload;
        chrome.storage.local.set({ lastSong });

        // Handle async upsert and send response when done
        upsertNowPlaying(message.payload)
            .then(() => sendResponse({ success: true }))
            .catch((err) => {
                console.error("[YTM Background] Upsert failed:", err);
                sendResponse({ success: false, error: err.message });
            });

        return true; // Keep channel open for async response
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

    if (message.type === "SIGN_IN") {
        signIn(message.email, message.password)
            .then((user) => sendResponse({ success: true, user }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true; // keep channel open for async response
    }

    if (message.type === "SIGN_UP") {
        signUp(message.email, message.password)
            .then((data) => sendResponse({ success: true, data }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (message.type === "SIGN_OUT") {
        signOut().then(() => sendResponse({ success: true }));
        return true;
    }

    if (message.type === "GET_SESSION") {
        sendResponse({ user: currentUser });
        return;
    }
});

