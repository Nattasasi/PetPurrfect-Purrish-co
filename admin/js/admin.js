import { auth, db, storage, firebaseConfigReady } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
    deleteObject,
    getDownloadURL,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

const state = {
    products: [],
    orders: [],
    users: [],
    messages: []
};

let currentAdmin = null;
let toastTimer = null;

const $ = (id) => document.getElementById(id);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
})[character]);

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(value) || 0);
}

function orderNumber(order) {
    return order.orderNumber || `#${order.id.slice(0, 8).toUpperCase()}`;
}

function customerName(record) {
    return record.customerName || record.name || record.displayName || "Customer";
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

function setButtonLoading(button, loading, loadingLabel = "Saving...") {
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = loading;
    button.innerHTML = loading
        ? `<i class="fa-solid fa-circle-notch fa-spin"></i> ${escapeHtml(loadingLabel)}`
        : button.dataset.originalHtml;
}

function openModal(id) {
    const modal = $(id);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeModal(id) {
    const modal = $(id);
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal.open")) document.body.style.overflow = "";
}

function switchView(viewName) {
    document.querySelectorAll(".admin-view").forEach((view) => view.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
    $(`view-${viewName}`)?.classList.add("active");
    $("view-title").textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    history.replaceState(null, "", `#${viewName}`);
    closeSidebar();
}

function openSidebar() {
    $("sidebar").classList.add("open");
    $("sidebar-overlay").classList.add("open");
}

function closeSidebar() {
    $("sidebar").classList.remove("open");
    $("sidebar-overlay").classList.remove("open");
}

function initializeNavigation() {
    document.querySelectorAll(".nav-item").forEach((button) => {
        button.addEventListener("click", () => switchView(button.dataset.view));
    });
    document.querySelectorAll("[data-go-view]").forEach((button) => {
        button.addEventListener("click", () => switchView(button.dataset.goView));
    });
    document.querySelectorAll("[data-close-modal]").forEach((element) => {
        element.addEventListener("click", () => closeModal(element.dataset.closeModal));
    });
    $("open-sidebar").addEventListener("click", openSidebar);
    $("close-sidebar").addEventListener("click", closeSidebar);
    $("sidebar-overlay").addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") document.querySelectorAll(".modal.open").forEach((modal) => closeModal(modal.id));
    });

    const requestedView = location.hash.replace("#", "");
    if (["dashboard", "products", "orders", "users", "messages"].includes(requestedView)) {
        switchView(requestedView);
    }
}

function subscribeToCollections() {
    const subscriptions = [
        ["products", renderProducts],
        ["orders", renderOrders],
        ["users", renderUsers],
        ["messages", renderMessages]
    ];

    subscriptions.forEach(([collectionName, render]) => {
        onSnapshot(collection(db, collectionName), (snapshot) => {
            state[collectionName] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
            state[collectionName].sort((a, b) => timestampValue(b.createdAt || b.joinedAt) - timestampValue(a.createdAt || a.joinedAt));
            render();
            renderDashboard();
        }, (error) => {
            console.error(`Could not load ${collectionName}:`, error);
            showToast(`Could not load ${collectionName}. Check your Firebase rules.`, "error");
        });
    });
}

function renderDashboard() {
    const paidOrders = state.orders.filter((order) => String(order.paymentStatus).toLowerCase() === "paid");
    const totalRevenue = paidOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const attentionOrders = state.orders.filter((order) => ["pending", "processing"].includes(String(order.status).toLowerCase()));
    const customers = state.users.filter((user) => user.role !== "admin");
    const activeCustomers = customers.filter((user) => user.active !== false);
    const lowStock = state.products.filter((product) => Number(product.stock) <= 5);

    $("metric-revenue").textContent = formatCurrency(totalRevenue);
    $("metric-revenue-note").textContent = `From ${paidOrders.length} paid order${paidOrders.length === 1 ? "" : "s"}`;
    $("metric-orders").textContent = state.orders.length;
    $("metric-orders-note").textContent = `${attentionOrders.length} need attention`;
    $("metric-customers").textContent = customers.length;
    $("metric-customers-note").textContent = `${activeCustomers.length} active accounts`;
    $("metric-stock").textContent = lowStock.length;
    $("average-order").textContent = `Avg. order ${formatCurrency(paidOrders.length ? totalRevenue / paidOrders.length : 0)}`;

    const unreadMessages = state.messages.filter((message) => (message.status || "unread") === "unread").length;
    [$("message-badge"), $("notification-dot")].forEach((element) => element.classList.toggle("hidden", unreadMessages === 0));
    $("message-badge").textContent = unreadMessages;
    $("low-stock-badge").classList.toggle("hidden", lowStock.length === 0);
    $("low-stock-badge").textContent = lowStock.length;

    renderRevenueChart(paidOrders);
    renderOrderStatuses();
    renderRecentOrders();
    renderLowStock(lowStock);
}

function renderRevenueChart(paidOrders) {
    const months = [];
    const today = new Date();
    for (let offset = 5; offset >= 0; offset -= 1) {
        const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
        months.push({
            year: date.getFullYear(),
            month: date.getMonth(),
            label: date.toLocaleString("en-US", { month: "short" }),
            total: 0
        });
    }

    paidOrders.forEach((order) => {
        const date = toDate(order.createdAt);
        if (!date) return;
        const target = months.find((month) => month.year === date.getFullYear() && month.month === date.getMonth());
        if (target) target.total += Number(order.total) || 0;
    });

    const maximum = Math.max(...months.map((month) => month.total), 1);
    $("revenue-chart").innerHTML = months.map((month) => `
        <div class="bar-column" title="${escapeHtml(month.label)}: ${escapeHtml(formatCurrency(month.total))}">
            <b>${month.total ? escapeHtml(formatCurrency(month.total).replace(".00", "")) : ""}</b>
            <i class="bar-fill" style="height:${Math.max((month.total / maximum) * 145, month.total ? 8 : 4)}px"></i>
            <span>${escapeHtml(month.label)}</span>
        </div>
    `).join("");
}

function renderOrderStatuses() {
    const statuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    const maximum = Math.max(state.orders.length, 1);
    $("order-status-list").innerHTML = statuses.map((status) => {
        const count = state.orders.filter((order) => (order.status || "pending") === status).length;
        return `<div class="status-row"><span>${status}</span><div class="progress-track"><i style="width:${(count / maximum) * 100}%"></i></div><b>${count}</b></div>`;
    }).join("");
}

function renderRecentOrders() {
    const recentOrders = state.orders.slice(0, 5);
    $("recent-orders-body").innerHTML = recentOrders.length ? recentOrders.map((order) => `
        <tr>
            <td><strong>${escapeHtml(orderNumber(order))}</strong></td>
            <td>${escapeHtml(customerName(order))}</td>
            <td>${escapeHtml(formatCurrency(order.total))}</td>
            <td>${statusBadge(order.status)}</td>
        </tr>
    `).join("") : `<tr><td colspan="4">${emptyState("fa-bag-shopping", "No orders yet", "New customer orders will appear here.")}</td></tr>`;
}

function renderLowStock(products) {
    $("low-stock-list").innerHTML = products.length ? products.slice(0, 5).map((product) => `
        <div class="mini-list-item">
            <div class="mini-list-icon"><i class="fa-solid fa-box"></i></div>
            <div><strong>${escapeHtml(product.name || "Unnamed product")}</strong><span>${Number(product.stock) || 0} left in stock</span></div>
        </div>
    `).join("") : emptyState("fa-circle-check", "Stock looks good", "No products are currently low in stock.");
}

function renderProducts() {
    const search = $("product-search").value.trim().toLowerCase();
    const category = $("product-category-filter").value;
    const categories = [...new Set(state.products.map((product) => product.category).filter(Boolean))].sort();
    const previousCategory = category;
    $("product-category-filter").innerHTML = '<option value="all">All categories</option>'
        + categories.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    $("product-category-filter").value = categories.includes(previousCategory) ? previousCategory : "all";

    const filtered = state.products.filter((product) => {
        const matchesSearch = `${product.name || ""} ${product.category || ""}`.toLowerCase().includes(search);
        const matchesCategory = $("product-category-filter").value === "all" || product.category === $("product-category-filter").value;
        return matchesSearch && matchesCategory;
    });

    $("product-count").textContent = state.products.length;
    $("active-product-count").textContent = state.products.filter((product) => product.active !== false).length;
    $("inventory-value").textContent = formatCurrency(state.products.reduce((sum, product) => sum + ((Number(product.price) || 0) * (Number(product.stock) || 0)), 0));

    $("product-grid").innerHTML = filtered.length ? filtered.map((product) => {
        const hasImage = Boolean(product.imageUrl);
        const stock = Number(product.stock) || 0;
        return `
            <article class="admin-product-card">
                <div class="admin-product-image">
                    ${hasImage ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name || "Product")}" data-product-image>` : ""}
                    <div class="image-fallback ${hasImage ? "hidden" : ""}"><i class="fa-solid fa-paw"></i></div>
                    <span class="visibility-label ${product.active === false ? "inactive" : "active"}">${product.active === false ? "Hidden" : "Visible"}</span>
                </div>
                <div class="admin-product-body">
                    <div class="product-meta">
                        <div><h3>${escapeHtml(product.name || "Unnamed product")}</h3><span>${escapeHtml(product.category || "Uncategorized")}</span></div>
                        <b>${escapeHtml(formatCurrency(product.price))}</b>
                    </div>
                    <div class="stock-line">
                        <span class="${stock <= 5 ? "stock-low" : "stock-ok"}">${stock} in stock</span>
                        <div class="card-actions">
                            <button data-edit-product="${product.id}" aria-label="Edit product"><i class="fa-solid fa-pen"></i></button>
                            <button class="delete-action" data-delete-product="${product.id}" aria-label="Delete product"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </article>`;
    }).join("") : emptyState("fa-box-open", "No products found", state.products.length ? "Try a different search or category." : "Add your first product to start managing the store.");

    document.querySelectorAll("[data-product-image]").forEach((image) => {
        image.addEventListener("error", () => {
            image.remove();
            image.parentElement.querySelector(".image-fallback")?.classList.remove("hidden");
        });
    });
}

function openProductForm(product = null) {
    $("product-form").reset();
    $("product-id").value = product?.id || "";
    $("product-name").value = product?.name || "";
    $("product-category").value = product?.category || "";
    $("product-price").value = product?.price ?? "";
    $("product-stock").value = product?.stock ?? "";
    $("product-description").value = product?.description || "";
    $("product-image-url").value = product?.imageUrl || "";
    $("product-active").checked = product?.active !== false;
    $("product-modal-title").textContent = product ? "Edit product" : "Add product";
    openModal("product-modal");
    setTimeout(() => $("product-name").focus(), 50);
}

async function saveProduct(event) {
    event.preventDefault();
    const button = $("save-product-button");
    const productId = $("product-id").value;
    const existing = state.products.find((product) => product.id === productId);
    const imageFile = $("product-image").files[0];

    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
        showToast("Product image must be smaller than 5 MB.", "warning");
        return;
    }

    setButtonLoading(button, true, "Saving...");
    let newImagePath = null;
    try {
        let imageUrl = $("product-image-url").value.trim();
        let imagePath = existing?.imagePath || "";
        let shouldDeleteOldImage = Boolean(existing?.imagePath && imageUrl !== (existing?.imageUrl || ""));

        if (imageFile) {
            const safeFilename = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
            newImagePath = `products/${Date.now()}-${safeFilename}`;
            const imageReference = ref(storage, newImagePath);
            await uploadBytes(imageReference, imageFile, { contentType: imageFile.type });
            imageUrl = await getDownloadURL(imageReference);
            imagePath = newImagePath;
            shouldDeleteOldImage = Boolean(existing?.imagePath && existing.imagePath !== newImagePath);
        } else if (shouldDeleteOldImage) {
            imagePath = "";
        }

        const productData = {
            name: $("product-name").value.trim(),
            category: $("product-category").value.trim(),
            price: Number($("product-price").value),
            stock: Number($("product-stock").value),
            description: $("product-description").value.trim(),
            active: $("product-active").checked,
            imageUrl,
            imagePath,
            updatedAt: serverTimestamp(),
            updatedBy: currentAdmin.uid
        };

        if (productId) {
            await updateDoc(doc(db, "products", productId), productData);
        } else {
            await addDoc(collection(db, "products"), { ...productData, createdAt: serverTimestamp() });
        }

        if (shouldDeleteOldImage && existing?.imagePath) {
            deleteObject(ref(storage, existing.imagePath)).catch((error) => console.warn("Old image cleanup failed:", error));
        }

        closeModal("product-modal");
        showToast(productId ? "Product updated successfully." : "Product added successfully.");
    } catch (error) {
        console.error(error);
        if (newImagePath) deleteObject(ref(storage, newImagePath)).catch(() => {});
        showToast("Could not save the product. Check Firebase Storage and Firestore rules.", "error");
    } finally {
        setButtonLoading(button, false);
    }
}

async function removeProduct(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product || !window.confirm(`Delete “${product.name || "this product"}”? This cannot be undone.`)) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        if (product.imagePath) deleteObject(ref(storage, product.imagePath)).catch((error) => console.warn("Image cleanup failed:", error));
        showToast("Product deleted.");
    } catch (error) {
        console.error(error);
        showToast("Could not delete the product.", "error");
    }
}

function renderOrders() {
    const search = $("order-search").value.trim().toLowerCase();
    const status = $("order-status-filter").value;
    const filtered = state.orders.filter((order) => {
        const searchable = `${orderNumber(order)} ${customerName(order)} ${order.customerEmail || order.email || ""}`.toLowerCase();
        return searchable.includes(search) && (status === "all" || (order.status || "pending") === status);
    });

    $("orders-body").innerHTML = filtered.length ? filtered.map((order) => `
        <tr>
            <td><strong>${escapeHtml(orderNumber(order))}</strong></td>
            <td><div class="customer-cell"><div class="user-avatar">${escapeHtml(initials(customerName(order)))}</div><div><strong>${escapeHtml(customerName(order))}</strong><span>${escapeHtml(order.customerEmail || order.email || "No email")}</span></div></div></td>
            <td>${escapeHtml(formatDate(order.createdAt))}</td>
            <td>${Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0) : Number(order.itemCount) || 0}</td>
            <td><strong>${escapeHtml(formatCurrency(order.total))}</strong></td>
            <td>${statusBadge(order.paymentStatus || "unpaid")}</td>
            <td>
                <select class="inline-status-select" data-order-status="${order.id}" aria-label="Update order status">
                    ${["pending", "processing", "shipped", "delivered", "cancelled"].map((item) => `<option value="${item}" ${(order.status || "pending") === item ? "selected" : ""}>${item.charAt(0).toUpperCase() + item.slice(1)}</option>`).join("")}
                </select>
            </td>
            <td><button class="row-action" data-view-order="${order.id}" aria-label="View order"><i class="fa-regular fa-eye"></i></button></td>
        </tr>
    `).join("") : `<tr><td colspan="8">${emptyState("fa-bag-shopping", "No orders found", state.orders.length ? "Try another search or status." : "Orders will appear after customers complete checkout.")}</td></tr>`;
}

async function updateOrderStatus(orderId, status, select) {
    select.disabled = true;
    try {
        await updateDoc(doc(db, "orders", orderId), {
            status,
            updatedAt: serverTimestamp(),
            updatedBy: currentAdmin.uid
        });
        showToast(`Order marked as ${status}.`);
    } catch (error) {
        console.error(error);
        showToast("Could not update order status.", "error");
        renderOrders();
    } finally {
        select.disabled = false;
    }
}

function showOrderDetails(orderId) {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;
    $("order-modal-title").textContent = orderNumber(order);
    const items = Array.isArray(order.items) ? order.items : [];
    $("order-detail-content").innerHTML = `
        <div class="detail-section">
            <h3>Customer</h3>
            <div class="detail-grid">
                <div><span>Name</span><strong>${escapeHtml(customerName(order))}</strong></div>
                <div><span>Email</span><strong>${escapeHtml(order.customerEmail || order.email || "Not available")}</strong></div>
                <div><span>Phone</span><strong>${escapeHtml(order.customerPhone || order.phone || "Not available")}</strong></div>
                <div><span>Placed</span><strong>${escapeHtml(formatDate(order.createdAt, true))}</strong></div>
            </div>
        </div>
        <div class="detail-section">
            <h3>Delivery</h3>
            <p class="message-copy">${escapeHtml(order.shippingAddress || order.address || "No delivery address recorded.")}</p>
        </div>
        <div class="detail-section">
            <h3>Items</h3>
            ${items.length ? items.map((item) => `<div class="order-item"><div><strong>${escapeHtml(item.name || "Product")}</strong><span> × ${Number(item.quantity) || 1}</span></div><b>${escapeHtml(formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 1)))}</b></div>`).join("") : '<p class="message-copy">No item details recorded.</p>'}
            <div class="order-item"><strong>Total</strong><b>${escapeHtml(formatCurrency(order.total))}</b></div>
        </div>
        <div class="detail-grid">
            <div><span>Payment</span><strong>${escapeHtml(order.paymentStatus || "unpaid")}</strong></div>
            <div><span>Status</span><strong>${escapeHtml(order.status || "pending")}</strong></div>
        </div>`;
    openModal("order-modal");
}

function userOrderSummary(user) {
    const matchingOrders = state.orders.filter((order) =>
        (order.userId && order.userId === user.id)
        || (!order.userId && user.email && (order.customerEmail || order.email) === user.email)
    );
    return {
        count: matchingOrders.length,
        spent: matchingOrders
            .filter((order) => String(order.paymentStatus).toLowerCase() === "paid")
            .reduce((sum, order) => sum + (Number(order.total) || 0), 0)
    };
}

function renderUsers() {
    const search = $("user-search").value.trim().toLowerCase();
    const status = $("user-status-filter").value;
    const filtered = state.users.filter((user) => {
        const searchable = `${customerName(user)} ${user.email || ""}`.toLowerCase();
        const userStatus = user.active === false ? "blocked" : "active";
        return searchable.includes(search) && (status === "all" || status === userStatus);
    });

    $("users-body").innerHTML = filtered.length ? filtered.map((user) => {
        const summary = userOrderSummary(user);
        const isAdmin = user.role === "admin";
        const isActive = user.active !== false;
        return `
            <tr>
                <td><div class="customer-cell"><div class="user-avatar">${escapeHtml(initials(customerName(user)))}</div><div><strong>${escapeHtml(customerName(user))}</strong><span>${escapeHtml(user.email || "No email")}</span></div></div></td>
                <td>${statusBadge(user.role || "customer")}</td>
                <td>${escapeHtml(formatDate(user.createdAt || user.joinedAt))}</td>
                <td>${summary.count}</td>
                <td>${escapeHtml(formatCurrency(summary.spent))}</td>
                <td>${statusBadge(isActive ? "active" : "blocked")}</td>
                <td><button class="row-action" data-toggle-user="${user.id}" data-next-active="${!isActive}" ${isAdmin ? "disabled" : ""} aria-label="${isActive ? "Block" : "Activate"} user" title="${isAdmin ? "Admin accounts cannot be blocked here" : isActive ? "Block user" : "Activate user"}"><i class="fa-solid ${isActive ? "fa-user-lock" : "fa-user-check"}"></i></button></td>
            </tr>`;
    }).join("") : `<tr><td colspan="7">${emptyState("fa-users", "No users found", state.users.length ? "Try another search or status." : "Customer profiles will appear here after registration.")}</td></tr>`;
}

async function toggleUser(userId, nextActive) {
    const user = state.users.find((item) => item.id === userId);
    if (!user || user.role === "admin") return;
    const action = nextActive ? "activate" : "block";
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${customerName(user)}?`)) return;
    try {
        await updateDoc(doc(db, "users", userId), {
            active: nextActive,
            updatedAt: serverTimestamp(),
            updatedBy: currentAdmin.uid
        });
        showToast(`User ${nextActive ? "activated" : "blocked"}.`);
    } catch (error) {
        console.error(error);
        showToast("Could not update the user.", "error");
    }
}

function renderMessages() {
    const search = $("message-search").value.trim().toLowerCase();
    const status = $("message-status-filter").value;
    const filtered = state.messages.filter((message) => {
        const searchable = `${message.name || ""} ${message.email || ""} ${message.subject || ""} ${message.message || ""}`.toLowerCase();
        const messageStatus = message.status || "unread";
        return searchable.includes(search) && (status === "all" || messageStatus === status);
    });

    $("message-list").innerHTML = filtered.length ? filtered.map((message) => `
        <button class="message-card ${(message.status || "unread") === "unread" ? "unread" : ""}" data-view-message="${message.id}">
            <div class="user-avatar">${escapeHtml(initials(message.name))}</div>
            <div class="message-sender"><strong>${escapeHtml(message.name || "Website visitor")}</strong><span>${escapeHtml(message.email || "No email")}</span></div>
            <div class="message-preview"><strong>${escapeHtml(message.subject || "No subject")}</strong><span>${escapeHtml(message.message || "")}</span></div>
            <div><time>${escapeHtml(formatDate(message.createdAt))}</time>${statusBadge(message.status || "unread")}</div>
        </button>
    `).join("") : emptyState("fa-envelope-open", "No messages found", state.messages.length ? "Try another search or status." : "Messages from the Contact page will appear here.");
}

async function showMessageDetails(messageId) {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message) return;
    $("message-modal-title").textContent = message.subject || "Customer message";
    $("message-detail-content").innerHTML = `
        <div class="detail-grid detail-section">
            <div><span>From</span><strong>${escapeHtml(message.name || "Website visitor")}</strong></div>
            <div><span>Email</span><strong>${escapeHtml(message.email || "Not available")}</strong></div>
            <div><span>Received</span><strong>${escapeHtml(formatDate(message.createdAt, true))}</strong></div>
            <div><span>Status</span><strong>${escapeHtml(message.status || "unread")}</strong></div>
        </div>
        <div class="detail-section"><h3>Message</h3><p class="message-copy">${escapeHtml(message.message || "No message text.")}</p></div>
        <div class="modal-actions">
            <button class="secondary-button" data-mark-message="${message.id}" data-message-status="read"><i class="fa-solid fa-check"></i> Mark read</button>
            <button class="primary-button" data-reply-message="${message.id}"><i class="fa-solid fa-reply"></i> Reply by email</button>
        </div>`;
    openModal("message-modal");
    if ((message.status || "unread") === "unread") {
        try {
            await updateDoc(doc(db, "messages", messageId), { status: "read", readAt: serverTimestamp(), readBy: currentAdmin.uid });
        } catch (error) {
            console.error(error);
        }
    }
}

async function markMessage(messageId, status) {
    try {
        await updateDoc(doc(db, "messages", messageId), {
            status,
            updatedAt: serverTimestamp(),
            updatedBy: currentAdmin.uid
        });
        closeModal("message-modal");
        showToast(`Message marked as ${status}.`);
    } catch (error) {
        console.error(error);
        showToast("Could not update the message.", "error");
    }
}

async function replyToMessage(messageId) {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message?.email) {
        showToast("This message has no email address.", "warning");
        return;
    }
    await markMessage(messageId, "replied");
    const subject = encodeURIComponent(`Re: ${message.subject || "Your Purrish&Co. message"}`);
    window.location.href = `mailto:${encodeURIComponent(message.email)}?subject=${subject}`;
}

function initializeEventHandlers() {
    $("add-product-button").addEventListener("click", () => openProductForm());
    $("product-form").addEventListener("submit", saveProduct);
    $("product-search").addEventListener("input", renderProducts);
    $("product-category-filter").addEventListener("change", renderProducts);
    $("order-search").addEventListener("input", renderOrders);
    $("order-status-filter").addEventListener("change", renderOrders);
    $("user-search").addEventListener("input", renderUsers);
    $("user-status-filter").addEventListener("change", renderUsers);
    $("message-search").addEventListener("input", renderMessages);
    $("message-status-filter").addEventListener("change", renderMessages);

    $("product-grid").addEventListener("click", (event) => {
        const editButton = event.target.closest("[data-edit-product]");
        const deleteButton = event.target.closest("[data-delete-product]");
        if (editButton) openProductForm(state.products.find((product) => product.id === editButton.dataset.editProduct));
        if (deleteButton) removeProduct(deleteButton.dataset.deleteProduct);
    });

    $("orders-body").addEventListener("change", (event) => {
        const select = event.target.closest("[data-order-status]");
        if (select) updateOrderStatus(select.dataset.orderStatus, select.value, select);
    });
    $("orders-body").addEventListener("click", (event) => {
        const button = event.target.closest("[data-view-order]");
        if (button) showOrderDetails(button.dataset.viewOrder);
    });
    $("users-body").addEventListener("click", (event) => {
        const button = event.target.closest("[data-toggle-user]");
        if (button) toggleUser(button.dataset.toggleUser, button.dataset.nextActive === "true");
    });
    $("message-list").addEventListener("click", (event) => {
        const button = event.target.closest("[data-view-message]");
        if (button) showMessageDetails(button.dataset.viewMessage);
    });
    $("message-detail-content").addEventListener("click", (event) => {
        const markButton = event.target.closest("[data-mark-message]");
        const replyButton = event.target.closest("[data-reply-message]");
        if (markButton) markMessage(markButton.dataset.markMessage, markButton.dataset.messageStatus);
        if (replyButton) replyToMessage(replyButton.dataset.replyMessage);
    });

    $("logout-button").addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.replace("login.html");
        } catch (error) {
            showToast("Could not sign out. Please try again.", "error");
        }
    });
}

async function authorizeAdmin(user) {
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    if (!profileSnapshot.exists()) return null;
    const profile = profileSnapshot.data();
    if (profile.role !== "admin" || profile.active === false) return null;
    return { uid: user.uid, email: user.email, ...profile };
}

async function startAdmin(user) {
    try {
        currentAdmin = await authorizeAdmin(user);
        if (!currentAdmin) {
            await signOut(auth);
            window.location.replace("login.html?error=unauthorized");
            return;
        }

        const displayName = currentAdmin.displayName || currentAdmin.name || user.email?.split("@")[0] || "Admin";
        $("admin-name").textContent = displayName;
        $("welcome-name").textContent = displayName.split(" ")[0];
        $("admin-email").textContent = user.email || currentAdmin.email || "Admin";
        $("admin-avatar").textContent = initials(displayName);
        $("today-label").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

        initializeNavigation();
        initializeEventHandlers();
        subscribeToCollections();
        $("page-loader").classList.add("hidden");
    } catch (error) {
        console.error(error);
        $("page-loader").innerHTML = emptyState("fa-triangle-exclamation", "Admin access could not be checked", "Check your Firebase configuration and Firestore security rules, then reload this page.");
    }
}

if (!firebaseConfigReady) {
    window.location.replace("login.html?error=config");
} else {
    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.replace("login.html");
        else startAdmin(user);
    });
}
