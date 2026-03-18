# Architecture — YTM Now Playing

Technical reference for developers and AI agents working on this extension. Read this before making changes.

## Overview

The extension tracks the currently playing song on YouTube Music and syncs it to a Supabase database in real-time. Websites can then display a "Now Playing" widget by subscribing to that database.

```
YouTube Music tab                          Supabase DB
┌─────────────────────────┐                ┌──────────┐
│ inject-video-id.js      │                │          │
│ (MAIN world)            │                │ now_     │
│  └─ reads videoId from  │   hidden div   │ playing  │
│     #movie_player       │──────────────┐ │ table    │
│                         │              │ │          │
│ content-ytm.js          │              │ └────▲─────┘
│ (ISOLATED world)        │              │      │
│  └─ reads DOM + div     │──────┐       │      │
│                         │      │       │      │
└─────────────────────────┘      │       │      │
                                 ▼       ▼      │
                           background.js ───────┘
                           (service worker)
                            └─ upserts to Supabase
```

## Files

| File | Runs in | Purpose |
|------|---------|---------|
| `content-ytm.js` | Content script (ISOLATED world) | Scrapes song title, artist, album, play state from the DOM. Reads video ID from hidden div. Sends data to background worker. |
| `inject-video-id.js` | Content script (MAIN world) | Accesses YouTube's internal player API to extract the current video ID. Writes it to a hidden DOM element. |
| `background.js` | Service worker | Receives song data from content script, upserts to Supabase `now_playing` table. |
| `popup.js/html/css` | Extension popup | Auth UI — sign in/out, show user ID for integration. |
| `config.js` | Imported by background.js | Supabase project URL and anon key. |

## The Two Worlds Problem

Chrome extensions run content scripts in an **isolated world** — they share the DOM with the page but have a separate JavaScript context. This means:

- ✅ `document.querySelector(".title")` works (DOM is shared)
- ❌ `document.querySelector("#movie_player").getVideoData()` fails (page JS objects are not shared)

YouTube Music doesn't expose the current video ID anywhere in the DOM. It's only available via the internal `#movie_player` element's JavaScript methods.

### Solution: `world: "MAIN"` (Manifest V3)

In `manifest.json`, we register `inject-video-id.js` as a content script with `"world": "MAIN"`:

```json
{
    "js": ["inject-video-id.js"],
    "run_at": "document_idle",
    "world": "MAIN"
}
```

This runs the script in the **page's own JavaScript context**, giving it access to YouTube's internal objects.

### Bridge: Hidden DOM Element

Since the two scripts can't share JavaScript variables, they communicate through the DOM:

1. `inject-video-id.js` (MAIN world) writes `data-video-id` to a hidden div every 1.5s
2. `content-ytm.js` (ISOLATED world) reads `data-video-id` from that div when extracting song data

```
MAIN world                          ISOLATED world
inject-video-id.js                  content-ytm.js
      │                                   │
      │  getVideoData().video_id          │
      │         │                         │
      ▼         ▼                         │
   <div id="__ytm_now_playing_video_id"   │
        data-video-id="dQw4w9WgXcQ">      │
      ▲                                   │
      │          DOM (shared)             │
      └───────────────────────────────────┘
```

## YouTube Music Internals (Fragile — May Break)

> **⚠️ None of this is a public API. It's reverse-engineered from YouTube's own code and can change without notice.**

### `#movie_player`

The main video player element, same one used on youtube.com. It's a custom element with internal methods:

```javascript
const player = document.querySelector("#movie_player");
player.getVideoData();
// Returns: { video_id: "abc123", title: "Song", author: "Artist", ... }
```

**If YouTube removes or renames this:** The `inject-video-id.js` script will silently fail (wrapped in try/catch). The content script falls back to `window.location.href` which may show a playlist URL instead of the song URL. The extension won't crash — the song URL will just be inaccurate.

### DOM Selectors (scraped by `content-ytm.js`)

| Selector | What it reads |
|----------|--------------|
| `ytmusic-player-bar .title` | Song title text |
| `ytmusic-player-bar .byline` | "Artist • Album • Year" text |
| `ytmusic-player-bar .byline a:first-child` | Artist link |
| `ytmusic-player-bar .image` | Album art `src` |
| `ytmusic-player-bar .time-info` | "1:23 / 3:45" elapsed/duration |
| `ytmusic-player-bar #play-pause-button #button` | `aria-label` contains "Pause" if playing |

**If YouTube renames these:** Song detection breaks. Check the YTM player bar in DevTools and update `SELECTORS` at the top of `content-ytm.js`.

## The Playlist URL Bug (Why `inject-video-id.js` Exists)

When playing from a playlist, `window.location.href` stays as:
```
https://music.youtube.com/playlist?list=PLxxxxxx
```

But the actual song changes. Without `inject-video-id.js`, the extension would report the playlist URL as the song link, which is wrong.

With the video ID extraction, we construct the correct URL:
```
https://music.youtube.com/watch?v=ACTUAL_VIDEO_ID
```

## Data Flow

1. User plays a song on YouTube Music
2. `MutationObserver` in `content-ytm.js` detects DOM changes in the player bar
3. `extractSongData()` scrapes title, artist, album, play state from DOM
4. Video ID is read from the hidden div (written by `inject-video-id.js`)
5. Song URL is constructed from the video ID
6. Data is sent to `background.js` via `chrome.runtime.sendMessage`
7. `background.js` upserts to Supabase `now_playing` table
8. Websites subscribed to that table receive real-time updates

## Debugging

Open the YouTube Music tab's DevTools console and look for `[YTM Now Playing]` logs:

```
[YTM Now Playing] Content script loaded on: https://music.youtube.com/...
[YTM Now Playing] ✅ Player bar found, starting observer...
[YTM Now Playing] 🎵 Song detected: Song Title - Artist Name
```

To check if the video ID extraction is working:

```javascript
// In the page console (not extension console):
document.getElementById("__ytm_now_playing_video_id")?.dataset.videoId
// Should return something like "dQw4w9WgXcQ"
```

To check the raw player data:

```javascript
// In the page console:
document.querySelector("#movie_player")?.getVideoData()
```

## Browser Compatibility

| Feature | Chrome | Firefox |
|---------|--------|---------|
| `world: "MAIN"` | ✅ 111+ | ✅ 128+ |
| `service_worker` | ✅ | ✅ (with `scripts` fallback removed) |
| Manifest V3 | ✅ | ✅ 109+ |

Firefox minimum version is set to `142.0` in `browser_specific_settings`.
