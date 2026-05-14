const statusCard = document.getElementById("status-card");

function renderSong(song) {
    statusCard.innerHTML = `
    <div class="now-playing-info">
      ${song.albumArt ? `<img src="${song.albumArt}" alt="Album art" />` : ""}
      <div class="details">
        <div class="song-title">${song.title}</div>
        <div class="song-artist">${song.artist}</div>
      </div>
    </div>
  `;
}

chrome.runtime.sendMessage({ type: "GET_SONG" }, (response) => {
    if (response?.song) {
        renderSong(response.song);
    }
});
