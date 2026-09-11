// --- FUNGSI NAVIGASI ANTAR SECTION ---
function navigate(sectionId) {
    const sections = document.querySelectorAll('.section-box');
    sections.forEach(sec => sec.classList.remove('active'));
    
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
    }

    if (sectionId === 'sec-dashboard') {
        loadMemberDashboard();
    }
    if (sectionId === 'sec-admin') {
        loadAdminData();
    }
    if (sectionId === 'sec-settings') {
        loadUserSettingsForm();
    }
}

// --- PENGATURAN TAMPILAN NAVBAR BERDASARKAN STATUS LOGIN ---
function updateNavVisibility() {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');

    const navAuth = document.getElementById('nav-auth');
    const navDashboard = document.getElementById('nav-dashboard');
    const navSettings = document.getElementById('nav-settings');
    const navAdmin = document.getElementById('nav-admin');
    const navLogout = document.getElementById('nav-logout');

    if (token && userJson) {
        const user = JSON.parse(userJson);
        
        if (navAuth) navAuth.style.display = 'none';
        if (navDashboard) navDashboard.style.display = 'inline-block';
        if (navSettings) navSettings.style.display = 'inline-block';
        if (navLogout) navLogout.style.display = 'inline-block';

        if (user.role === 'admin') {
            if (navAdmin) navAdmin.style.display = 'inline-block';
        } else {
            if (navAdmin) navAdmin.style.display = 'none';
        }
    } else {
        if (navAuth) navAuth.style.display = 'inline-block';
        if (navDashboard) navDashboard.style.display = 'none';
        if (navSettings) navSettings.style.display = 'none';
        if (navAdmin) navAdmin.style.display = 'none';
        if (navLogout) navLogout.style.display = 'none';
    }
}

// --- EVENT LISTENER FORM LOGIN ---
const formLogin = document.getElementById('form-login');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('log-username').value.trim();
        const password = document.getElementById('log-password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));

                showAlert("Login berhasil! Memasuki Markas...", "success");
                updateNavVisibility();

                setTimeout(() => {
                    if (result.user.role === 'admin') {
                        navigate('sec-admin');
                    } else {
                        navigate('sec-dashboard');
                    }
                }, 800);

            } else {
                showAlert(result.message || "Gagal masuk markas.", "error");
            }
        } catch (err) {
            console.error(err);
            showAlert("Terjadi kesalahan koneksi ke server.", "error");
        }
    });
}

// --- EVENT LISTENER FORM REGISTER ---
const formRegister = document.getElementById('form-register');
if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullname = document.getElementById('reg-fullname').value.trim();
        const pangkat = document.getElementById('reg-pangkat').value;
        const nrp = document.getElementById('reg-nrp').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullname, pangkat, nrp, username, password })
            });

            const result = await response.json();

            if (result.success) {
                showAlert(result.message, "success");
                formRegister.reset();
            } else {
                showAlert(result.message || "Gagal mendaftarkan personel.", "error");
            }
        } catch (err) {
            console.error(err);
            showAlert("Terjadi kesalahan koneksi ke server.", "error");
        }
    });
}

// --- FUNGSI LOGOUT ---
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateNavVisibility();
    navigate('sec-auth');
    showAlert("Berhasil keluar dari Markas.", "success");
}

// --- FUNGSI HELPER ALERT ---
function showAlert(message, type) {
    const alertBox = document.getElementById('alert-box');
    if (!alertBox) return;
    alertBox.innerText = message;
    alertBox.style.display = 'block';
    alertBox.style.background = type === 'success' ? '#1b4d3e' : '#5c1d1d';
    alertBox.style.borderColor = type === 'success' ? '#2ecc71' : '#e74c3c';
    alertBox.style.color = '#fff';
    
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 3500);
}

// --- FUNGSI PENDUKUNG DATA ---
async function loadMemberDashboard() {
    const userJson = localStorage.getItem('user');
    if (userJson) {
        const user = JSON.parse(userJson);
        const dashUser = document.getElementById('dash-user');
        if (dashUser) dashUser.innerText = `${user.fullname} (${user.pangkat} - NRP: ${user.nrp})`;
    }
}

async function loadAdminData() {
    // Fungsi rekapitulasi admin
}

function loadUserSettingsForm() {
    const userJson = localStorage.getItem('user');
    if (!userJson) return;
    const user = JSON.parse(userJson);
    
    const fullnameInput = document.getElementById('set-fullname');
    const pangkatSelect = document.getElementById('set-pangkat');
    const nrpInput = document.getElementById('set-nrp');
    
    if (fullnameInput) fullnameInput.value = user.fullname || '';
    if (pangkatSelect) pangkatSelect.value = user.pangkat || 'Prada';
    if (nrpInput) nrpInput.value = user.nrp || '';
}

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    updateNavVisibility();
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
        const user = JSON.parse(userJson);
        if (user.role === 'admin') {
            navigate('sec-admin');
        } else {
            navigate('sec-dashboard');
        }
    } else {
        navigate('sec-auth');
    }
});
