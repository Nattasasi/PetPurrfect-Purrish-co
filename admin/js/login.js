import { auth, db, firebaseConfigReady } from "../../js/firebase-config.js";
import {
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const form = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const errorBox = document.getElementById("login-error");
const configWarning = document.getElementById("config-warning");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

function showMessage(message, type = "error") {
    errorBox.textContent = message;
    errorBox.className = `alert alert-${type}`;
}

function setLoading(loading) {
    loginButton.disabled = loading;
    loginButton.innerHTML = loading
        ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...'
        : '<span>Sign in</span><i class="fa-solid fa-arrow-right"></i>';
}

function friendlyAuthError(error) {
    const messages = {
        "auth/invalid-credential": "The email or password is incorrect.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/too-many-requests": "Too many attempts. Please wait and try again.",
        "auth/user-disabled": "This Firebase Authentication account is disabled.",
        "auth/network-request-failed": "Network error. Please check your connection."
    };
    return messages[error.code] || "Could not sign in. Please try again.";
}

async function userIsAdmin(user) {
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    return profileSnapshot.exists()
        && profileSnapshot.data().role === "admin"
        && profileSnapshot.data().active === true;
}

if (!firebaseConfigReady) {
    configWarning.classList.remove("hidden");
    loginButton.disabled = true;
} else {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try {
            if (await userIsAdmin(user)) window.location.replace("index.html");
        } catch (error) {
            console.error(error);
        }
    });
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!firebaseConfigReady) return;
    errorBox.classList.add("hidden");
    setLoading(true);
    try {
        const credential = await signInWithEmailAndPassword(
            auth,
            emailInput.value.trim(),
            passwordInput.value
        );
        if (!(await userIsAdmin(credential.user))) {
            await signOut(auth);
            showMessage("This account does not have administrator access.");
            return;
        }
        window.location.replace("index.html");
    } catch (error) {
        console.error(error);
        showMessage(friendlyAuthError(error));
    } finally {
        setLoading(false);
    }
});

document.getElementById("toggle-password").addEventListener("click", (event) => {
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    event.currentTarget.innerHTML = `<i class="fa-regular fa-eye${showPassword ? "-slash" : ""}"></i>`;
});

document.getElementById("forgot-password").addEventListener("click", async () => {
    if (!firebaseConfigReady) return;
    const email = emailInput.value.trim();
    if (!email) {
        showMessage("Enter your admin email first.", "warning");
        emailInput.focus();
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Password reset email sent. Check your inbox.", "success");
    } catch (error) {
        showMessage(friendlyAuthError(error));
    }
});
