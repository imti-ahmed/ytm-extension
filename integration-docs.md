# Integration Guide — YTM Now Playing

Add a "Now Playing" widget to your website that shows what you're listening to on YouTube Music in real-time.

## Prerequisites

1. Install the [YTM Now Playing extension](https://github.com/drimescodes/ytm-extension)
2. Sign up and sign in through the extension popup
3. Copy your **User ID** from the popup (click 📋)

---

## The Recommended Approach: Supabase Client (Real-time)

For modern frameworks (Next.js, React, Vue, Svelte), the best way to integrate is using the official Supabase client. This gives you **instant updates** via WebSocket and is more efficient than polling.

### Setup

```bash
npm install @supabase/supabase-js
```

### Next.js (App Router)

```tsx
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const USER_ID = "YOUR_USER_ID";
const supabase = createClient(
  "https://uczcbonklkmgzdtqeulx.supabase.co",
  "sb_publishable_SS1XoSstAPQjgehDEvZfaw_QAmep2_a"
);

export default function NowPlaying() {
  const [song, setSong] = useState<any>(null);

  useEffect(() => {
    // 1. Fetch initial state
    const fetchNow = async () => {
      const { data } = await supabase
        .from("now_playing")
        .select("*")
        .eq("user_id", USER_ID)
        .single();
      if (data) setSong(data);
    };
    fetchNow();

    // 2. Subscribe to real-time changes
    const channel = supabase
      .channel("now_playing")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "now_playing",
          filter: `user_id=eq.${USER_ID}`,
        },
        (payload) => setSong(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!song) return <p>Not listening right now</p>;

  return (
    <div>
      <p>{song.is_playing ? "🎵 Now Playing" : "🎵 Last Played"}</p>
      <p><strong>{song.title}</strong> — {song.artist}</p>
      {song.album_art && <img src={song.album_art} alt="" width={48} />}
    </div>
  );
}
```

### React

```jsx
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const USER_ID = "YOUR_USER_ID";
const supabase = createClient(
  "https://uczcbonklkmgzdtqeulx.supabase.co",
  "sb_publishable_SS1XoSstAPQjgehDEvZfaw_QAmep2_a"
);

export default function NowPlaying() {
  const [song, setSong] = useState(null);

  useEffect(() => {
    supabase
      .from("now_playing")
      .select("*")
      .eq("user_id", USER_ID)
      .single()
      .then(({ data }) => setSong(data));

    const subscription = supabase
      .channel("now_playing")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "now_playing",
          filter: `user_id=eq.${USER_ID}`,
        },
        (payload) => setSong(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);
  
  // Render logic...
}
```

### Vue 3

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const USER_ID = 'YOUR_USER_ID'
const supabase = createClient(
  'https://uczcbonklkmgzdtqeulx.supabase.co',
  'sb_publishable_SS1XoSstAPQjgehDEvZfaw_QAmep2_a'
)

const song = ref(null)
let subscription

onMounted(async () => {
  // Initial fetch
  const { data } = await supabase
    .from('now_playing')
    .select('*')
    .eq('user_id', USER_ID)
    .single()
  if (data) song.value = data

  // Real-time subscription
  subscription = supabase
    .channel('now_playing')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'now_playing',
        filter: `user_id=eq.${USER_ID}`
      },
      (payload) => {
        song.value = payload.new
      }
    )
    .subscribe()
})

onUnmounted(() => {
  if (subscription) supabase.removeChannel(subscription)
})
</script>
```

### Svelte

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { createClient } from '@supabase/supabase-js';

  const USER_ID = 'YOUR_USER_ID';
  const supabase = createClient(
    'https://uczcbonklkmgzdtqeulx.supabase.co',
    'sb_publishable_SS1XoSstAPQjgehDEvZfaw_QAmep2_a'
  );

  let song = null;
  let subscription;

  onMount(async () => {
    const { data } = await supabase
      .from('now_playing')
      .select('*')
      .eq('user_id', USER_ID)
      .single();
    if (data) song = data;

    subscription = supabase
      .channel('now_playing')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'now_playing',
          filter: `user_id=eq.${USER_ID}`
        },
        (payload) => {
          song = payload.new;
        }
      )
      .subscribe();
  });

  onDestroy(() => {
    if (subscription) supabase.removeChannel(subscription);
  });
</script>

{#if song}
  <div>
    <p>{song.is_playing ? "🎵 Now Playing" : "🎵 Last Played"}</p>
    <p><strong>{song.title}</strong> — {song.artist}</p>
  </div>
{:else}
  <p>Not listening right now</p>
{/if}
```

---

## Alternative: REST API (No Dependencies)

If you have a static site or don't want to install the Supabase client, you can poll the standard REST API.

**Endpoint:**
`GET https://uczcbonklkmgzdtqeulx.supabase.co/rest/v1/now_playing?user_id=eq.YOUR_USER_ID&select=*`

**Header:**
`apikey: sb_publishable_SS1XoSstAPQjgehDEvZfaw_QAmep2_a`

### Vanilla JS (Copy & Paste)

```html
<div id="now-playing"></div>
<!-- ... styles ... -->
<script>
  const USER_ID = "YOUR_USER_ID";
  const API_URL = `https://uczcbonklkmgzdtqeulx.supabase.co/rest/v1/now_playing?user_id=eq.${USER_ID}&select=*`;
  const API_KEY = "sb_publishable_SS1XoSstAPQjgehDEvZfaw_QAmep2_a";

  async function fetchNowPlaying() {
    const res = await fetch(API_URL, { headers: { apikey: API_KEY } });
    const [song] = await res.json();
    if (song) {
        // ... render logic ...
        document.getElementById("now-playing").innerHTML = `🎵 ${song.title} — ${song.artist}`;
    }
  }

  fetchNowPlaying();
  setInterval(fetchNowPlaying, 5000); // Poll every 5 seconds
</script>
```

---

## Self-Hosting (Own Your Data)

By default, this extension uses a shared Supabase database provided by the developer. If you prefer to own your data completely and host your own backend:

1.  **Fork and Clone** this repository.
2.  **Create a Supabase Project** at [database.new](https://database.new)
3.  **Set up the Database Schema**:
    *   Go to the SQL Editor in your Supabase dashboard.
    *   Copy the contents of `supabase-setup.sql` from this repo.
    *   Paste and run it to create the `now_playing` table and policies.
    *   **Crucial:** Make sure you click "Enable Realtime" for the `now_playing` table if it isn't automatically enabled.
4.  **Configure Your Credentials**:
    ```bash
    cp config.example.js config.js
    ```
    *   Open `config.js` and replace:
        *   `YOUR_PROJECT_ID` with your Supabase project URL
        *   `YOUR_SUPABASE_ANON_KEY` with your project's **anon/public** key
    *   `config.js` is gitignored, so your keys stay local.
5.  **Load Your Extension**:
    *   Go to `chrome://extensions/`
    *   Enable Developer Mode
    *   Click "Load Unpacked" and select your modified extension folder.

Now you have full control over your data, rate limits, and authentication!

