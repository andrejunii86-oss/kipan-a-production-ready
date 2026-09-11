let currentUser = null;
let activePollingTimer = null;
let activePaymentId = null;

function getToken() { return localStorage.getItem('kipan_token'); }
function setToken(token) { localStorage.setItem('kipan_token', token); }
function clearAuth() {
    localStorage.removeItem('kipan_token');
    currentUser = null;
    if (activePollingTimer) clearInterval(activePollingTimer);
}

function notify(text) {
    const box = document.getElementById('alert-box');
    box.innerText = text;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 3500);
}

function navigate(sectionId) {
    document.querySelectorAll('.section-box').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(el => el.classList.remove('active'));

    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    const navBtn = document.getElementById(`nav-${sectionId.replace('sec-', '')}`);
    if (navBtn) navBtn.classList.add('active');
}

function updateNav() {
    const isLogged = !!currentUser;
    const isAdm = isLogged && currentUser.role === 'admin';
    const isMem = isLogged && currentUser.role === 'member';

    document.getElementById('nav-auth').style.display = isLogged ? 'none' : 'inline-block';
    document.getElementById('nav-dashboard').style.display = isMem ? 'inline-block' : 'none';
    document.getElementById('nav-settings').style.display = isLogged ? 'inline-block' : 'none';
    document.getElementById('nav-admin').style.display = isAdm ? 'inline-block' : 'none';
    document.getElementById('nav-logout').style.display = isLogged ? 'inline-block' : 'none';
}

async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
        clearAuth();
        updateNav();
        navigate('sec-auth');
    }
    return res;
}

async function checkSession() {
    const token = getToken();
    if (!token) {
        clearAuth();
        updateNav();
        navigate('sec-auth');
        return;
    }

    try {
        const res = await authFetch('/api/me');
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            document.getElementById('dash-user').innerText = `${currentUser.pangkat} ${currentUser.fullname} (NRP: ${currentUser.nrp}) [ROLE: ${currentUser.role.toUpperCase()}]`;
            document.getElementById('set-fullname').value = currentUser.fullname;
            document.getElementById('set-pangkat').value = currentUser.pangkat;
            document.getElementById('set-nrp').value = currentUser.nrp || '';
            updateNav();

            if (currentUser.role === 'admin') {
                loadAdminDashboard();
                loadPaymentConfig();
                navigate('sec-admin');
            } else {
                loadMemberPayments();
                navigate('sec-dashboard');
            }
        } else {
            clearAuth();
            updateNav();
            navigate('sec-auth');
        }
    } catch {
        clearAuth();
        updateNav();
    }
}

document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fullname: document.getElementById('reg-fullname').value,
            pangkat: document.getElementById('reg-pangkat').value,
            nrp: document.getElementById('reg-nrp').value,
            username: document.getElementById('reg-username').value,
            password: document.getElementById('reg-password').value
        })
    });
    const data = await res.json();
    notify(data.message);
    if (data.success) document.getElementById('form-register').reset();
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: document.getElementById('log-username').value,
            password: document.getElementById('log-password').value
        })
    });
    const data = await res.json();
    notify(data.message);
    if (data.success && data.token) {
        setToken(data.token);
        currentUser = data.user;
        checkSession();
    }
});

document.getElementById('form-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await authFetch('/api/user/settings', {
        method: 'PUT',
        body: JSON.stringify({
            fullname: document.getElementById('set-fullname').value,
            pangkat: document.getElementById('set-pangkat').value,
            nrp: document.getElementById('set-nrp').value,
            new_password: document.getElementById('set-password').value
        })
    });
    const data = await res.json();
    notify(data.message);
    if (data.success) checkSession();
});

async function loadMemberPayments() {
    const res = await authFetch('/api/payments');
    const data = await res.json();
    if (!data.success) return;

    const table = document.getElementById('member-pay-table');
    table.innerHTML = data.payments.length ? data.payments.map(p => `
        <tr>
            <td>#${p.id}</td>
            <td>${p.keterangan}</td>
            <td>Rp ${Number(p.jumlah).toLocaleString()}</td>
            <td><span class="badge ${p.status === 'LUNAS' ? 'badge-lunas' : 'badge-menunggak'}">${p.status}</span></td>
            <td>
                ${p.status !== 'LUNAS' 
                    ? `<button class="btn-action" onclick="showQrisModal(${p.id}, '${p.keterangan}', ${p.jumlah})">BAYAR SEKARANG</button>` 
                    : 'SELESAI'}
            </td>
        </tr>
    `).join('') : '<tr><td colspan="5" style="text-align:center;">Belum ada tagihan iuran kompi.</td></tr>';
}

async function showQrisModal(id, desc, amount) {
    activePaymentId = id;
    document.getElementById('qris-bill-info').innerText = `${desc} - Rp ${Number(amount).toLocaleString()}`;

    const res = await authFetch('/api/payment-config');
    const data = await res.json();
    if (data.success) {
        const cfg = data.config;
        document.getElementById('modal-bank-name').innerText = cfg.bank_name;
        document.getElementById('modal-bank-acc').innerText = cfg.account_number;
        document.getElementById('modal-bank-holder').innerText = cfg.account_holder;

        const qrisData = `${cfg.qris_payload}:BILL-${id}:AMOUNT-${amount}`;
        document.getElementById('qris-barcode').src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrisData)}`;
    }

    document.getElementById('radar-text').innerText = 'Memindai Sinyal Pembayaran Bank... (Auto-ACC)';
    document.getElementById('modal-qris').style.display = 'flex';

    // Radar Auto-ACC: Cek berkala status pembayaran tiap 3 detik
    if (activePollingTimer) clearInterval(activePollingTimer);
    activePollingTimer = setInterval(async () => {
        if (!activePaymentId) return;
        const statusRes = await authFetch(`/api/payments/${activePaymentId}/status`);
        const statusData = await statusRes.json();
        if (statusData.success && statusData.status === 'LUNAS') {
            clearInterval(activePollingTimer);
            notify('PEMBAYARAN DITERIMA & DI-ACC OTOMATIS OLEH MARKAS!');
            closeQris();
            loadMemberPayments();
        }
    }, 3000);
}

function closeQris() {
    activePaymentId = null;
    if (activePollingTimer) clearInterval(activePollingTimer);
    document.getElementById('modal-qris').style.display = 'none';
}

async function loadPaymentConfig() {
    const res = await authFetch('/api/payment-config');
    const data = await res.json();
    if (data.success) {
        const c = data.config;
        document.getElementById('cfg-bank-name').value = c.bank_name;
        document.getElementById('cfg-account-number').value = c.account_number;
        document.getElementById('cfg-account-holder').value = c.account_holder;
        document.getElementById('cfg-qris-nmid').value = c.qris_nmid;
        document.getElementById('cfg-qris-payload').value = c.qris_payload;
    }
}

document.getElementById('form-config-payment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await authFetch('/api/admin/payment-config', {
        method: 'PUT',
        body: JSON.stringify({
            bank_name: document.getElementById('cfg-bank-name').value,
            account_number: document.getElementById('cfg-account-number').value,
            account_holder: document.getElementById('cfg-account-holder').value,
            qris_nmid: document.getElementById('cfg-qris-nmid').value,
            qris_payload: document.getElementById('cfg-qris-payload').value
        })
    });
    const data = await res.json();
    notify(data.message);
});

async function loadAdminDashboard() {
    const res = await authFetch('/api/admin/dashboard-data');
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('hud-total-members').innerText = `${data.stats.totalMembers} Prajurit`;
    document.getElementById('hud-total-lunas').innerText = `${data.stats.totalSudahBayar} Tagihan`;
    document.getElementById('hud-total-menunggak').innerText = `${data.stats.totalBelumBayar} Tagihan`;
    document.getElementById('hud-total-kas').innerText = `Rp ${data.stats.totalKas.toLocaleString()}`;

    const tableBelum = document.getElementById('table-belum-bayar');
    tableBelum.innerHTML = data.belumBayar.length ? data.belumBayar.map(p => `
        <tr>
            <td>#${p.id}</td>
            <td><strong>${p.pangkat} ${p.fullname}</strong></td>
            <td>${p.nrp}</td>
            <td>${p.keterangan}</td>
            <td>Rp ${Number(p.jumlah).toLocaleString()}</td>
            <td><span class="badge badge-menunggak">${p.status}</span></td>
            <td><button class="btn-action" onclick="confirmLunasByAdmin(${p.id})">SAHKAN MANUAL</button></td>
        </tr>
    `).join('') : '<tr><td colspan="7" style="text-align:center;">Seluruh prajurit tertib! Tidak ada tunggakan.</td></tr>';

    const tableSudah = document.getElementById('table-sudah-bayar');
    tableSudah.innerHTML = data.sudahBayar.length ? data.sudahBayar.map(p => `
        <tr>
            <td>#${p.id}</td>
            <td><strong>${p.pangkat} ${p.fullname}</strong></td>
            <td>${p.nrp}</td>
            <td>${p.keterangan}</td>
            <td>Rp ${Number(p.jumlah).toLocaleString()}</td>
            <td><span class="badge badge-lunas">LUNAS</span></td>
        </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center;">Belum ada tagihan yang lunas.</td></tr>';

    loadAdminUserList();
}

document.getElementById('form-admin-create-bill').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await authFetch('/api/admin/create-bill', {
        method: 'POST',
        body: JSON.stringify({
            keterangan: document.getElementById('bill-desc').value,
            jumlah: document.getElementById('bill-amount').value
        })
    });
    const data = await res.json();
    notify(data.message);
    document.getElementById('form-admin-create-bill').reset();
    loadAdminDashboard();
});

async function confirmLunasByAdmin(id) {
    const res = await authFetch(`/api/admin/payments/${id}/lunas`, { method: 'PUT' });
    const data = await res.json();
    notify(data.message);
    loadAdminDashboard();
}

async function loadAdminUserList() {
    const res = await authFetch('/api/admin/users');
    const data = await res.json();
    if (!data.success) return;

    const table = document.getElementById('admin-user-table');
    table.innerHTML = data.users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.fullname}</td>
            <td>${u.pangkat}</td>
            <td>${u.nrp}</td>
            <td><strong style="color: ${u.role === 'admin' ? 'var(--tni-gold)' : 'var(--tni-radar-neon)'}">${u.role.toUpperCase()}</strong></td>
            <td>
                <button class="btn-action" onclick="showAdminEditUser(${u.id}, '${u.fullname}', '${u.pangkat}', '${u.nrp}', '${u.role}')">EDIT</button>
                ${u.username !== 'admin' ? `<button class="btn-action btn-danger" onclick="deleteUser(${u.id})">HAPUS</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function showAdminEditUser(id, name, rank, nrp, role) {
    document.getElementById('box-admin-edit-user').style.display = 'block';
    document.getElementById('adm-user-id').value = id;
    document.getElementById('adm-user-fullname').value = name;
    document.getElementById('adm-user-pangkat').value = rank;
    document.getElementById('adm-user-nrp').value = nrp || '';
    document.getElementById('adm-user-role').value = role;
    document.getElementById('adm-user-password').value = '';
    window.scrollTo({ top: document.getElementById('box-admin-edit-user').offsetTop - 20, behavior: 'smooth' });
}

document.getElementById('form-admin-edit-user').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('adm-user-id').value;
    const res = await authFetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
            fullname: document.getElementById('adm-user-fullname').value,
            pangkat: document.getElementById('adm-user-pangkat').value,
            nrp: document.getElementById('adm-user-nrp').value,
            role: document.getElementById('adm-user-role').value,
            new_password: document.getElementById('adm-user-password').value
        })
    });
    const data = await res.json();
    notify(data.message);
    document.getElementById('box-admin-edit-user').style.display = 'none';
    loadAdminDashboard();
});

async function deleteUser(id) {
    if (!confirm('Prajurit ini akan dikeluarkan dari pangkalan kompi. Lanjutkan?')) return;
    const res = await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    notify(data.message);
    loadAdminDashboard();
}

function printReport() {
    window.print();
}

// Ekspor Asli Excel (.XLSX) dengan pembagian kolom rapi
async function exportToExcel() {
    const res = await authFetch('/api/admin/dashboard-data');
    const data = await res.json();
    if (!data.success) {
        notify('Gagal mengambil data pangkalan.');
        return;
    }

    const allPayments = [...data.belumBayar, ...data.sudahBayar];
    if (allPayments.length === 0) {
        notify('Belum ada data iuran untuk diekspor.');
        return;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (window.XLSX) {
        const rows = allPayments.map((p, idx) => ({
            "NO": idx + 1,
            "ID TAGIHAN": `#${p.id}`,
            "PANGKAT": p.pangkat || '-',
            "NAMA LENGKAP PRAJURIT": p.fullname || '-',
            "NRP": p.nrp || '-',
            "KETERANGAN IURAN": p.keterangan || '-',
            "NOMINAL (RP)": Number(p.jumlah),
            "STATUS": p.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);

        worksheet['!cols'] = [
            { wch: 6 },
            { wch: 12 },
            { wch: 14 },
            { wch: 28 },
            { wch: 18 },
            { wch: 32 },
            { wch: 16 },
            { wch: 16 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Kas KIPAN A");
        XLSX.writeFile(workbook, `Laporan_Kas_KIPAN_A_${today}.xlsx`);
        notify('Berkas Excel (.xlsx) berhasil diunduh dan rapi!');
        return;
    }

    // Fallback CSV (Pemisah titik koma untuk Excel Indonesia)
    const headers = ['sep=;\r\nNo', 'ID Tagihan', 'Pangkat', 'Nama Lengkap Prajurit', 'NRP', 'Keterangan Iuran', 'Nominal (Rp)', 'Status'];
    const csvRows = allPayments.map((p, idx) => [
        idx + 1,
        `#${p.id}`,
        `"${p.pangkat || '-'}"`,
        `"${(p.fullname || '').replace(/"/g, '""')}"`,
        `'${p.nrp || '-'}'`,
        `"${(p.keterangan || '').replace(/"/g, '""')}"`,
        Number(p.jumlah),
        p.status
    ]);

    const csvContent = '\uFEFF' + headers.join(';') + '\r\n' + csvRows.map(r => r.join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Kas_KIPAN_A_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify('Berkas Rekap berhasil diunduh!');
}

function logout() {
    clearAuth();
    updateNav();
    navigate('sec-auth');
    notify('Selesai tugas, Anda telah keluar markas.');
}

checkSession();