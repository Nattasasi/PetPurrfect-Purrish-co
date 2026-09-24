import { auth, db, firebaseConfigReady } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc, query, where, getCountFromServer, getDocs, limit, Timestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const state = { messages: [] };
let currentAdmin = null;
let toastTimer;
let stopProfile;
let stopMessages;
let generation = 0;
let messageLoad = "loading";
let selectedMessage = null;
let returnFocus = null;
const pending = new Set();

const $ = (id) => document.getElementById(id);
let analyticsRequest = 0;
const metricTypes = {
    "metric-visitors": "browser_session", "metric-quiz": "quiz_completion",
    "metric-stickers": "sticker_generation", "metric-redirects": "shop_redirect"
};

async function loadAnalytics() {
    if (!currentAdmin) return;
    const request = ++analyticsRequest;
    const session = generation;
    const days = $("analytics-range").value === "7" ? 7 : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    $("analytics-status").textContent = "Loading activity…";
    Object.keys(metricTypes).forEach((id) => { $(id).textContent = "Loading…"; });
    const results = await Promise.allSettled(Object.entries(metricTypes).map(async ([id, type]) => {
        const activity = query(collection(db, "analytics_events"),
            where("type", "==", type), where("createdAt", ">=", Timestamp.fromDate(start)),
            where("createdAt", "<=", Timestamp.fromDate(end)));
        // An unavailable network must not leave the dashboard loading indefinitely.
        let timer;
        try {
            const snapshot = await Promise.race([
                getCountFromServer(activity),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 15000); })
            ]);
            return [id, snapshot.data().count];
        } finally { clearTimeout(timer); }
    }));
    if (request !== analyticsRequest || session !== generation || !currentAdmin) return;
    let failures = 0;
    results.forEach((result, index) => {
        const id = Object.keys(metricTypes)[index];
        if (result.status === "rejected") { $(id).textContent = "Unavailable"; failures += 1; }
        else $(id).textContent = result.value[1] === 0 ? "0 — No activity" : result.value[1].toLocaleString();
    });
    $("analytics-status").textContent = failures
        ? "Some totals could not load. Check your connection, admin access, and Firestore index, then refresh."
        : `Totals from ${start.toLocaleString()} to ${end.toLocaleString()}. Refresh to include new activity.`;
}

const FUNNEL_STAGES = [
    { key: "view_quiz", label: "Viewed quiz" },
    { key: "start_quiz", label: "Started quiz" },
    { key: "complete_quiz", label: "Completed quiz" },
    { key: "share_result", label: "Shared result" }
];
let engagementRequest = 0;

function renderBreakdown(containerId, counts, total) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
        $(containerId).innerHTML = emptyState("fa-chart-simple", "No activity yet", "Breakdown will appear once visitors interact with the quiz.");
        return;
    }
    $(containerId).innerHTML = entries.map(([label, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return "<div class=\"breakdown-row\"><div class=\"breakdown-row-label\"><span>" + escapeHtml(label) + "</span><strong>" + count.toLocaleString() + " (" + pct + "%)</strong></div><div class=\"breakdown-row-track\"><div class=\"breakdown-row-fill\" style=\"width:" + pct + "%\"></div></div></div>";
    }).join("");
}

async function loadEngagement() {
    if (!currentAdmin) return;
    const request = ++engagementRequest;
    const session = generation;
    const days = $("engagement-range").value === "7" ? 7 : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    $("engagement-status").textContent = "Loading activity…";
    $("metric-sessions").textContent = "Loading…";
    $("metric-avg-events").textContent = "Loading…";
    $("funnel-chart").innerHTML = "";
    ["breakdown-devices", "breakdown-browsers", "breakdown-os"].forEach((id) => { $(id).innerHTML = ""; });

    try {
        const startTs = Timestamp.fromDate(start);
        const endTs = Timestamp.fromDate(end);

        const funnelCounts = await Promise.all(FUNNEL_STAGES.map(async ({ key }) => {
            const activity = query(collection(db, "funnel_events"),
                where("eventType", "==", key), where("timestamp", ">=", startTs), where("timestamp", "<=", endTs));
            const snapshot = await getCountFromServer(activity);
            return snapshot.data().count;
        }));

        const eventsQuery = query(collection(db, "funnel_events"),
            where("timestamp", ">=", startTs), where("timestamp", "<=", endTs), limit(2000));
        const eventsSnapshot = await getDocs(eventsQuery);
        const events = eventsSnapshot.docs.map((item) => item.data());

        if (request !== engagementRequest || session !== generation || !currentAdmin) return;

        const devices = {}, browsers = {}, os = {};
        const sessionIds = new Set();
        events.forEach((event) => {
            const ctx = event.context || {};
            devices[ctx.deviceType || "unknown"] = (devices[ctx.deviceType || "unknown"] || 0) + 1;
            browsers[ctx.browser || "unknown"] = (browsers[ctx.browser || "unknown"] || 0) + 1;
            os[ctx.os || "unknown"] = (os[ctx.os || "unknown"] || 0) + 1;
            if (event.sessionId) sessionIds.add(event.sessionId);
        });

        const uniqueSessions = sessionIds.size;
        $("metric-sessions").textContent = uniqueSessions.toLocaleString();
        $("metric-avg-events").textContent = uniqueSessions > 0 ? (events.length / uniqueSessions).toFixed(2) : "0";

        const maxCount = Math.max(...funnelCounts, 1);
        $("funnel-chart").innerHTML = FUNNEL_STAGES.map(({ label }, index) => {
            const count = funnelCounts[index];
            const widthPct = Math.round((count / maxCount) * 100);
            const conversion = index > 0 && funnelCounts[index - 1] > 0
                ? " · " + Math.round((count / funnelCounts[index - 1]) * 100) + "% of previous step"
                : "";
            return "<div class=\"funnel-step\"><div class=\"funnel-step-label\"><span>" + escapeHtml(label) + conversion + "</span><strong>" + count.toLocaleString() + "</strong></div><div class=\"funnel-step-track\"><div class=\"funnel-step-fill\" style=\"width:" + widthPct + "%\"></div></div></div>";
        }).join("");

        renderBreakdown("breakdown-devices", devices, events.length);
        renderBreakdown("breakdown-browsers", browsers, events.length);
        renderBreakdown("breakdown-os", os, events.length);

        $("engagement-status").textContent = events.length === 0
            ? "0 — No activity in this period."
            : `Totals from ${start.toLocaleString()} to ${end.toLocaleString()}. Refresh to include new activity.`;
    } catch (error) {
        if (request !== engagementRequest || session !== generation) return;
        console.error(error);
        $("engagement-status").textContent = "Some totals could not load. Check your connection, admin access, and Firestore index, then refresh.";
    }
}
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
})[character]);

function toDate(value) {
    if (!value) return null;
    let parsed;
    try { parsed = typeof value.toDate === "function" ? value.toDate() : new Date(value); }
    catch { return null; }
    return !(parsed instanceof Date) || Number.isNaN(parsed.getTime()) ? null : parsed;
}

function timestampValue(value) {
    const date = toDate(value);
    return date ? date.getTime() : 0;
}

function formatDate(value, includeTime = false) {
    const date = toDate(value);
    if (!date) return "Not available";
    return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {})
    }).format(date);
}

function initials(name) {
    const parts = String(name || "A").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]).join("") || "A";
}

function statusBadge(status) {
    const safeStatus = String(status || "pending").toLowerCase();
    return `<span class="status-badge status-${escapeHtml(safeStatus)}">${escapeHtml(safeStatus)}</span>`;
}

function emptyState(icon, title, copy) {
    return `<div class="empty-state"><i class="fa-solid ${icon}"></i><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`;
}

function showToast(message, type = "success") {
    const toast = $("global-alert");
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 3500);
}

function renderMessages() {
    if (messageLoad !== "ready") {
        $("message-list").innerHTML = emptyState("fa-envelope", messageLoad === "error" ? "Messages unavailable" : "Loading messages…", messageLoad === "error" ? "Check your connection and access, then reload to retry." : "Waiting for Firebase.");
        return;
    }
    const search = $("message-search").value.trim().toLowerCase();
    const status = $("message-status-filter").value;
    const filtered = state.messages.filter((message) => {
        const searchable = `${message.name || ""} ${message.email || ""} ${message.subject || ""} ${message.message || ""}`.toLowerCase();
        const messageStatus = message.status || "unread";
        return searchable.includes(search) && (status === "all" || messageStatus === status);
    });

    $("message-list").innerHTML = filtered.length ? filtered.map((message) => `
        <button class="message-card ${(message.status || "unread") === "unread" ? "unread" : ""}" data-view-message="${escapeHtml(message.id)}">
            <div class="user-avatar">${escapeHtml(initials(message.name))}</div>
            <div class="message-sender"><strong>${escapeHtml(message.name || "Website visitor")}</strong><span>${escapeHtml(message.email || "No email")}</span></div>
            <div class="message-preview"><strong>${escapeHtml(message.subject || "No subject")}</strong><span>${escapeHtml(message.message || "")}</span></div>
            <div><time>${escapeHtml(formatDate(message.createdAt))}</time>${statusBadge(message.status || "unread")}</div>
        </button>
    `).join("") : emptyState("fa-envelope-open", "No messages found", state.messages.length ? "Try another search or status." : "Messages from the Contact page will appear here.");
}

function closeSidebar() {
    $("sidebar").classList.remove("open");
    $("sidebar-overlay").classList.remove("open");
    $("open-sidebar").setAttribute("aria-expanded", "false");
}

function switchView(requested) {
    const name = ["dashboard", "engagement", "messages"].includes(requested) ? requested : "dashboard";
    document.querySelectorAll(".admin-view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.view === name);
        if (item.dataset.view === name) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
    });
    $("view-title").textContent = name === "dashboard" ? "Dashboard" : name === "engagement" ? "Engagement" : "Messages";
    if (name === "engagement") void loadEngagement();
    history.replaceState(null, "", `#${name}`);
    closeSidebar();
}

function closeModal() {
    $("message-modal").classList.remove("open");
    $("message-modal").setAttribute("aria-hidden", "true");
    document.querySelector(".admin-main").inert = false;
    $("sidebar").inert = false;
    document.body.style.overflow = "";
    selectedMessage = null;
    if (returnFocus?.isConnected) returnFocus.focus();
    else document.querySelector('.nav-item.active')?.focus();
}

function renderDetails() {
    const message = state.messages.find((item) => item.id === selectedMessage);
    if (!message) {
        if (selectedMessage) closeModal();
        return;
    }
    const focusedAction = document.activeElement?.dataset.messageStatus;
    const focusedReply = document.activeElement?.hasAttribute("data-reply-message");
    $("message-modal-title").textContent = message.subject || "Visitor message";
    const status = message.status || "unread";
    const disabled = pending.has(message.id) ? "disabled" : "";
    $("message-detail-content").innerHTML = `
        <div class="detail-grid detail-section">
            <div><span>From</span><strong>${escapeHtml(message.name || "Website visitor")}</strong></div>
            <div><span>Email</span><strong>${escapeHtml(message.email || "Not available")}</strong></div>
            <div><span>Received</span><strong>${escapeHtml(formatDate(message.createdAt, true))}</strong></div>
            <div><span>Status</span><strong>${escapeHtml(status)}</strong></div>
        </div>
        <div class="detail-section"><h3>Message</h3><p class="message-copy">${escapeHtml(message.message || "No message text.")}</p></div>
        <p>After sending your email, use “Mark replied” to update this message.</p>
        <div class="modal-actions">
            <button class="secondary-button" data-message-status="read" ${disabled || (status !== "unread" ? "disabled" : "")}>Mark read</button>
            <button class="secondary-button" data-message-status="replied" ${disabled || (status === "replied" ? "disabled" : "")}>Mark replied</button>
            <button class="primary-button" data-reply-message>Reply by email</button>
        </div>`;
    if (focusedAction || focusedReply) {
        const selector = focusedReply ? "[data-reply-message]" : `[data-message-status="${focusedAction}"]`;
        const target = $("message-detail-content").querySelector(selector);
        if (target && !target.disabled) target.focus();
        else $("message-modal").querySelector("button").focus();
    }
}

function showMessageDetails(id) {
    if (!currentAdmin || !state.messages.some((message) => message.id === id)) return;
    returnFocus = document.activeElement;
    selectedMessage = id;
    renderDetails();
    $("message-modal").classList.add("open");
    $("message-modal").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.querySelector(".admin-main").inert = true;
    $("sidebar").inert = true;
    $("message-modal").querySelector("button").focus();
}

async function markMessage(status) {
    const id = selectedMessage;
    if (!currentAdmin || !id || pending.has(id) || !["read", "replied"].includes(status)) return;
    const session = generation;
    pending.add(id);
    renderDetails();
    try {
        await updateDoc(doc(db, "messages", id), {
            status, updatedAt: serverTimestamp(), updatedBy: currentAdmin.uid,
            ...(status === "read" ? { readAt: serverTimestamp(), readBy: currentAdmin.uid } : {})
        });
        if (session === generation) showToast(`Message marked as ${status}.`);
    } catch {
        if (session === generation) showToast("Could not update the message. Please try again.", "error");
    } finally {
        pending.delete(id);
        if (session === generation && selectedMessage === id) renderDetails();
    }
}

function replyToMessage() {
    const message = state.messages.find((item) => item.id === selectedMessage);
    const email = String(message?.email || "").trim();
    if (!/^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(email)) {
        showToast("This message has no valid email address.", "warning");
        return;
    }
    const subject = encodeURIComponent(`Re: ${message.subject || "Your Purrish&Co. message"}`);
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}`;
}

function renderNotifications() {
    const count = state.messages.filter((message) => (message.status || "unread") === "unread").length;
    $("message-badge").textContent = count;
    $("message-badge").classList.toggle("hidden", count === 0);
    $("notification-dot").classList.toggle("hidden", count === 0);
}

function cleanup() {
    analyticsRequest += 1;
    Object.keys(metricTypes).forEach((id) => { $(id).textContent = "Loading…"; });
    $("analytics-status").textContent = "Waiting for admin access…";
    generation += 1;
    stopMessages?.();
    stopProfile?.();
    stopMessages = stopProfile = null;
    currentAdmin = null;
    state.messages = [];
    pending.clear();
    messageLoad = "loading";
    closeModal();
    $("message-detail-content").textContent = "";
    renderMessages();
    renderNotifications();
    $("page-loader").classList.remove("hidden");
}

function accessError() {
    cleanup();
    $("page-loader").innerHTML = emptyState("fa-triangle-exclamation", "Admin access could not be checked", "Check your connection and reload to retry.") +
        '<a class="back-link" href="login.html">Return to admin sign in</a>';
}

function startAdmin(user) {
    cleanup();
    if (!user) {
        window.location.replace("login.html");
        return;
    }
    const session = generation;
    stopProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
        if (session !== generation) return;
        const profile = snapshot.exists() ? snapshot.data() : null;
        if (!profile || profile.role !== "admin" || profile.active !== true) {
            cleanup();
            window.location.replace("login.html?error=unauthorized");
            return;
        }
        currentAdmin = { ...profile, uid: user.uid, email: user.email };
        const name = String(profile.displayName || profile.name || user.email?.split("@")[0] || "Admin");
        $("admin-name").textContent = name;
        $("welcome-name").textContent = name.split(" ")[0];
        $("admin-email").textContent = user.email || "Admin";
        $("admin-avatar").textContent = initials(name);
        $("page-loader").classList.add("hidden");
        if (stopMessages) return;
        void loadAnalytics();
        if (location.hash.slice(1) === "engagement") void loadEngagement();
        stopMessages = onSnapshot(collection(db, "messages"), (messages) => {
            if (session !== generation) return;
            state.messages = messages.docs.map((item) => ({ ...item.data(), id: item.id }))
                .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
            messageLoad = "ready";
            renderMessages();
            renderNotifications();
            renderDetails();
        }, () => {
            if (session !== generation) return;
            state.messages = [];
            messageLoad = "error";
            renderMessages();
            renderNotifications();
            closeModal();
            $("message-detail-content").textContent = "";
            showToast("Could not load messages. Check your connection and access.", "error");
        });
    }, () => { if (session === generation) accessError(); });
}

document.querySelectorAll("[data-view], [data-go-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view || button.dataset.goView));
});
document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
$("open-sidebar").addEventListener("click", () => {
    $("sidebar").classList.add("open");
    $("sidebar-overlay").classList.add("open");
    $("open-sidebar").setAttribute("aria-expanded", "true");
});
$("close-sidebar").addEventListener("click", closeSidebar);
$("sidebar-overlay").addEventListener("click", closeSidebar);
$("message-search").addEventListener("input", renderMessages);
$("message-status-filter").addEventListener("change", renderMessages);
$("analytics-range").addEventListener("change", loadAnalytics);
$("analytics-refresh").addEventListener("click", loadAnalytics);
$("engagement-range").addEventListener("change", loadEngagement);
$("engagement-refresh").addEventListener("click", loadEngagement);
$("message-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view-message]");
    if (button) showMessageDetails(button.dataset.viewMessage);
});
$("message-detail-content").addEventListener("click", (event) => {
    const mark = event.target.closest("[data-message-status]");
    if (mark && !mark.disabled) void markMessage(mark.dataset.messageStatus);
    if (event.target.closest("[data-reply-message]")) replyToMessage();
});
document.addEventListener("keydown", (event) => {
    const modal = $("message-modal");
    if (event.key === "Escape") {
        if (modal.classList.contains("open")) closeModal();
        closeSidebar();
    }
    if (event.key === "Tab" && modal.classList.contains("open")) {
        const buttons = [...modal.querySelectorAll("button:not(:disabled), a[href]")];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
});
$("logout-button").addEventListener("click", async () => {
    $("logout-button").disabled = true;
    try {
        await signOut(auth);
        cleanup();
        window.location.replace("login.html");
    } catch {
        showToast("Could not sign out. Please try again.", "error");
    } finally {
        $("logout-button").disabled = false;
    }
});
window.addEventListener("hashchange", () => switchView(location.hash.slice(1)));
window.addEventListener("pagehide", cleanup);
window.addEventListener("pageshow", (event) => {
    if (event.persisted && firebaseConfigReady) startAdmin(auth.currentUser);
});
$("today-label").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
switchView(location.hash.slice(1));
renderMessages();
if (!firebaseConfigReady) window.location.replace("login.html?error=config");
else onAuthStateChanged(auth, startAdmin, accessError);
