/* =========================================================
   KIPAN A - FRONTEND
========================================================= */

let adminData = null;
let memberData = null;
let currentPaymentId = null;

/* =========================================================
   HELPER API
========================================================= */

async function apiFetch(url, options = {}) {
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

    let data;

    try {
        data = await response.json();
    } catch {
        data = {
            success: false,
            message: "Server mengembalikan data tidak valid.",
        };
    }

    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        updateNavVisibility();

        showAlert(
            "Sesi login sudah berakhir. Silakan login kembali.",
            "error"
        );

        navigate("sec-auth");

        throw new Error(
            data.message || "Unauthorized"
        );
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message || "Terjadi kesalahan."
        );
    }

    return data;
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
   NAVBAR
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
        } catch {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            return updateNavVisibility();
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
                navAdmin.style.display =
                    "none";
        }
    } else {
        if (navAuth)
            navAuth.style.display =
                "inline-block";

        if (navDashboard)
            navDashboard.style.display =
                "none";

        if (navSettings)
            navSettings.style.display =
                "none";

        if (navAdmin)
            navAdmin.style.display =
                "none";

        if (navLogout)
            navLogout.style.display =
                "none";
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
                    await apiFetch(
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
                    await apiFetch(
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

    adminData = null;
    memberData = null;

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

    setTimeout(() => {
        alertBox.style.display =
            "none";
    }, 4000);
}

/* =========================================================
   MEMBER DASHBOARD
========================================================= */

async function loadMemberDashboard() {
    try {
        const result =
            await apiFetch(
                "/api/member/data"
            );

        memberData = result;

        localStorage.setItem(
            "user",
            JSON.stringify(
                result.user
            )
        );

        const dashUser =
            document.getElementById(
                "dash-user"
            );

        if (dashUser) {
            dashUser.innerText =
                `${result.user.fullname} (${result.user.pangkat} - NRP: ${result.user.nrp})`;
        }

        renderMemberBills(
            result.bills || []
        );
    } catch (err) {
        console.error(
            "[MEMBER DASHBOARD]",
            err
        );

        showAlert(
            err.message ||
                "Gagal mengambil data prajurit.",
            "error"
        );
    }
}

/* =========================================================
   MEMBER BILLS
========================================================= */

function renderMemberBills(bills) {
    const table =
        document.getElementById(
            "member-pay-table"
        );

    if (!table) return;

    table.innerHTML = "";

    if (!bills.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;">
                    Belum ada tagihan iuran.
                </td>
            </tr>
        `;

        return;
    }

    bills.forEach((bill) => {
        const row =
            document.createElement("tr");

        const statusText =
            bill.status === "verified"
                ? "LUNAS"
                : bill.status ===
                  "submitted"
                ? "MENUNGGU VERIFIKASI"
                : "BELUM BAYAR";

        let action = "";

        if (
            bill.status !==
            "verified"
        ) {
            action = `
                <button
                    class="btn-action"
                    onclick="submitPayment(${bill.payment_id})"
                >
                    BAYAR / KONFIRMASI
                </button>
            `;
        } else {
            action = `
                <span style="color:#2ecc71;font-weight:bold;">
                    ✓ TERVERIFIKASI
                </span>
            `;
        }

        row.innerHTML = `
            <td>${bill.bill_id}</td>

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
                <strong>
                    ${statusText}
                </strong>
            </td>

            <td>
                ${action}
            </td>
        `;

        table.appendChild(row);
    });
}

/* =========================================================
   SUBMIT PAYMENT
========================================================= */

async function submitPayment(paymentId) {
    currentPaymentId =
        paymentId;

    const config =
        memberData?.payment_config ||
        {};

    const bill =
        (memberData?.bills || [])
            .find(
                (item) =>
                    Number(
                        item.payment_id
                    ) ===
                    Number(paymentId)
            );

    if (!bill) {
        showAlert(
            "Tagihan tidak ditemukan.",
            "error"
        );

        return;
    }

    const modal =
        document.getElementById(
            "modal-qris"
        );

    if (!modal) {
        await confirmPayment(
            paymentId
        );

        return;
    }

    const info =
        document.getElementById(
            "qris-bill-info"
        );

    if (info) {
        info.innerText =
            `${bill.description} - ${formatRupiah(
                bill.amount
            )}`;
    }

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

    if (bankName) {
        bankName.innerText =
            config.bank_name ||
            "-";
    }

    if (bankAcc) {
        bankAcc.innerText =
            config.account_number ||
            "-";
    }

    if (bankHolder) {
        bankHolder.innerText =
            config.account_holder ||
            "-";
    }

    const qrImage =
        document.getElementById(
            "qris-barcode"
        );

    if (
        qrImage &&
        config.qris_payload
    ) {
        qrImage.src =
            "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" +
            encodeURIComponent(
                config.qris_payload
            );
    } else if (qrImage) {
        qrImage.removeAttribute(
            "src"
        );
    }

    const radarText =
        document.getElementById(
            "radar-text"
        );

    if (radarText) {
        radarText.innerText =
            "Silakan lakukan pembayaran lalu konfirmasi.";
    }

    modal.style.display = "flex";
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

async function confirmPayment(
    paymentId
) {
    const confirmed =
        window.confirm(
            "Apakah pembayaran sudah dilakukan?"
        );

    if (!confirmed) {
        return;
    }

    try {
        const result =
            await apiFetch(
                "/api/member/pay",
                {
                    method: "POST",
                    body: JSON.stringify({
                        payment_id:
                            paymentId,
                        note:
                            "Pembayaran dikonfirmasi oleh prajurit.",
                    }),
                }
            );

        closeQris();

        showAlert(
            result.message,
            "success"
        );

        await loadMemberDashboard();
    } catch (err) {
        console.error(err);

        showAlert(
            err.message ||
                "Gagal mengirim pembayaran.",
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
            await apiFetch(
                "/api/admin/data"
            );

        adminData = result;

        renderAdminStats(
            result.stats
        );

        renderAdminPaymentConfig(
            result.payment_config
        );

        renderAdminTables(
            result
        );
    } catch (err) {
        console.error(
            "[ADMIN DATA ERROR]",
            err
        );

        showAlert(
            err.message ||
                "Gagal mengambil data panel Komando.",
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
            `${stats.total_members || 0} Orang`;
    }

    if (totalLunas) {
        totalLunas.innerText =
            `${stats.total_lunas || 0} Tagihan`;
    }

    if (totalMenunggak) {
        totalMenunggak.innerText =
            `${stats.total_menunggak || 0} Tagihan`;
    }

    if (totalKas) {
        totalKas.innerText =
            formatRupiah(
                stats.total_kas || 0
            );
    }
}

/* =========================================================
   ADMIN PAYMENT CONFIG
========================================================= */

function renderAdminPaymentConfig(
    config
) {
    if (!config) return;

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

    if (bankName)
        bankName.value =
            config.bank_name || "";

    if (accountNumber)
        accountNumber.value =
            config.account_number || "";

    if (accountHolder)
        accountHolder.value =
            config.account_holder || "";

    if (qrisNmid)
        qrisNmid.value =
            config.qris_nmid || "";

    if (qrisPayload)
        qrisPayload.value =
            config.qris_payload || "";
}

/* =========================================================
   ADMIN TABLES
========================================================= */

function renderAdminTables(
    data
) {
    renderUnpaidTable(
        data.payments || []
    );

    renderPaidTable(
        data.payments || []
    );

    renderUsersTable(
        data.users || []
    );
}

/* =========================================================
   UNPAID TABLE
========================================================= */

function renderUnpaidTable(
    payments
) {
    const table =
        document.getElementById(
            "table-belum-bayar"
        );

    if (!table) return;

    table.innerHTML = "";

    const unpaid =
        payments.filter(
            (payment) =>
                payment.status !==
                "verified"
        );

    if (!unpaid.length) {
        table.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;">
                    Tidak ada prajurit yang menunggak.
                </td>
            </tr>
        `;

        return;
    }

    unpaid.forEach(
        (payment) => {
            const row =
                document.createElement(
                    "tr"
                );

            const action =
                payment.status ===
                    "submitted"
                    ? `
                    <button
                        class="btn-action"
                        onclick="verifyPayment(${payment.payment_id})"
                    >
                        VERIFIKASI
                    </button>
                `
                    : `
                    <span style="color:#ffcc00;">
                        BELUM BAYAR
                    </span>
                `;

            row.innerHTML = `
                <td>
                    ${payment.payment_id}
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
                    ${payment.status}
                </td>

                <td>
                    ${action}
                </td>
            `;

            table.appendChild(row);
        }
    );
}

/* =========================================================
   PAID TABLE
========================================================= */

function renderPaidTable(
    payments
) {
    const table =
        document.getElementById(
            "table-sudah-bayar"
        );

    if (!table) return;

    table.innerHTML = "";

    const paid =
        payments.filter(
            (payment) =>
                payment.status ===
                "verified"
        );

    if (!paid.length) {
        table.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    Belum ada pembayaran terverifikasi.
                </td>
            </tr>
        `;

        return;
    }

    paid.forEach(
        (payment) => {
            const row =
                document.createElement(
                    "tr"
                );

            row.innerHTML = `
                <td>
                    ${payment.payment_id}
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

                <td style="color:#2ecc71;font-weight:bold;">
                    ✓ LUNAS
                </td>
            `;

            table.appendChild(row);
        }
    );
}

/* =========================================================
   USERS TABLE
========================================================= */

function renderUsersTable(
    users
) {
    const table =
        document.getElementById(
            "admin-user-table"
        );

    if (!table) return;

    table.innerHTML = "";

    if (!users.length) {
        table.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    Belum ada anggota.
                </td>
            </tr>
        `;

        return;
    }

    users.forEach((user) => {
        const row =
            document.createElement(
                "tr"
            );

        row.innerHTML = `
            <td>
                ${user.id}
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
                ${user.role}
            </td>

            <td>
                <button
                    class="btn-action"
                    onclick="editAdminUser(${user.id})"
                >
                    EDIT
                </button>
            </td>
        `;

        table.appendChild(row);
    });
}

/* =========================================================
   VERIFY PAYMENT
========================================================= */

async function verifyPayment(
    paymentId
) {
    const confirmed =
        window.confirm(
            "Verifikasi pembayaran ini sebagai LUNAS?"
        );

    if (!confirmed) return;

    try {
        const result =
            await apiFetch(
                `/api/admin/payments/${paymentId}/verify`,
                {
                    method: "POST",
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
   CREATE BILL
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

            try {
                const result =
                    await apiFetch(
                        "/api/admin/bills",
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
   PAYMENT CONFIG FORM
========================================================= */

const formPaymentConfig =
    document.getElementById(
        "form-config-payment"
    );

if (formPaymentConfig) {
    formPaymentConfig.addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();

            const bank_name =
                document.getElementById(
                    "cfg-bank-name"
                ).value.trim();

            const account_number =
                document.getElementById(
                    "cfg-account-number"
                ).value.trim();

            const account_holder =
                document.getElementById(
                    "cfg-account-holder"
                ).value.trim();

            const qris_nmid =
                document.getElementById(
                    "cfg-qris-nmid"
                ).value.trim();

            const qris_payload =
                document.getElementById(
                    "cfg-qris-payload"
                ).value.trim();

            try {
                const result =
                    await apiFetch(
                        "/api/admin/payment-config",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                bank_name,
                                account_number,
                                account_holder,
                                qris_nmid,
                                qris_payload,
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
                        "Gagal menyimpan rekening.",
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
        localStorage.getItem(
            "user"
        );

    if (!userJson) return;

    let user;

    try {
        user = JSON.parse(
            userJson
        );
    } catch {
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

    if (fullnameInput)
        fullnameInput.value =
            user.fullname || "";

    if (pangkatSelect)
        pangkatSelect.value =
            user.pangkat || "Prada";

    if (nrpInput)
        nrpInput.value =
            user.nrp || "";
}

/* =========================================================
   SETTINGS FORM
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
                    await apiFetch(
                        "/api/user/profile",
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

                localStorage.setItem(
                    "user",
                    JSON.stringify(
                        result.user
                    )
                );

                document.getElementById(
                    "set-password"
                ).value = "";

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
    userId
) {
    if (!adminData) return;

    const user =
        (adminData.users || [])
            .find(
                (item) =>
                    Number(item.id) ===
                    Number(userId)
            );

    if (!user) return;

    const box =
        document.getElementById(
            "box-admin-edit-user"
        );

    const idInput =
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

    if (idInput)
        idInput.value =
            user.id;

    if (fullname)
        fullname.value =
            user.fullname || "";

    if (pangkat)
        pangkat.value =
            user.pangkat || "Prada";

    if (nrp)
        nrp.value =
            user.nrp || "";

    if (role)
        role.value =
            user.role || "member";

    if (password)
        password.value = "";

    if (box) {
        box.style.display =
            "block";

        box.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }
}

/* =========================================================
   ADMIN EDIT FORM
========================================================= */

const formAdminEdit =
    document.getElementById(
        "form-admin-edit-user"
    );

if (formAdminEdit) {
    formAdminEdit.addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();

            const id =
                document.getElementById(
                    "adm-user-id"
                ).value;

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
                    await apiFetch(
                        `/api/admin/users/${id}`,
                        {
                            method: "PUT",
                            body: JSON.stringify({
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
                        "Gagal mengubah data personel.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   EXCEL EXPORT
========================================================= */

function exportToExcel() {
    if (!adminData) {
        showAlert(
            "Data admin belum dimuat.",
            "error"
        );

        return;
    }

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

    const rows =
        (adminData.payments || [])
            .map(
                (payment) => ({
                    ID:
                        payment.payment_id,
                    Prajurit:
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
                })
            );

    const worksheet =
        XLSX.utils.json_to_sheet(
            rows
        );

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Rekap"
    );

    XLSX.writeFile(
        workbook,
        "rekap-kipan-a.xlsx"
    );
}

/* =========================================================
   PRINT
========================================================= */

function printReport() {
    window.print();
}

/* =========================================================
   FORMAT RUPIAH
========================================================= */

function formatRupiah(
    value
) {
    const number =
        Number(value) || 0;

    return (
        "Rp " +
        number.toLocaleString(
            "id-ID"
        )
    );
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {
    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {
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
            } catch {
                logout();
                return;
            }

            if (
                user.role ===
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
        } else {
            navigate(
                "sec-auth"
            );
        }
    }
);

/* =========================================================
   AUTO REFRESH ADMIN
========================================================= */

setInterval(() => {
    const token =
        localStorage.getItem(
            "token"
        );

    const userJson =
        localStorage.getItem(
            "user"
        );

    if (!token || !userJson) {
        return;
    }

    try {
        const user =
            JSON.parse(
                userJson
            );

        const adminSection =
            document.getElementById(
                "sec-admin"
            );

        if (
            user.role ===
                "admin" &&
            adminSection &&
            adminSection.classList.contains(
                "active"
            )
        ) {
            loadAdminData();
        }
    } catch {
        // abaikan
    }
}, 15000);
