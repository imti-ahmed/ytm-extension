/**
 * inject-video-id.js — Runs in the PAGE context (MAIN world, via manifest.json)
 *
 * WHY THIS EXISTS:
 * When playing from a playlist, window.location.href stays as the playlist URL
 * (e.g. /playlist?list=PLxxx) while different songs play. The actual video ID
 * is only accessible via YouTube's internal player API, which lives in the page's
 * JavaScript context — not accessible from content scripts (isolated world).
 *
 * WHAT IT DOES:
 * Polls #movie_player.getVideoData() every 1.5s and writes the video_id to a
 * hidden DOM element. content-ytm.js (isolated world) reads this element to
 * build the correct song URL.
 *
 * FRAGILE DEPENDENCY:
 * #movie_player and getVideoData() are NOT public APIs. They are YouTube's internal
 * player methods. If YouTube renames/removes them, this script silently fails and
 * content-ytm.js falls back to window.location.href (playlist URL bug returns).
 *
 * See ARCHITECTURE.md for full explanation.
 */

(function () {
    let holder = document.getElementById("__ytm_now_playing_video_id");
    if (!holder) {
        holder = document.createElement("div");
        holder.id = "__ytm_now_playing_video_id";
        holder.style.display = "none";
        document.body.appendChild(holder);
    }

    setInterval(() => {
        try {
            const player = document.querySelector("#movie_player");
            if (player && typeof player.getVideoData === "function") {
                const data = player.getVideoData();
                if (data && data.video_id) {
                    holder.dataset.videoId = data.video_id;
                }
            }
        } catch (e) {
            // Silent fail — content-ytm.js falls back to window.location.href
        }
    }, 1500);
})();
