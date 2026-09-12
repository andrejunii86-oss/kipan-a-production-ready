/* =========================================================
   KIPAN A - FRONTEND APP
========================================================= */

"use strict";

/* =========================================================
   API HELPER
========================================================= */

async function apiRequest(url, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    let result;

    try {
        result = await response.json();
    } catch (err) {
        throw new Error(
            `Server mengembalikan respons yang tidak valid (${response.status}).`
        );
    }

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message ||
                `Request gagal (${response.status}).`
        );
    }

    return result;
}

/* =========================================================
   NAVIGATION
========================================================= */

function navigate(sectionId) {
    const sections =
        document.querySelectorAll(".section-box");

    sections.forEach((section) => {
        section.classList.remove("active");
    });

    const target =
        document.getElementById(sectionId);

    if (target) {
        target.classList.add("active");
    }

    if (sectionId === "sec-dashboard") {
        loadMemberDashboard();
    }

    if (sectionId === "sec-admin") {
        loadAdminData();
    }

    if (sectionId === "sec-settings") {
        loadUserSettingsForm();
    }
}

/* =========================================================
   NAVIGATION VISIBILITY
========================================================= */

function updateNavVisibility() {
    const token =
        localStorage.getItem("token");

    const userJson =
        localStorage.getItem("user");

    const navAuth =
        document.getElementById("nav-auth");

    const navDashboard =
        document.getElementById("nav-dashboard");

    const navSettings =
        document.getElementById("nav-settings");

    const navAdmin =
        document.getElementById("nav-admin");

    const navLogout =
        document.getElementById("nav-logout");

    if (token && userJson) {
        let user;

        try {
            user = JSON.parse(userJson);
        } catch (err) {
            logout();
            return;
        }

        if (navAuth)
            navAuth.style.display = "none";

        if (navDashboard)
            navDashboard.style.display =
                "inline-block";

        if (navSettings)
            navSettings.style.display =
                "inline-block";

        if (navLogout)
            navLogout.style.display =
                "inline-block";

        if (
            user.role === "admin"
        ) {
            if (navAdmin)
                navAdmin.style.display =
                    "inline-block";
        } else {
            if (navAdmin)
                navAdmin.style.display = "none";
        }
    } else {
        if (navAuth)
            navAuth.style.display =
                "inline-block";

        if (navDashboard)
            navDashboard.style.display = "none";

        if (navSettings)
            navSettings.style.display = "none";

        if (navAdmin)
            navAdmin.style.display = "none";

        if (navLogout)
            navLogout.style.display = "none";
    }
}

/* =========================================================
   LOGIN
========================================================= */

const formLogin =
    document.getElementById("form-login");

if (formLogin) {
    formLogin.addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();

            const username =
                document
                    .getElementById(
                        "log-username"
                    )
                    .value.trim();

            const password =
                document.getElementById(
                    "log-password"
                ).value;

            try {
                const result =
                    await apiRequest(
                        "/api/login",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                username,
                                password,
                            }),
                        }
                    );

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

                showAlert(
                    "Login berhasil! Memasuki Markas...",
                    "success"
                );

                updateNavVisibility();

                setTimeout(() => {
                    if (
                        result.user.role ===
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
                }, 500);
            } catch (err) {
                console.error(err);

                showAlert(
                    err.message ||
                        "Gagal login.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   REGISTER
========================================================= */

const formRegister =
    document.getElementById(
        "form-register"
    );

if (formRegister) {
    formRegister.addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();

            const fullname =
                document
                    .getElementById(
                        "reg-fullname"
                    )
                    .value.trim();

            const pangkat =
                document.getElementById(
                    "reg-pangkat"
                ).value;

            const nrp =
                document
                    .getElementById(
                        "reg-nrp"
                    )
                    .value.trim();

            const username =
                document
                    .getElementById(
                        "reg-username"
                    )
                    .value.trim();

            const password =
                document.getElementById(
                    "reg-password"
                ).value;

            try {
                const result =
                    await apiRequest(
                        "/api/register",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                fullname,
                                pangkat,
                                nrp,
                                username,
                                password,
                            }),
                        }
                    );

                showAlert(
                    result.message,
                    "success"
                );

                formRegister.reset();
            } catch (err) {
                console.error(err);

                showAlert(
                    err.message ||
                        "Gagal mendaftarkan personel.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   LOGOUT
========================================================= */

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    updateNavVisibility();

    navigate("sec-auth");

    showAlert(
        "Berhasil keluar dari Markas.",
        "success"
    );
}

/* =========================================================
   ALERT
========================================================= */

function showAlert(message, type) {
    const alertBox =
        document.getElementById(
            "alert-box"
        );

    if (!alertBox) {
        return;
    }

    alertBox.innerText = message;

    alertBox.style.display = "block";

    if (type === "success") {
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

    alertBox.style.color = "#fff";

    clearTimeout(
        window.__kipanAlertTimer
    );

    window.__kipanAlertTimer =
        setTimeout(() => {
            alertBox.style.display =
                "none";
        }, 4000);
}

/* =========================================================
   FORMAT RUPIAH
========================================================= */

function formatRupiah(value) {
    const number =
        Number(value || 0);

    return (
        "Rp " +
        new Intl.NumberFormat(
            "id-ID"
        ).format(number)
    );
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {
    return String(
        value == null ? "" : value
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   MEMBER DASHBOARD
========================================================= */

async function loadMemberDashboard() {
    const userJson =
        localStorage.getItem("user");

    if (!userJson) {
        navigate("sec-auth");
        return;
    }

    try {
        const result =
            await apiRequest(
                "/api/member/data"
            );

        /*
         * Update local user.
         */
        if (result.user) {
            localStorage.setItem(
                "user",
                JSON.stringify(
                    result.user
                )
            );
        }

        const user =
            result.user ||
            JSON.parse(userJson);

        const dashUser =
            document.getElementById(
                "dash-user"
            );

        if (dashUser) {
            dashUser.innerText =
                `${user.fullname} (${user.pangkat} - NRP: ${user.nrp})`;
        }

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
                "Gagal mengambil data iuran.",
            "error"
        );
    }
}

/* =========================================================
   RENDER MEMBER PAYMENTS
========================================================= */

function renderMemberPayments(
    bills
) {
    const tbody =
        document.getElementById(
            "member-pay-table"
        );

    if (!tbody) {
        return;
    }

    if (!bills.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5"
                    style="text-align:center;">
                    BELUM ADA TAGIHAN IURAN
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        bills
            .map((bill) => {
                const status =
                    String(
                        bill.status ||
                            "pending"
                    ).toLowerCase();

                let statusText =
                    "BELUM BAYAR";

                if (
                    status ===
                    "pending"
                ) {
                    statusText =
                        bill.paid_at
                            ? "MENUNGGU VERIFIKASI"
                            : "BELUM BAYAR";
                }

                if (
                    status === "paid"
                ) {
                    statusText =
                        "LUNAS";
                }

                let action = "";

                if (
                    status === "paid"
                ) {
                    action = `
                        <span
                            style="
                                color:#2ecc71;
                                font-weight:bold;
                            "
                        >
                            ✓ LUNAS
                        </span>
                    `;
                } else if (
                    bill.paid_at
                ) {
                    action = `
                        <span
                            style="
                                color:#f1c40f;
                                font-weight:bold;
                            "
                        >
                            MENUNGGU VERIFIKASI
                        </span>
                    `;
                } else {
                    action = `
                        <button
                            type="button"
                            class="btn-action"
                            onclick="payBill(${Number(
                                bill.bill_id
                            )})"
                        >
                            BAYAR / KONFIRMASI
                        </button>
                    `;
                }

                return `
                    <tr>
                        <td>
                            #${escapeHtml(
                                bill.bill_id
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                bill.description
                            )}
                        </td>

                        <td>
                            ${formatRupiah(
                                bill.amount
                            )}
                        </td>

                        <td>
                            ${statusText}
                        </td>

                        <td>
                            ${action}
                        </td>
                    </tr>
                `;
            })
            .join("");
}

/* =========================================================
   MEMBER PAY
========================================================= */

async function payBill(
    billId
) {
    try {
        const result =
            await apiRequest(
                "/api/member/pay",
                {
                    method: "POST",
                    body: JSON.stringify({
                        bill_id: billId,
                    }),
                }
            );

        showAlert(
            result.message,
            "success"
        );

        await loadMemberDashboard();

        /*
         * Buka QRIS/rekening setelah
         * konfirmasi pembayaran.
         */
        await openQris(
            billId
        );
    } catch (err) {
        console.error(err);

        showAlert(
            err.message ||
                "Gagal mencatat pembayaran.",
            "error"
        );
    }
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

async function loadAdminData() {
    try {
        const result =
            await apiRequest(
                "/api/admin/data"
            );

        /*
         * STATS
         */
        const totalMembers =
            document.getElementById(
                "hud-total-members"
            );

        const totalLunas =
            document.getElementById(
                "hud-total-lunas"
            );

        const totalMenunggak =
            document.getElementById(
                "hud-total-menunggak"
            );

        const totalKas =
            document.getElementById(
                "hud-total-kas"
            );

        if (totalMembers) {
            totalMembers.innerText =
                `${result.stats.totalMembers} Orang`;
        }

        if (totalLunas) {
            totalLunas.innerText =
                `${result.stats.totalLunas} Tagihan`;
        }

        if (totalMenunggak) {
            totalMenunggak.innerText =
                `${result.stats.totalMenunggak} Tagihan`;
        }

        if (totalKas) {
            totalKas.innerText =
                formatRupiah(
                    result.stats.totalKas
                );
        }

        /*
         * USERS
         */
        renderAdminUsers(
            result.users || []
        );

        /*
         * UNPAID
         */
        renderUnpaid(
            result.unpaid || []
        );

        /*
         * PAID
         */
        renderPaid(
            result.paid || []
        );

        /*
         * PAYMENT CONFIG
         */
        renderPaymentConfig(
            result.paymentConfig
        );
    } catch (err) {
        console.error(
            "[ADMIN DATA]",
            err
        );

        showAlert(
            "Gagal mengambil data panel Komando: " +
                err.message,
            "error"
        );
    }
}

/* =========================================================
   ADMIN USERS TABLE
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

    if (!users.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6"
                    style="text-align:center;">
                    BELUM ADA PERSONEL
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        users
            .map((user) => {
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
                            ${escapeHtml(
                                user.role
                            )}
                        </td>

                        <td>
                            <button
                                type="button"
                                class="btn-action"
                                onclick='editAdminUser(${JSON.stringify(
                                    user
                                )})'
                            >
                                EDIT
                            </button>

                            ${
                                user.role !==
                                "admin"
                                    ? `
                                        <button
                                            type="button"
                                            class="btn-action btn-danger"
                                            onclick="deleteAdminUser(${Number(
                                                user.id
                                            )})"
                                        >
                                            HAPUS
                                        </button>
                                    `
                                    : ""
                            }
                        </td>
                    </tr>
                `;
            })
            .join("");
}

/* =========================================================
   UNPAID TABLE
========================================================= */

function renderUnpaid(
    rows
) {
    const tbody =
        document.getElementById(
            "table-belum-bayar"
        );

    if (!tbody) {
        return;
    }

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7"
                    style="text-align:center;color:#2ecc71;">
                    TIDAK ADA TUNGGAKAN
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        rows
            .map((row) => {
                const sudahBayar =
                    Boolean(
                        row.paid_at
                    );

                return `
                    <tr>
                        <td>
                            #${escapeHtml(
                                row.bill_id
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                row.fullname
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                row.nrp
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                row.description
                            )}
                        </td>

                        <td>
                            ${formatRupiah(
                                row.amount
                            )}
                        </td>

                        <td>
                            ${
                                sudahBayar
                                    ? `
                                        <span
                                            style="
                                                color:#f1c40f;
                                                font-weight:bold;
                                            "
                                        >
                                            MENUNGGU VERIFIKASI
                                        </span>
                                    `
                                    : `
                                        <span
                                            style="
                                                color:#e74c3c;
                                                font-weight:bold;
                                            "
                                        >
                                            BELUM BAYAR
                                        </span>
                                    `
                            }
                        </td>

                        <td>
                            ${
                                sudahBayar
                                    ? `
                                        <button
                                            type="button"
                                            class="btn-action"
                                            onclick="verifyPayment(${Number(
                                                row.payment_id
                                            )})"
                                        >
                                            VERIFIKASI LUNAS
                                        </button>
                                    `
                                    : `
                                        <span>-</span>
                                    `
                            }
                        </td>
                    </tr>
                `;
            })
            .join("");
}

/* =========================================================
   PAID TABLE
========================================================= */

function renderPaid(
    rows
) {
    const tbody =
        document.getElementById(
            "table-sudah-bayar"
        );

    if (!tbody) {
        return;
    }

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6"
                    style="text-align:center;">
                    BELUM ADA PEMBAYARAN LUNAS
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        rows
            .map((row) => {
                return `
                    <tr>
                        <td>
                            #${escapeHtml(
                                row.bill_id
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                row.fullname
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                row.nrp
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                row.description
                            )}
                        </td>

                        <td>
                            ${formatRupiah(
                                row.amount
                            )}
                        </td>

                        <td>
                            <span
                                style="
                                    color:#2ecc71;
                                    font-weight:bold;
                                "
                            >
                                ✓ LUNAS
                            </span>
                        </td>
                    </tr>
                `;
            })
            .join("");
}

/* =========================================================
   VERIFY PAYMENT
========================================================= */

async function verifyPayment(
    paymentId
) {
    const ok =
        window.confirm(
            "Verifikasi pembayaran ini sebagai LUNAS?"
        );

    if (!ok) {
        return;
    }

    try {
        const result =
            await apiRequest(
                "/api/admin/verify-payment",
                {
                    method: "POST",
                    body: JSON.stringify({
                        payment_id:
                            paymentId,
                    }),
                }
            );

        showAlert(
            result.message,
            "success"
        );

        await loadAdminData();
    } catch (err) {
        console.error(err);

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

const formConfig =
    document.getElementById(
        "form-config-payment"
    );

if (formConfig) {
    formConfig.addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();

            const bankName =
                document.getElementById(
                    "cfg-bank-name"
                ).value.trim();

            const accountNumber =
                document.getElementById(
                    "cfg-account-number"
                ).value.trim();

            const accountHolder =
                document.getElementById(
                    "cfg-account-holder"
                ).value.trim();

            const qrisNmid =
                document.getElementById(
                    "cfg-qris-nmid"
                ).value.trim();

            const qrisPayload =
                document.getElementById(
                    "cfg-qris-payload"
                ).value.trim();

            try {
                const result =
                    await apiRequest(
                        "/api/admin/payment-config",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                bank_name:
                                    bankName,
                                account_number:
                                    accountNumber,
                                account_holder:
                                    accountHolder,
                                qris_nmid:
                                    qrisNmid,
                                qris_payload:
                                    qrisPayload,
                            }),
                        }
                    );

                showAlert(
                    result.message,
                    "success"
                );
            } catch (err) {
                console.error(err);

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
   ADMIN CREATE BILL
========================================================= */

const formCreateBill =
    document.getElementById(
        "form-admin-create-bill"
    );

if (formCreateBill) {
    formCreateBill.addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();

            const description =
                document
                    .getElementById(
                        "bill-desc"
                    )
                    .value.trim();

            const amount =
                Number(
                    document.getElementById(
                        "bill-amount"
                    ).value
                );

            if (!description) {
                showAlert(
                    "Keterangan iuran wajib diisi.",
                    "error"
                );

                return;
            }

            if (
                !Number.isFinite(
                    amount
                ) ||
                amount <= 0
            ) {
                showAlert(
                    "Nominal iuran tidak valid.",
                    "error"
                );

                return;
            }

            try {
                const result =
                    await apiRequest(
                        "/api/admin/create-bill",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                description,
                                amount,
                            }),
                        }
                    );

                showAlert(
                    result.message,
                    "success"
                );

                formCreateBill.reset();

                await loadAdminData();
            } catch (err) {
                console.error(err);

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
   SETTINGS
========================================================= */

function loadUserSettingsForm() {
    const userJson =
        localStorage.getItem("user");

    if (!userJson) {
        return;
    }

    let user;

    try {
        user = JSON.parse(
            userJson
        );
    } catch (err) {
        return;
    }

    const fullnameInput =
        document.getElementById(
            "set-fullname"
        );

    const pangkatSelect =
        document.getElementById(
            "set-pangkat"
        );

    const nrpInput =
        document.getElementById(
            "set-nrp"
        );

    if (fullnameInput) {
        fullnameInput.value =
            user.fullname || "";
    }

    if (pangkatSelect) {
        pangkatSelect.value =
            user.pangkat ||
            "Prada";
    }

    if (nrpInput) {
        nrpInput.value =
            user.nrp || "";
    }
}

/* =========================================================
   SETTINGS SUBMIT
========================================================= */

const formSettings =
    document.getElementById(
        "form-settings"
    );

if (formSettings) {
    formSettings.addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();

            const fullname =
                document
                    .getElementById(
                        "set-fullname"
                    )
                    .value.trim();

            const pangkat =
                document.getElementById(
                    "set-pangkat"
                ).value;

            const nrp =
                document
                    .getElementById(
                        "set-nrp"
                    )
                    .value.trim();

            const password =
                document.getElementById(
                    "set-password"
                ).value;

            try {
                const result =
                    await apiRequest(
                        "/api/settings",
                        {
                            method: "PUT",
                            body: JSON.stringify({
                                fullname,
                                pangkat,
                                nrp,
                                password,
                            }),
                        }
                    );

                if (result.user) {
                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            result.user
                        )
                    );
                }

                const passwordInput =
                    document.getElementById(
                        "set-password"
                    );

                if (
                    passwordInput
                ) {
                    passwordInput.value =
                        "";
                }

                showAlert(
                    result.message,
                    "success"
                );

                updateNavVisibility();
            } catch (err) {
                console.error(err);

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
   ADMIN EDIT USER
========================================================= */

function editAdminUser(
    user
) {
    const box =
        document.getElementById(
            "box-admin-edit-user"
        );

    if (!box) {
        return;
    }

    const id =
        document.getElementById(
            "adm-user-id"
        );

    const fullname =
        document.getElementById(
            "adm-user-fullname"
        );

    const pangkat =
        document.getElementById(
            "adm-user-pangkat"
        );

    const nrp =
        document.getElementById(
            "adm-user-nrp"
        );

    const role =
        document.getElementById(
            "adm-user-role"
        );

    const password =
        document.getElementById(
            "adm-user-password"
        );

    if (id)
        id.value =
            user.id || "";

    if (fullname)
        fullname.value =
            user.fullname || "";

    if (pangkat)
        pangkat.value =
            user.pangkat ||
            "Prada";

    if (nrp)
        nrp.value =
            user.nrp || "";

    if (role)
        role.value =
            user.role ||
            "member";

    if (password)
        password.value = "";

    box.style.display =
        "block";

    box.scrollIntoView({
        behavior: "smooth",
        block: "center",
    });
}

/* =========================================================
   ADMIN EDIT FORM
========================================================= */

const formAdminEditUser =
    document.getElementById(
        "form-admin-edit-user"
    );

if (formAdminEditUser) {
    formAdminEditUser.addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();

            const id =
                Number(
                    document.getElementById(
                        "adm-user-id"
                    ).value
                );

            const fullname =
                document
                    .getElementById(
                        "adm-user-fullname"
                    )
                    .value.trim();

            const pangkat =
                document.getElementById(
                    "adm-user-pangkat"
                ).value;

            const nrp =
                document
                    .getElementById(
                        "adm-user-nrp"
                    )
                    .value.trim();

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
                    await apiRequest(
                        "/api/admin/user",
                        {
                            method: "PUT",
                            body: JSON.stringify({
                                id,
                                fullname,
                                pangkat,
                                nrp,
                                role,
                                password,
                            }),
                        }
                    );

                showAlert(
                    result.message,
                    "success"
                );

                const box =
                    document.getElementById(
                        "box-admin-edit-user"
                    );

                if (box) {
                    box.style.display =
                        "none";
                }

                await loadAdminData();
            } catch (err) {
                console.error(err);

                showAlert(
                    err.message ||
                        "Gagal menyimpan data personel.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   DELETE USER
========================================================= */

async function deleteAdminUser(
    userId
) {
    const ok =
        window.confirm(
            "Yakin ingin menghapus personel ini?"
        );

    if (!ok) {
        return;
    }

    try {
        const result =
            await apiRequest(
                `/api/admin/user/${userId}`,
                {
                    method: "DELETE",
                }
            );

        showAlert(
            result.message,
            "success"
        );

        await loadAdminData();
    } catch (err) {
        console.error(err);

        showAlert(
            err.message ||
                "Gagal menghapus personel.",
            "error"
        );
    }
}

/* =========================================================
   PAYMENT CONFIG RENDER
========================================================= */

function renderPaymentConfig(
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
            config.account_number ||
            "";
    }

    if (accountHolder) {
        accountHolder.value =
            config.account_holder ||
            "";
    }

    if (qrisNmid) {
        qrisNmid.value =
            config.qris_nmid || "";
    }

    if (qrisPayload) {
        qrisPayload.value =
            config.qris_payload ||
            "";
    }
}

/* =========================================================
   QRIS
========================================================= */

async function openQris(
    billId
) {
    try {
        const result =
            await apiRequest(
                "/api/member/data"
            );

        const bill =
            (result.bills || []).find(
                (item) =>
                    Number(
                        item.bill_id
                    ) ===
                    Number(billId)
            );

        const config =
            result.paymentConfig;

        const modal =
            document.getElementById(
                "modal-qris"
            );

        if (!modal) {
            return;
        }

        const info =
            document.getElementById(
                "qris-bill-info"
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

        const qr =
            document.getElementById(
                "qris-barcode"
            );

        if (info) {
            info.innerText =
                bill
                    ? `${bill.description} — ${formatRupiah(
                          bill.amount
                      )}`
                    : "PEMBAYARAN KOMPI";
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

        if (qr) {
            const payload =
                config?.qris_payload ||
                config?.qris_nmid ||
                "";

            if (payload) {
                qr.src =
                    "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" +
                    encodeURIComponent(
                        payload
                    );
            } else {
                qr.removeAttribute(
                    "src"
                );
            }
        }

        modal.style.display =
            "flex";

        const radar =
            document.getElementById(
                "radar-text"
            );

        if (radar) {
            radar.innerText =
                "PEMBAYARAN DICATAT — MENUNGGU VERIFIKASI KOMANDO";
        }
    } catch (err) {
        console.error(err);

        showAlert(
            err.message ||
                "Gagal membuka data pembayaran.",
            "error"
        );
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
   EXCEL EXPORT
========================================================= */

function exportToExcel() {
    if (
        typeof XLSX ===
        "undefined"
    ) {
        showAlert(
            "Library Excel belum tersedia.",
            "error"
        );

        return;
    }

    exportAdminExcel();
}

async function exportAdminExcel() {
    try {
        const result =
            await apiRequest(
                "/api/admin/data"
            );

        const rows = [];

        /*
         * HEADER
         */
        rows.push([
            "ID TAGIHAN",
            "PRAJURIT",
            "PANGKAT",
            "NRP",
            "IURAN",
            "NOMINAL",
            "STATUS",
        ]);

        /*
         * UNPAID
         */
        (result.unpaid || []).forEach(
            (item) => {
                rows.push([
                    item.bill_id,
                    item.fullname,
                    item.pangkat,
                    item.nrp,
                    item.description,
                    Number(
                        item.amount
                    ),
                    item.paid_at
                        ? "MENUNGGU VERIFIKASI"
                        : "BELUM BAYAR",
                ]);
            }
        );

        /*
         * PAID
         */
        (result.paid || []).forEach(
            (item) => {
                rows.push([
                    item.bill_id,
                    item.fullname,
                    item.pangkat,
                    item.nrp,
                    item.description,
                    Number(
                        item.amount
                    ),
                    "LUNAS",
                ]);
            }
        );

        const worksheet =
            XLSX.utils.aoa_to_sheet(
                rows
            );

        const workbook =
            XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Rekap KIPAN A"
        );

        XLSX.writeFile(
            workbook,
            "rekap-kipan-a.xlsx"
        );

        showAlert(
            "Rekap berhasil diekspor ke Excel.",
            "success"
        );
    } catch (err) {
        console.error(err);

        showAlert(
            err.message ||
                "Gagal ekspor Excel.",
            "error"
        );
    }
}

/* =========================================================
   PRINT
========================================================= */

function printReport() {
    window.print();
}

/* =========================================================
   AUTO REFRESH ADMIN
========================================================= */

let adminRefreshTimer = null;

function startAdminRefresh() {
    stopAdminRefresh();

    adminRefreshTimer =
        setInterval(() => {
            const section =
                document.getElementById(
                    "sec-admin"
                );

            if (
                section &&
                section.classList.contains(
                    "active"
                )
            ) {
                loadAdminData();
            }
        }, 15000);
}

function stopAdminRefresh() {
    if (
        adminRefreshTimer
    ) {
        clearInterval(
            adminRefreshTimer
        );

        adminRefreshTimer =
            null;
    }
}

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        updateNavVisibility();

        const token =
            localStorage.getItem(
                "token"
            );

        const userJson =
            localStorage.getItem(
                "user"
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
            } catch (err) {
                logout();
                return;
            }

            /*
             * Cek sesi ke server.
             */
            try {
                const result =
                    await apiRequest(
                        "/api/me"
                    );

                if (
                    result.user
                ) {
                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            result.user
                        )
                    );

                    user =
                        result.user;
                }
            } catch (err) {
                console.warn(
                    "[SESSION]",
                    err.message
                );

                /*
                 * Jangan langsung hapus token
                 * kalau hanya ada masalah jaringan.
                 */
            }

            updateNavVisibility();

            if (
                user.role ===
                "admin"
            ) {
                navigate(
                    "sec-admin"
                );

                startAdminRefresh();
            } else {
                navigate(
                    "sec-dashboard"
                );
            }
        } else {
            navigate(
                "sec-auth"
            );
        }
    }
);

/* =========================================================
   CLOSE MODAL WHEN CLICK OUTSIDE
========================================================= */

document.addEventListener(
    "click",
    (event) => {
        const modal =
            document.getElementById(
                "modal-qris"
            );

        if (
            modal &&
            event.target ===
                modal
        ) {
            closeQris();
        }
    }
);
