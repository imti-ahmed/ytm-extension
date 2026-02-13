# Privacy Policy — YTM Now Playing

**Last updated:** February 12, 2026

## What This Extension Does

YTM Now Playing is a Chrome extension that reads the currently playing song from the YouTube Music web player and sends it to a database so you can display it on your website.

## Data We Collect

The extension collects **only** the following data from the YouTube Music player bar:

- Song title
- Artist name
- Album name
- Album art URL
- Playback duration and progress
- Play/pause state
- The YouTube Music page URL

## Data We Do NOT Collect

- Your YouTube or Google account information
- Your browsing history
- Cookies or session tokens from YouTube
- Any data from any website other than `music.youtube.com`
- Personal information beyond what you provide at sign-up (email)

## How Data Is Stored

- Song data is stored in a [Supabase](https://supabase.com) database
- Each user's data is protected by Row Level Security — you can only write your own data
- Your song data is publicly readable (this is the purpose of the extension — to share what you're listening to)
- Your email and authentication credentials are managed by Supabase Auth and are never exposed publicly

## How Data Is Used

Your song data is used solely to:
- Display a "Now Playing" widget on your website or portfolio
- Allow others to see what you're listening to via the public API

We do not sell, share, or use your data for any other purpose.

## Third-Party Services

This extension uses:
- **Supabase** (database and authentication) — [Supabase Privacy Policy](https://supabase.com/privacy)

## Permissions

The extension requests the following Chrome permissions:
- **`storage`** — To store your authentication session locally
- **Host permission for `music.youtube.com`** — To read the currently playing song
- **Host permission for `*.supabase.co`** — To send song data to the database

## Data Deletion

To delete your data:
1. Sign out from the extension
2. Contact the extension developer to request data deletion

## Contact

For questions about this privacy policy, contact: **drimescodes** on GitHub

## Changes to This Policy

We may update this policy from time to time. Changes will be reflected on this page with an updated date.
