# YTM Now Playing

A Chrome extension that tracks what you're listening to on YouTube Music and serves it via a real-time API.

## Setup

### 1. Supabase
1. Go to your [Supabase SQL Editor](https://supabase.com/dashboard/project/uczcbonklkmgzdtqeulx/sql/new)
2. Paste the contents of `supabase-setup.sql` and run it
3. Go to **Authentication → Settings** and make sure email/password sign-ups are enabled

### 2. Install Extension (Development)
1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `ytm-extension` folder
5. Click the extension icon → Sign up with an email/password
6. Open YouTube Music and play a song

### 3. Verify
- Check your Supabase dashboard → Table Editor → `now_playing`
- You should see a row with your current song data

## Files
- `manifest.json` — Extension config (Manifest V3)
- `content-ytm.js` — Content script injected into YouTube Music
- `background.js` — Service worker handling auth + API calls
- `popup.html/css/js` — Extension popup UI
- `config.js` — Supabase project URL + publishable key
- `supabase-setup.sql` — Database schema setup

## Architecture
```
YouTube Music Tab → Content Script → Background Worker → Supabase DB → Portfolio/API
```
