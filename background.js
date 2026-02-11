/**
 * Background service worker
 * Receives song data from content script and upserts to Supabase.
 */

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

// In-memory state
let currentUser = null;

/**
 * Initialize: load stored session
 */
async function init() {
    const stored = await chrome.storage.local.get(["session"]);
    if (stored.session) {
        currentUser = stored.session;
        console.log("[YTM Background] Restored session for:", currentUser.email);
    }
}

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
 * Upsert song data to Supabase
 */
async function upsertNowPlaying(songData) {
    if (!currentUser) {
        console.warn("[YTM Background] Not signed in, skipping update");
        return;
    }

    const payload = {
        user_id: currentUser.id,
        title: songData.title,
        artist: songData.artist,
        album: songData.album || "",
        album_art: songData.albumArt || "",
        duration: songData.duration || "",
        is_playing: songData.isPlaying,
        updated_at: new Date().toISOString(),
    };

    // Upsert: if row exists for this user, update it; otherwise insert
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/now_playing?user_id=eq.${currentUser.id}`,
        {
            method: "GET",
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${currentUser.accessToken}`,
            },
        }
    );

    const existing = await res.json();

    if (existing.length > 0) {
        // UPDATE
        await fetch(
            `${SUPABASE_URL}/rest/v1/now_playing?user_id=eq.${currentUser.id}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${currentUser.accessToken}`,
                    Prefer: "return=minimal",
                },
                body: JSON.stringify(payload),
            }
        );
    } else {
        // INSERT
        await fetch(`${SUPABASE_URL}/rest/v1/now_playing`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${currentUser.accessToken}`,
                Prefer: "return=minimal",
            },
            body: JSON.stringify(payload),
        });
    }

    console.log("[YTM Background] Upserted:", payload.title, "-", payload.artist);
}

/**
 * Listen for messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SONG_UPDATE") {
        upsertNowPlaying(message.payload);
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

// Initialize on load
init();
