/* =========================================================
   KIPAN A - APP.JS
   FRONTEND + API CONNECTION
========================================================= */

"use strict";

/* =========================================================
   GLOBAL STATE
========================================================= */

let adminData = {
    users: [],
    bills: [],
    payments: [],
    paymentConfig: null,
    stats: {
        totalMembers: 0,
        totalLunas: 0,
        totalMenunggak: 0,
        totalKas: 0
    }
};

let memberData = {
    bills: [],
    paymentConfig: null
};

/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupLoginForm();
        setupRegisterForm();
        setupSettingsForm();
        setupAdminBillForm();
        setupPaymentConfigForm();
        setupAdminEditForm();

        updateNavVisibility();

        const token =
            localStorage.getItem("token");

        const userJson =
            localStorage.getItem("user");

        if (
            token &&
            userJson
        ) {
            try {

                const user =
                    JSON.parse(userJson);

                if (
                    user.role === "admin"
                ) {
                    navigate("sec-admin");
                } else {
                    navigate("sec-dashboard");
                }

            } catch (err) {

                console.error(
                    "Local user error:",
                    err
                );

                logout(false);
            }

        } else {

            navigate(
                "sec-auth",
                false
            );
        }
    }
);

/* =========================================================
   API HELPER
========================================================= */

async function apiFetch(
    url,
    options = {}
) {

    const token =
        localStorage.getItem("token");

    const headers = {
        ...(options.headers || {})
    };

    if (
        options.body &&
        !headers["Content-Type"]
    ) {
        headers["Content-Type"] =
            "application/json";
    }

    if (token) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    const response =
        await fetch(
            url,
            {
                ...options,
                headers
            }
        );

    let data = null;

    try {
        data =
            await response.json();
    } catch (_) {
        data = null;
    }

    if (
        response.status === 401 &&
        token
    ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        updateNavVisibility();

        if (
            typeof navigate ===
            "function"
        ) {
            navigate(
                "sec-auth",
                false
            );
        }
    }

    if (!response.ok) {

        const message =
            data?.message ||
            `Server error ${response.status}`;

        throw new Error(message);
    }

    return data;
}

/* =========================================================
   NAVIGATION
========================================================= */

function navigate(
    sectionId,
    shouldUpdate = true
) {

    const sections =
        document.querySelectorAll(
            ".section-box"
        );

    sections.forEach(
        (section) => {
            section.classList.remove(
                "active"
            );
        }
    );

    const target =
        document.getElementById(
            sectionId
        );

    if (!target) {
        return;
    }

    target.classList.add(
        "active"
    );

    if (!shouldUpdate) {
        return;
    }

    if (
        sectionId ===
        "sec-dashboard"
    ) {
        loadMemberDashboard();
    }

    if (
        sectionId ===
        "sec-admin"
    ) {
        loadAdminData();
    }

    if (
        sectionId ===
        "sec-settings"
    ) {
        loadUserSettingsForm();
    }
}

/* =========================================================
   NAVBAR
========================================================= */

function updateNavVisibility() {

    const token =
        localStorage.getItem("token");

    const userJson =
        localStorage.getItem("user");

    const navAuth =
        document.getElementById(
            "nav-auth"
        );

    const navDashboard =
        document.getElementById(
            "nav-dashboard"
        );

    const navSettings =
        document.getElementById(
            "nav-settings"
        );

    const navAdmin =
        document.getElementById(
            "nav-admin"
        );

    const navLogout =
        document.getElementById(
            "nav-logout"
        );

    if (
        token &&
        userJson
    ) {

        let user;

        try {
            user =
                JSON.parse(
                    userJson
                );
        } catch (_) {
            return;
        }

        if (navAuth) {
            navAuth.style.display =
                "none";
        }

        if (navDashboard) {
            navDashboard.style.display =
                "inline-block";
        }

        if (navSettings) {
            navSettings.style.display =
                "inline-block";
        }

        if (navLogout) {
            navLogout.style.display =
                "inline-block";
        }

        if (
            navAdmin &&
            user.role === "admin"
        ) {
            navAdmin.style.display =
                "inline-block";
        } else if (navAdmin) {
            navAdmin.style.display =
                "none";
        }

    } else {

        if (navAuth) {
            navAuth.style.display =
                "inline-block";
        }

        if (navDashboard) {
            navDashboard.style.display =
                "none";
        }

        if (navSettings) {
            navSettings.style.display =
                "none";
        }

        if (navAdmin) {
            navAdmin.style.display =
                "none";
        }

        if (navLogout) {
            navLogout.style.display =
                "none";
        }
    }
}

/* =========================================================
   LOGIN
========================================================= */

function setupLoginForm() {

    const form =
        document.getElementById(
            "form-login"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const username =
                document
                    .getElementById(
                        "log-username"
                    )
                    .value
                    .trim();

            const password =
                document
                    .getElementById(
                        "log-password"
                    )
                    .value;

            try {

                showAlert(
                    "Menghubungi markas...",
                    "success"
                );

                const result =
                    await apiFetch(
                        "/api/login",
                        {
                            method: "POST",
                            body:
                                JSON.stringify({
                                    username,
                                    password
                                })
                        }
                    );

                if (
                    !result.success
                ) {
                    throw new Error(
                        result.message
                    );
                }

                localStorage.setItem(
                    "token",
                    result.token
                );

                localStorage.setItem(
                    "user",
                    JSON.stringify(
                        result.user
                    )
                );

                updateNavVisibility();

                showAlert(
                    "Login berhasil.",
                    "success"
                );

                form.reset();

                setTimeout(
                    () => {

                        if (
                            result.user
                                .role ===
                            "admin"
                        ) {
                            navigate(
                                "sec-admin"
                            );
                        } else {
                            navigate(
                                "sec-dashboard"
                            );
                        }

                    },
                    300
                );

            } catch (err) {

                console.error(
                    "[LOGIN]",
                    err
                );

                showAlert(
                    err.message ||
                        "Login gagal.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   REGISTER
========================================================= */

function setupRegisterForm() {

    const form =
        document.getElementById(
            "form-register"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const fullname =
                document
                    .getElementById(
                        "reg-fullname"
                    )
                    .value
                    .trim();

            const pangkat =
                document
                    .getElementById(
                        "reg-pangkat"
                    )
                    .value;

            const nrp =
                document
                    .getElementById(
                        "reg-nrp"
                    )
                    .value
                    .trim();

            const username =
                document
                    .getElementById(
                        "reg-username"
                    )
                    .value
                    .trim();

            const password =
                document
                    .getElementById(
                        "reg-password"
                    )
                    .value;

            try {

                const result =
                    await apiFetch(
                        "/api/register",
                        {
                            method: "POST",
                            body:
                                JSON.stringify({
                                    fullname,
                                    pangkat,
                                    nrp,
                                    username,
                                    password
                                })
                        }
                    );

                if (
                    !result.success
                ) {
                    throw new Error(
                        result.message
                    );
                }

                showAlert(
                    "Personel berhasil didaftarkan. Silakan login.",
                    "success"
                );

                form.reset();

            } catch (err) {

                console.error(
                    "[REGISTER]",
                    err
                );

                showAlert(
                    err.message ||
                        "Pendaftaran gagal.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   LOGOUT
========================================================= */

function logout(
    showMessage = true
) {

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "user"
    );

    updateNavVisibility();

    navigate(
        "sec-auth",
        false
    );

    if (showMessage) {
        showAlert(
            "Berhasil keluar dari Markas.",
            "success"
        );
    }
}

/* =========================================================
   MEMBER DASHBOARD
========================================================= */

async function loadMemberDashboard() {

    const userJson =
        localStorage.getItem("user");

    if (!userJson) {
        return;
    }

    let user;

    try {
        user =
            JSON.parse(userJson);
    } catch (_) {
        return;
    }

    const dashUser =
        document.getElementById(
            "dash-user"
        );

    if (dashUser) {
        dashUser.innerText =
            `${user.fullname} (${user.pangkat} - NRP: ${user.nrp})`;
    }

    try {

        const result =
            await apiFetch(
                "/api/member/dashboard"
            );

        memberData =
            result;

        renderMemberPayments(
            result.bills || []
        );

    } catch (err) {

        console.error(
            "[MEMBER DASHBOARD]",
            err
        );

        showAlert(
            err.message ||
                "Gagal mengambil tagihan.",
            "error"
        );
    }
}

/* =========================================================
   RENDER MEMBER PAYMENTS
========================================================= */

function renderMemberPayments(
    payments
) {

    const tbody =
        document.getElementById(
            "member-pay-table"
        );

    if (!tbody) {
        return;
    }

    if (
        !payments ||
        payments.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    BELUM ADA TAGIHAN IURAN
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        payments
            .map(
                (payment) => {

                    const status =
                        String(
                            payment.status ||
                            ""
                        );

                    let statusText =
                        "MENUNGGAK";

                    if (
                        status ===
                        "lunas"
                    ) {
                        statusText =
                            "LUNAS";
                    }

                    if (
                        status ===
                        "menunggu_verifikasi"
                    ) {
                        statusText =
                            "MENUNGGU VERIFIKASI";
                    }

                    let action =
                        "";

                    if (
                        status ===
                        "menunggak"
                    ) {

                        action = `
                            <button
                                type="button"
                                class="btn-action"
                                onclick="openQris(${payment.payment_id})"
                            >
                                BAYAR
                            </button>
                        `;

                    } else if (
                        status ===
                        "menunggu_verifikasi"
                    ) {

                        action = `
                            <span>
                                MENUNGGU
                            </span>
                        `;

                    } else {

                        action = `
                            <span>
                                ✓ SELESAI
                            </span>
                        `;
                    }

                    return `
                        <tr>
                            <td>
                                ${escapeHtml(
                                    payment.bill_id
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    payment.description
                                )}
                            </td>

                            <td>
                                ${formatRupiah(
                                    payment.amount
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    statusText
                                )}
                            </td>

                            <td>
                                ${action}
                            </td>
                        </tr>
                    `;
                }
            )
            .join("");
}

/* =========================================================
   QRIS MODAL
========================================================= */

function openQris(
    paymentId
) {

    const payment =
        memberData.bills.find(
            (item) =>
                Number(
                    item.payment_id
                ) ===
                Number(paymentId)
        );

    if (!payment) {

        showAlert(
            "Data tagihan tidak ditemukan.",
            "error"
        );

        return;
    }

    const config =
        memberData.paymentConfig;

    const modal =
        document.getElementById(
            "modal-qris"
        );

    if (!modal) {
        return;
    }

    const billInfo =
        document.getElementById(
            "qris-bill-info"
        );

    const barcode =
        document.getElementById(
            "qris-barcode"
        );

    const bankName =
        document.getElementById(
            "modal-bank-name"
        );

    const bankAcc =
        document.getElementById(
            "modal-bank-acc"
        );

    const bankHolder =
        document.getElementById(
            "modal-bank-holder"
        );

    if (billInfo) {

        billInfo.innerText =
            `${payment.description} — ${formatRupiah(payment.amount)}`;
    }

    if (bankName) {
        bankName.innerText =
            config?.bank_name ||
            "-";
    }

    if (bankAcc) {
        bankAcc.innerText =
            config?.account_number ||
            "-";
    }

    if (bankHolder) {
        bankHolder.innerText =
            config?.account_holder ||
            "-";
    }

    /*
     * Generate QR dari payload.
     *
     * QuickChart hanya dipakai sebagai
     * renderer gambar QR.
     */
    if (barcode) {

        const payload =
            config?.qris_payload ||
            "";

        if (payload) {

            barcode.src =
                "https://quickchart.io/qr" +
                "?size=300" +
                "&text=" +
                encodeURIComponent(
                    payload
                );

        } else {

            barcode.removeAttribute(
                "src"
            );
        }
    }

    modal.dataset.paymentId =
        String(paymentId);

    modal.style.display =
        "flex";

    const radar =
        document.getElementById(
            "radar-text"
        );

    if (radar) {
        radar.innerText =
            "Menunggu konfirmasi pembayaran...";
    }
}

/* =========================================================
   CLOSE QRIS
========================================================= */

function closeQris() {

    const modal =
        document.getElementById(
            "modal-qris"
        );

    if (modal) {
        modal.style.display =
            "none";
    }
}

/* =========================================================
   CONFIRM PAYMENT
========================================================= */

async function confirmPayment() {

    const modal =
        document.getElementById(
            "modal-qris"
        );

    if (!modal) {
        return;
    }

    const paymentId =
        Number(
            modal.dataset.paymentId
        );

    if (!paymentId) {
        return;
    }

    try {

        const result =
            await apiFetch(
                `/api/member/payments/${paymentId}/request`,
                {
                    method: "POST"
                }
            );

        if (
            !result.success
        ) {
            throw new Error(
                result.message
            );
        }

        closeQris();

        showAlert(
            "Pembayaran dikirim. Tunggu verifikasi Komando.",
            "success"
        );

        await loadMemberDashboard();

    } catch (err) {

        console.error(
            "[CONFIRM PAYMENT]",
            err
        );

        showAlert(
            err.message ||
                "Gagal mengirim pembayaran.",
            "error"
        );
    }
}

/* =========================================================
   SETTINGS FORM
========================================================= */

function setupSettingsForm() {

    const form =
        document.getElementById(
            "form-settings"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const fullname =
                document
                    .getElementById(
                        "set-fullname"
                    )
                    .value
                    .trim();

            const pangkat =
                document
                    .getElementById(
                        "set-pangkat"
                    )
                    .value;

            const nrp =
                document
                    .getElementById(
                        "set-nrp"
                    )
                    .value
                    .trim();

            const password =
                document
                    .getElementById(
                        "set-password"
                    )
                    .value;

            try {

                const result =
                    await apiFetch(
                        "/api/user/profile",
                        {
                            method: "PUT",
                            body:
                                JSON.stringify({
                                    fullname,
                                    pangkat,
                                    nrp,
                                    password
                                })
                        }
                    );

                if (
                    !result.success
                ) {
                    throw new Error(
                        result.message
                    );
                }

                if (result.user) {

                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            result.user
                        )
                    );
                }

                document.getElementById(
                    "set-password"
                ).value = "";

                showAlert(
                    "Profil berhasil diperbarui.",
                    "success"
                );

                await loadMemberDashboard();

            } catch (err) {

                console.error(
                    "[SETTINGS]",
                    err
                );

                showAlert(
                    err.message ||
                        "Gagal memperbarui profil.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   LOAD SETTINGS
========================================================= */

async function loadUserSettingsForm() {

    try {

        const result =
            await apiFetch(
                "/api/user/profile"
            );

        if (
            !result.success ||
            !result.user
        ) {
            return;
        }

        const user =
            result.user;

        localStorage.setItem(
            "user",
            JSON.stringify(user)
        );

        const fullname =
            document.getElementById(
                "set-fullname"
            );

        const pangkat =
            document.getElementById(
                "set-pangkat"
            );

        const nrp =
            document.getElementById(
                "set-nrp"
            );

        if (fullname) {
            fullname.value =
                user.fullname || "";
        }

        if (pangkat) {
            pangkat.value =
                user.pangkat || "Prada";
        }

        if (nrp) {
            nrp.value =
                user.nrp || "";
        }

    } catch (err) {

        console.error(
            "[LOAD SETTINGS]",
            err
        );
    }
}

/* =========================================================
   ADMIN LOAD DATA
========================================================= */

async function loadAdminData() {

    try {

        const result =
            await apiFetch(
                "/api/admin/data"
            );

        if (
            !result.success
        ) {
            throw new Error(
                result.message
            );
        }

        adminData =
            result;

        renderAdminStats(
            result.stats
        );

        renderAdminUsers(
            result.users || []
        );

        renderUnpaidPayments(
            result.payments || []
        );

        renderPaidPayments(
            result.payments || []
        );

        fillPaymentConfig(
            result.paymentConfig
        );

    } catch (err) {

        console.error(
            "[ADMIN DATA]",
            err
        );

        showAlert(
            err.message ||
                "Gagal memuat data Komando.",
            "error"
        );
    }
}

/* =========================================================
   ADMIN STATS
========================================================= */

function renderAdminStats(
    stats
) {

    stats =
        stats || {};

    const totalMembers =
        Number(
            stats.totalMembers || 0
        );

    const totalLunas =
        Number(
            stats.totalLunas || 0
        );

    const totalMenunggak =
        Number(
            stats.totalMenunggak || 0
        );

    const totalKas =
        Number(
            stats.totalKas || 0
        );

    const totalMembersEl =
        document.getElementById(
            "hud-total-members"
        );

    const lunasEl =
        document.getElementById(
            "hud-total-lunas"
        );

    const menunggakEl =
        document.getElementById(
            "hud-total-menunggak"
        );

    const kasEl =
        document.getElementById(
            "hud-total-kas"
        );

    if (totalMembersEl) {
        totalMembersEl.innerText =
            `${totalMembers} Orang`;
    }

    if (lunasEl) {
        lunasEl.innerText =
            `${totalLunas} Tagihan`;
    }

    if (menunggakEl) {
        menunggakEl.innerText =
            `${totalMenunggak} Tagihan`;
    }

    if (kasEl) {
        kasEl.innerText =
            formatRupiah(
                totalKas
            );
    }
}

/* =========================================================
   ADMIN USER TABLE
========================================================= */

function renderAdminUsers(
    users
) {

    const tbody =
        document.getElementById(
            "admin-user-table"
        );

    if (!tbody) {
        return;
    }

    if (
        !users ||
        users.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    BELUM ADA PERSONEL
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        users
            .map(
                (user) => {

                    const role =
                        user.role ===
                        "admin"
                            ? "ADMIN"
                            : "MEMBER";

                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    user.id
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    user.fullname
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    user.pangkat
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    user.nrp
                                )}
                            </td>

                            <td>
                                ${role}
                            </td>

                            <td>

                                <button
                                    type="button"
                                    class="btn-action"
                                    onclick="editAdminUser(${user.id})"
                                >
                                    EDIT
                                </button>

                                ${
                                    Number(
                                        user.id
                                    ) !==
                                    getCurrentUserId()
                                        ? `
                                            <button
                                                type="button"
                                                class="btn-action btn-danger"
                                                onclick="deleteAdminUser(${user.id})"
                                            >
                                                HAPUS
                                            </button>
                                        `
                                        : ""
                                }

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}

/* =========================================================
   ADMIN UNPAID TABLE
========================================================= */

function renderUnpaidPayments(
    payments
) {

    const tbody =
        document.getElementById(
            "table-belum-bayar"
        );

    if (!tbody) {
        return;
    }

    const unpaid =
        payments.filter(
            (payment) =>
                payment.status !==
                "lunas"
        );

    if (
        unpaid.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    TIDAK ADA PRAJURIT YANG MENUNGGAK
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        unpaid
            .map(
                (payment) => {

                    const status =
                        payment.status ===
                        "menunggu_verifikasi"
                            ? "MENUNGGU VERIFIKASI"
                            : "MENUNGGAK";

                    let action = "";

                    if (
                        payment.status ===
                        "menunggu_verifikasi"
                    ) {

                        action = `
                            <button
                                type="button"
                                class="btn-action"
                                onclick="verifyPayment(${payment.id})"
                            >
                                VERIFIKASI LUNAS
                            </button>
                        `;

                    } else {

                        action = `
                            <span>
                                BELUM BAYAR
                            </span>
                        `;
                    }

                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    payment.id
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    payment.fullname
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    payment.nrp
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    payment.description
                                )}
                            </td>

                            <td>
                                ${formatRupiah(
                                    payment.amount
                                )}
                            </td>

                            <td>
                                ${status}
                            </td>

                            <td>
                                ${action}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}

/* =========================================================
   ADMIN PAID TABLE
========================================================= */

function renderPaidPayments(
    payments
) {

    const tbody =
        document.getElementById(
            "table-sudah-bayar"
        );

    if (!tbody) {
        return;
    }

    const paid =
        payments.filter(
            (payment) =>
                payment.status ===
                "lunas"
        );

    if (
        paid.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    BELUM ADA PEMBAYARAN LUNAS
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        paid
            .map(
                (payment) => {

                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    payment.id
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    payment.fullname
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    payment.nrp
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    payment.description
                                )}
                            </td>

                            <td>
                                ${formatRupiah(
                                    payment.amount
                                )}
                            </td>

                            <td>
                                LUNAS
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}

/* =========================================================
   ADMIN VERIFY
========================================================= */

async function verifyPayment(
    paymentId
) {

    if (
        !confirm(
            "Verifikasi pembayaran ini sebagai LUNAS?"
        )
    ) {
        return;
    }

    try {

        const result =
            await apiFetch(
                `/api/admin/payments/${paymentId}/verify`,
                {
                    method: "PUT"
                }
            );

        if (
            !result.success
        ) {
            throw new Error(
                result.message
            );
        }

        showAlert(
            "Pembayaran berhasil diverifikasi.",
            "success"
        );

        await loadAdminData();

    } catch (err) {

        console.error(
            "[VERIFY]",
            err
        );

        showAlert(
            err.message ||
                "Gagal memverifikasi pembayaran.",
            "error"
        );
    }
}

/* =========================================================
   PAYMENT CONFIG FORM
========================================================= */

function setupPaymentConfigForm() {

    const form =
        document.getElementById(
            "form-config-payment"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const bank_name =
                document
                    .getElementById(
                        "cfg-bank-name"
                    )
                    .value
                    .trim();

            const account_number =
                document
                    .getElementById(
                        "cfg-account-number"
                    )
                    .value
                    .trim();

            const account_holder =
                document
                    .getElementById(
                        "cfg-account-holder"
                    )
                    .value
                    .trim();

            const qris_nmid =
                document
                    .getElementById(
                        "cfg-qris-nmid"
                    )
                    .value
                    .trim();

            const qris_payload =
                document
                    .getElementById(
                        "cfg-qris-payload"
                    )
                    .value
                    .trim();

            try {

                const result =
                    await apiFetch(
                        "/api/admin/payment-config",
                        {
                            method: "POST",
                            body:
                                JSON.stringify({
                                    bank_name,
                                    account_number,
                                    account_holder,
                                    qris_nmid,
                                    qris_payload
                                })
                        }
                    );

                if (
                    !result.success
                ) {
                    throw new Error(
                        result.message
                    );
                }

                showAlert(
                    "Rekening dan QRIS berhasil disimpan.",
                    "success"
                );

                await loadAdminData();

            } catch (err) {

                console.error(
                    "[PAYMENT CONFIG]",
                    err
                );

                showAlert(
                    err.message ||
                        "Gagal menyimpan rekening.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   FILL PAYMENT CONFIG
========================================================= */

function fillPaymentConfig(
    config
) {

    if (!config) {
        return;
    }

    const bankName =
        document.getElementById(
            "cfg-bank-name"
        );

    const accountNumber =
        document.getElementById(
            "cfg-account-number"
        );

    const accountHolder =
        document.getElementById(
            "cfg-account-holder"
        );

    const qrisNmid =
        document.getElementById(
            "cfg-qris-nmid"
        );

    const qrisPayload =
        document.getElementById(
            "cfg-qris-payload"
        );

    if (bankName) {
        bankName.value =
            config.bank_name || "";
    }

    if (accountNumber) {
        accountNumber.value =
            config.account_number || "";
    }

    if (accountHolder) {
        accountHolder.value =
            config.account_holder || "";
    }

    if (qrisNmid) {
        qrisNmid.value =
            config.qris_nmid || "";
    }

    if (qrisPayload) {
        qrisPayload.value =
            config.qris_payload || "";
    }
}

/* =========================================================
   ADMIN BILL FORM
========================================================= */

function setupAdminBillForm() {

    const form =
        document.getElementById(
            "form-admin-create-bill"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const description =
                document
                    .getElementById(
                        "bill-desc"
                    )
                    .value
                    .trim();

            const amount =
                Number(
                    document
                        .getElementById(
                            "bill-amount"
                        )
                        .value
                );

            if (
                !description ||
                !amount ||
                amount <= 0
            ) {

                showAlert(
                    "Nama iuran dan nominal wajib diisi.",
                    "error"
                );

                return;
            }

            const memberCount =
                Number(
                    adminData
                        ?.stats
                        ?.totalMembers ||
                    0
                );

            const confirmation =
                confirm(
                    `Terbitkan iuran "${description}" sebesar ${formatRupiah(amount)} kepada ${memberCount} member?`
                );

            if (!confirmation) {
                return;
            }

            try {

                const result =
                    await apiFetch(
                        "/api/admin/bills",
                        {
                            method: "POST",
                            body:
                                JSON.stringify({
                                    description,
                                    amount
                                })
                        }
                    );

                if (
                    !result.success
                ) {
                    throw new Error(
                        result.message
                    );
                }

                showAlert(
                    result.message ||
                        "Iuran berhasil diterbitkan.",
                    "success"
                );

                form.reset();

                await loadAdminData();

            } catch (err) {

                console.error(
                    "[CREATE BILL]",
                    err
                );

                showAlert(
                    err.message ||
                        "Gagal menerbitkan iuran.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   ADMIN EDIT USER
========================================================= */

function setupAdminEditForm() {

    const form =
        document.getElementById(
            "form-admin-edit-user"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const id =
                Number(
                    document.getElementById(
                        "adm-user-id"
                    ).value
                );

            const fullname =
                document.getElementById(
                    "adm-user-fullname"
                ).value.trim();

            const pangkat =
                document.getElementById(
                    "adm-user-pangkat"
                ).value;

            const nrp =
                document.getElementById(
                    "adm-user-nrp"
                ).value.trim();

            const role =
                document.getElementById(
                    "adm-user-role"
                ).value;

            const password =
                document.getElementById(
                    "adm-user-password"
                ).value;

            try {

                const result =
                    await apiFetch(
                        `/api/admin/users/${id}`,
                        {
                            method: "PUT",
                            body:
                                JSON.stringify({
                                    fullname,
                                    pangkat,
                                    nrp,
                                    role,
                                    password
                                })
                        }
                    );

                if (
                    !result.success
                ) {
                    throw new Error(
                        result.message
                    );
                }

                showAlert(
                    "Data personel berhasil diperbarui.",
                    "success"
                );

                cancelAdminEdit();

                await loadAdminData();

            } catch (err) {

                console.error(
                    "[EDIT USER]",
                    err
                );

                showAlert(
                    err.message ||
                        "Gagal memperbarui personel.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   EDIT ADMIN USER
========================================================= */

function editAdminUser(
    userId
) {

    const user =
        adminData.users.find(
            (item) =>
                Number(item.id) ===
                Number(userId)
        );

    if (!user) {

        showAlert(
            "Data personel tidak ditemukan.",
            "error"
        );

        return;
    }

    const box =
        document.getElementById(
            "box-admin-edit-user"
        );

    if (!box) {
        return;
    }

    document.getElementById(
        "adm-user-id"
    ).value =
        user.id;

    document.getElementById(
        "adm-user-fullname"
    ).value =
        user.fullname || "";

    document.getElementById(
        "adm-user-pangkat"
    ).value =
        user.pangkat || "Prada";

    document.getElementById(
        "adm-user-nrp"
    ).value =
        user.nrp || "";

    document.getElementById(
        "adm-user-role"
    ).value =
        user.role || "member";

    document.getElementById(
        "adm-user-password"
    ).value =
        "";

    box.style.display =
        "block";

    box.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

/* =========================================================
   CANCEL ADMIN EDIT
========================================================= */

function cancelAdminEdit() {

    const box =
        document.getElementById(
            "box-admin-edit-user"
        );

    if (box) {
        box.style.display =
            "none";
    }

    const form =
        document.getElementById(
            "form-admin-edit-user"
        );

    if (form) {
        form.reset();
    }
}

/* =========================================================
   DELETE ADMIN USER
========================================================= */

async function deleteAdminUser(
    userId
) {

    const user =
        adminData.users.find(
            (item) =>
                Number(item.id) ===
                Number(userId)
        );

    if (!user) {
        return;
    }

    const confirmation =
        confirm(
            `Hapus personel ${user.fullname}?`
        );

    if (!confirmation) {
        return;
    }

    try {

        const result =
            await apiFetch(
                `/api/admin/users/${userId}`,
                {
                    method: "DELETE"
                }
            );

        if (
            !result.success
        ) {
            throw new Error(
                result.message
            );
        }

        showAlert(
            "Personel berhasil dihapus.",
            "success"
        );

        await loadAdminData();

    } catch (err) {

        console.error(
            "[DELETE USER]",
            err
        );

        showAlert(
            err.message ||
                "Gagal menghapus personel.",
            "error"
        );
    }
}

/* =========================================================
   EXCEL EXPORT
========================================================= */

function exportToExcel() {

    if (
        typeof XLSX ===
        "undefined"
    ) {

        showAlert(
            "Library Excel belum termuat.",
            "error"
        );

        return;
    }

    const users =
        adminData.users || [];

    const payments =
        adminData.payments || [];

    /*
     * SHEET PERSONEL
     */
    const userRows =
        users.map(
            (user) => ({
                ID: user.id,
                "Nama Lengkap":
                    user.fullname,
                Pangkat:
                    user.pangkat,
                NRP:
                    user.nrp,
                Username:
                    user.username,
                Role:
                    user.role
            })
        );

    /*
     * SHEET PEMBAYARAN
     */
    const paymentRows =
        payments.map(
            (payment) => ({
                ID:
                    payment.id,
                Personel:
                    payment.fullname,
                Pangkat:
                    payment.pangkat,
                NRP:
                    payment.nrp,
                Iuran:
                    payment.description,
                Nominal:
                    Number(
                        payment.amount
                    ),
                Status:
                    payment.status,
                "Tanggal Bayar":
                    payment.paid_at || ""
            })
        );

    /*
     * SHEET REKAP
     */
    const summaryRows = [
        {
            Keterangan:
                "Total Personel",
            Nilai:
                adminData
                    .stats
                    .totalMembers
        },
        {
            Keterangan:
                "Total Tagihan Lunas",
            Nilai:
                adminData
                    .stats
                    .totalLunas
        },
        {
            Keterangan:
                "Total Tagihan Menunggak",
            Nilai:
                adminData
                    .stats
                    .totalMenunggak
        },
        {
            Keterangan:
                "Total Kas Terkumpul",
            Nilai:
                adminData
                    .stats
                    .totalKas
        }
    ];

    const workbook =
        XLSX.utils.book_new();

    const sheetUsers =
        XLSX.utils.json_to_sheet(
            userRows
        );

    const sheetPayments =
        XLSX.utils.json_to_sheet(
            paymentRows
        );

    const sheetSummary =
        XLSX.utils.json_to_sheet(
            summaryRows
        );

    XLSX.utils.book_append_sheet(
        workbook,
        sheetSummary,
        "REKAP"
    );

    XLSX.utils.book_append_sheet(
        workbook,
        sheetUsers,
        "PERSONEL"
    );

    XLSX.utils.book_append_sheet(
        workbook,
        sheetPayments,
        "PEMBAYARAN"
    );

    XLSX.writeFile(
        workbook,
        "KIPAN-A-REKAP.xlsx"
    );

    showAlert(
        "File Excel berhasil dibuat.",
        "success"
    );
}

/* =========================================================
   PRINT REPORT
========================================================= */

function printReport() {

    window.print();
}

/* =========================================================
   ALERT
========================================================= */

function showAlert(
    message,
    type = "success"
) {

    const alertBox =
        document.getElementById(
            "alert-box"
        );

    if (!alertBox) {
        return;
    }

    alertBox.innerText =
        message;

    alertBox.style.display =
        "block";

    if (
        type === "success"
    ) {

        alertBox.style.background =
            "#1b4d3e";

        alertBox.style.borderColor =
            "#2ecc71";

    } else {

        alertBox.style.background =
            "#5c1d1d";

        alertBox.style.borderColor =
            "#e74c3c";
    }

    alertBox.style.color =
        "#fff";

    clearTimeout(
        window.__kipanAlertTimer
    );

    window.__kipanAlertTimer =
        setTimeout(
            () => {
                alertBox.style.display =
                    "none";
            },
            4000
        );
}

/* =========================================================
   FORMAT RUPIAH
========================================================= */

function formatRupiah(
    value
) {

    const number =
        Number(value || 0);

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0
        }
    ).format(number);
}

/* =========================================================
   CURRENT USER ID
========================================================= */

function getCurrentUserId() {

    const userJson =
        localStorage.getItem(
            "user"
        );

    if (!userJson) {
        return null;
    }

    try {

        const user =
            JSON.parse(
                userJson
            );

        return Number(
            user.id
        );

    } catch (_) {

        return null;
    }
}

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.navigate =
    navigate;

window.logout =
    logout;

window.openQris =
    openQris;

window.closeQris =
    closeQris;

window.confirmPayment =
    confirmPayment;

window.verifyPayment =
    verifyPayment;

window.editAdminUser =
    editAdminUser;

window.deleteAdminUser =
    deleteAdminUser;

window.cancelAdminEdit =
    cancelAdminEdit;

window.exportToExcel =
    exportToExcel;

window.printReport =
    printReport;

window.showAlert =
    showAlert;
