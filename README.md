# YTM Now Playing

A Chrome extension that tracks your YouTube Music listening activity and exposes it via a public API — perfect for "now playing" widgets on your portfolio, blog, or any website.

> **Think Spotify's Now Playing API, but for YouTube Music.**

## How It Works

```
YouTube Music Tab → Extension (content script) → Supabase DB → Your Website
```

1. The extension watches your YouTube Music browser tab
2. It extracts the current song (title, artist, album art, progress, etc.)
3. It writes the data to a Supabase database in real-time
4. Your website reads from the database via a simple REST API

## Setup

### 1. Install the Extension

- Download or clone this repository
- Open `chrome://extensions/` in Chrome
- Enable **Developer mode** (top right toggle)
- Click **Load unpacked** → select this folder
- Pin the extension to your toolbar

### 2. Create an Account

- Click the extension icon in your toolbar
- Enter an email and password → click **Sign Up**
- Then **Sign In** with the same credentials

### 3. Get Your User ID

- After signing in, your **User ID** is displayed in the popup
- Click the 📋 button to copy it — you'll need this for the API

### 4. Start Listening

- Open [YouTube Music](https://music.youtube.com) and play a song
- The extension automatically detects and tracks what you're playing

## Public API

Once you're signed in and listening, anyone can fetch your current song via the REST API. **No authentication required for reading.**

### Endpoint

```
GET https://uczcbonklkmgzdtqeulx.supabase.co/rest/v1/now_playing?user_id=eq.YOUR_USER_ID&select=*
```

### Headers

```
apikey: sb_publishable_SS1XoSstAPQjgehDEvZfaw_QAmep2_a
```

### Response

```json
{
  "title": "Trumpet",
  "artist": "Seyi Vibez",
  "album": "NAAMij",
  "album_art": "https://lh3.googleusercontent.com/...",
  "is_playing": true,
  "duration": "3:45",
  "progress_ms": 45000,
  "duration_ms": 225000,
  "song_url": "https://music.youtube.com/watch?v=...",
  "updated_at": "2026-02-11T20:30:00.000Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Song title |
| `artist` | string | Artist name |
| `album` | string | Album name |
| `album_art` | string | Album art URL |
| `is_playing` | boolean | Whether music is currently playing |
| `duration` | string | Song duration (formatted) |
| `progress_ms` | integer | Playback progress in milliseconds |
| `duration_ms` | integer | Total song duration in milliseconds |
| `song_url` | string | Link to the song on YouTube Music |
| `updated_at` | string | ISO timestamp of last update |

> 📖 **For integration guides with code snippets (React, Vue, vanilla JS, etc.), see [Integration Docs](https://drimescodes.github.io/ytm-extension/integration-docs)**

## Project Structure

```
ytm-extension/
├── manifest.json          # Extension config (Manifest V3)
├── config.js              # Supabase credentials
├── content-ytm.js         # Content script (injected into YouTube Music)
├── background.js          # Service worker (auth + Supabase writes)
├── popup.html/css/js      # Extension popup UI
├── icons/                 # Extension icons
├── privacy-policy.md      # Privacy policy
├── integration-docs.md    # Developer integration guide
└── supabase-setup.sql     # Database schema
```

## Privacy

This extension:
- Only activates on `music.youtube.com`
- Only reads song metadata (title, artist, album art) from the player bar
- Does **not** access your YouTube account, browsing history, or personal data
- Stores data in Supabase with row-level security (you can only write your own data)

See the full [Privacy Policy](https://drimescodes.github.io/ytm-extension/privacy-policy).

## License

MIT
