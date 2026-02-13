/**
 * Popup script — handles auth UI and displays status
 */

const authSection = document.getElementById("auth-section");
const statusSection = document.getElementById("status-section");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signInBtn = document.getElementById("sign-in-btn");
const signUpBtn = document.getElementById("sign-up-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const authError = document.getElementById("auth-error");
const userEmail = document.getElementById("user-email");
const statusCard = document.getElementById("status-card");

/**
 * Show the logged-in view
 */
function showLoggedIn(user) {
    authSection.style.display = "none";
    statusSection.style.display = "block";
    userEmail.textContent = `Signed in as ${user.email}`;

    // Show user ID for API integration
    if (user.id) {
        const idRow = document.getElementById("id-row");
        const idDisplay = document.getElementById("user-id-display");
        const copyBtn = document.getElementById("copy-id-btn");

        idRow.style.display = "flex";
        idDisplay.textContent = user.id;

        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(user.id).then(() => {
                const copySvg = copyBtn.innerHTML;
                copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                copyBtn.classList.add("copied");
                setTimeout(() => {
                    copyBtn.innerHTML = copySvg;
                    copyBtn.classList.remove("copied");
                }, 1500);
            });
        });
    }

    fetchCurrentSong();
}

/**
 * Fetch and display current song from background
 */
function fetchCurrentSong() {
    chrome.runtime.sendMessage({ type: "GET_SONG" }, (response) => {
        if (response?.song) {
            renderSong(response.song);
        }
    });
}

/**
 * Render song info in the status card
 */
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

/**
 * Show the login view
 */
function showLoggedOut() {
    authSection.style.display = "block";
    statusSection.style.display = "none";
    authError.textContent = "";
}

/**
 * Check if we have a stored session
 */
chrome.runtime.sendMessage({ type: "GET_SESSION" }, (response) => {
    if (response?.user) {
        showLoggedIn(response.user);
    } else {
        showLoggedOut();
    }
});

/**
 * Sign In
 */
signInBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) {
        authError.textContent = "Please enter email and password";
        return;
    }

    signInBtn.textContent = "Signing in...";
    signInBtn.disabled = true;

    chrome.runtime.sendMessage(
        { type: "SIGN_IN", email, password },
        (response) => {
            signInBtn.textContent = "Sign In";
            signInBtn.disabled = false;

            if (response?.success) {
                showLoggedIn(response.user);
            } else {
                authError.textContent = response?.error || "Login failed";
            }
        }
    );
});

/**
 * Sign Up
 */
signUpBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) {
        authError.textContent = "Please enter email and password";
        return;
    }

    signUpBtn.textContent = "Signing up...";
    signUpBtn.disabled = true;

    chrome.runtime.sendMessage(
        { type: "SIGN_UP", email, password },
        (response) => {
            signUpBtn.textContent = "Sign Up";
            signUpBtn.disabled = false;

            if (response?.success) {
                if (response.data?.access_token) {
                    showLoggedIn(response.data.user);
                } else {
                    authError.textContent = "Check your email to confirm your account";
                    authError.style.color = "#54d5bb";
                }
            } else {
                authError.textContent = response?.error || "Signup failed";
            }
        }
    );
});

/**
 * Sign Out
 */
signOutBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "SIGN_OUT" }, () => {
        showLoggedOut();
    });
});
