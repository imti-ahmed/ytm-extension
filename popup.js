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
