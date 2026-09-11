require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const pool = require('../config/db');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'kipan_tactical_jwt_secret_2026';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Inisialisasi Database
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                fullname VARCHAR(100) NOT NULL,
                pangkat VARCHAR(50) NOT NULL DEFAULT 'Prada',
                nrp VARCHAR(30) DEFAULT '-',
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'member',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE users ADD COLUMN IF NOT EXISTS nrp VARCHAR(30) DEFAULT '-';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member';

            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                keterangan VARCHAR(255) NOT NULL,
                jumlah NUMERIC(12, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'BELUM BAYAR',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS payment_settings (
                id INT PRIMARY KEY DEFAULT 1,
                bank_name VARCHAR(50) DEFAULT 'Bank BRI',
                account_number VARCHAR(50) DEFAULT '0123-01-000987-53-1',
                account_holder VARCHAR(100) DEFAULT 'KAS KOMPI SENAPAN A',
                qris_nmid VARCHAR(50) DEFAULT 'ID1020304050607',
                qris_payload TEXT DEFAULT '00020101021226580016ID.GO.TNI-AD.KIPANA5204581253033605802ID5914KIPAN A KAS6007JAKARTA'
            );

            INSERT INTO payment_settings (id, bank_name, account_number, account_holder, qris_nmid, qris_payload)
            VALUES (1, 'Bank BRI', '0123-01-000987-53-1', 'KAS KOMPI SENAPAN A', 'ID1020304050607', '00020101021226580016ID.GO.TNI-AD.KIPANA')
            ON CONFLICT (id) DO NOTHING;

            CREATE TABLE IF NOT EXISTS system_setup (
                key VARCHAR(50) PRIMARY KEY,
                value VARCHAR(50)
            );
        `);

        // Bersihkan akun demo sekali pakai pada instalasi awal
        const setupCheck = await pool.query("SELECT * FROM system_setup WHERE key = 'clean_demo_production_v3'");
        if (setupCheck.rowCount === 0) {
            await pool.query("DELETE FROM payments;");
            await pool.query("DELETE FROM users WHERE LOWER(username) != 'admin';");
            await pool.query("INSERT INTO system_setup (key, value) VALUES ('clean_demo_production_v3', 'done');");
            console.log('[TNI KIPAN A] Data simulasi dibersihkan. Menyisakan akun Komando.');
        }

        // Buat akun admin bawaan hanya jika akun belum terdaftar
        const check = await pool.query("SELECT id FROM users WHERE LOWER(username) = 'admin'");
        if (check.rowCount === 0) {
            const adminHash = await bcrypt.hash('admin123', 10);
            await pool.query(
                "INSERT INTO users (fullname, pangkat, nrp, username, password, role) VALUES ($1, $2, $3, $4, $5, 'admin')",
                ['Komandan Kompi A (Danki)', 'Kapten Inf', '11030012345', 'admin', adminHash]
            );
            console.log('[TNI KIPAN A] Akun Admin awal dibuat (user: admin, pass: admin123).');
        } else {
            // Memastikan hak akses tetap admin tanpa mereset password yang telah diubah pengguna
            await pool.query("UPDATE users SET role = 'admin' WHERE LOWER(username) = 'admin'");
        }
        console.log('[TNI KIPAN A] Server Produksi Siap. Database terhubung.');
    } catch (err) {
        console.error('[DATABASE INIT ERROR]', err.message);
    }
}
initDatabase();

// Middleware Autentikasi JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Akses ditolak: Harap login terlebih dahulu.' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: 'Izin tugas kedaluwarsa, silakan login ulang.' });
        req.user = decoded;
        next();
    });
};

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ success: false, message: 'Akses Ditolak: Khusus Komando / Danki.' });
};

// --- AUTENTIKASI ---
app.post('/api/register', async (req, res) => {
    const { fullname, pangkat, nrp, username, password } = req.body;
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanNrp = (nrp || '-').trim();
    const cleanPass = (password || '').trim();

    if (!cleanUser || !cleanPass) return res.status(400).json({ success: false, message: 'Data pendaftaran belum lengkap!' });

    try {
        const hash = await bcrypt.hash(cleanPass, 10);
        await pool.query(
            "INSERT INTO users (fullname, pangkat, nrp, username, password, role) VALUES ($1, $2, $3, $4, $5, 'member')",
            [(fullname || 'Prajurit').trim(), pangkat || 'Prada', cleanNrp, cleanUser, hash]
        );
        res.json({ success: true, message: 'Prajurit berhasil terdata di pangkalan KIPAN A!' });
    } catch {
        res.status(400).json({ success: false, message: 'Username atau NRP sudah digunakan prajurit lain!' });
    }
});

app.post('/api/login', async (req, res) => {
    const cleanLogin = (req.body.username || '').trim().toLowerCase();
    const cleanPass = (req.body.password || '').trim();

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE LOWER(TRIM(username)) = $1 OR LOWER(TRIM(nrp)) = $1",
            [cleanLogin]
        );
        const user = result.rows[0];

        if (user && await bcrypt.compare(cleanPass, user.password)) {
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role, fullname: user.fullname, pangkat: user.pangkat, nrp: user.nrp },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.json({
                success: true,
                message: `Laporan diterima, selamat datang ${user.pangkat} ${user.fullname}!`,
                token,
                user: { id: user.id, username: user.username, fullname: user.fullname, pangkat: user.pangkat, nrp: user.nrp, role: user.role }
            });
        }
        res.status(401).json({ success: false, message: 'NRP/Username atau Sandi salah.' });
    } catch {
        res.status(500).json({ success: false, message: 'Pangkalan data tidak merespons.' });
    }
});

app.get('/api/me', verifyToken, (req, res) => res.json({ success: true, user: req.user }));

// --- PENGATURAN REKENING & QRIS RESMI ---
app.get('/api/payment-config', verifyToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM payment_settings WHERE id = 1");
        res.json({ success: true, config: result.rows[0] });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal mengambil rekening komando.' });
    }
});

app.put('/api/admin/payment-config', verifyToken, adminOnly, async (req, res) => {
    const { bank_name, account_number, account_holder, qris_nmid, qris_payload } = req.body;
    try {
        await pool.query(`
            UPDATE payment_settings 
            SET bank_name = $1, account_number = $2, account_holder = $3, qris_nmid = $4, qris_payload = $5 
            WHERE id = 1
        `, [bank_name, account_number, account_holder, qris_nmid, qris_payload]);
        res.json({ success: true, message: 'Rekening Bank & QRIS Komando berhasil diperbarui!' });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal menyimpan konfigurasi pembayaran.' });
    }
});

// --- IURAN & AUTO-ACC REAL-TIME ---
app.get('/api/payments', verifyToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM payments WHERE user_id = $1 ORDER BY id DESC", [req.user.id]);
        res.json({ success: true, payments: result.rows });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal memuat catatan iuran.' });
    }
});

app.get('/api/payments/:id/status', verifyToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, status FROM payments WHERE id = $1", [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false });
        res.json({ success: true, status: result.rows[0].status });
    } catch {
        res.status(500).json({ success: false });
    }
});

// Endpoint Webhook Otomatis untuk Integrasi Payment Gateway
app.post('/api/payment/webhook', async (req, res) => {
    try {
        const body = req.body || {};
        const orderId = body.order_id || body.payment_id || body.id || '';
        const status = (body.transaction_status || body.status || '').toLowerCase();

        if (orderId && (status === 'settlement' || status === 'capture' || status === 'success' || status === 'paid')) {
            const cleanId = String(orderId).replace(/\D/g, '');
            if (cleanId) {
                await pool.query("UPDATE payments SET status = 'LUNAS' WHERE id = $1", [cleanId]);
            }
        }
        res.status(200).json({ success: true, message: 'Sinyal pembayaran berhasil diproses.' });
    } catch (err) {
        console.error('[WEBHOOK ERROR]', err.message);
        res.status(500).json({ success: false });
    }
});

// Pembaruan Akun Mandiri (Termasuk Akun Admin)
app.put('/api/user/settings', verifyToken, async (req, res) => {
    const { fullname, pangkat, nrp, new_password } = req.body;
    try {
        if (new_password && new_password.trim() !== '') {
            const hash = await bcrypt.hash(new_password.trim(), 10);
            await pool.query(
                "UPDATE users SET fullname = $1, pangkat = $2, nrp = $3, password = $4 WHERE id = $5",
                [fullname.trim(), pangkat, nrp.trim(), hash, req.user.id]
            );
        } else {
            await pool.query(
                "UPDATE users SET fullname = $1, pangkat = $2, nrp = $3 WHERE id = $4",
                [fullname.trim(), pangkat, nrp.trim(), req.user.id]
            );
        }
        res.json({ success: true, message: 'Data prajurit berhasil disinkronkan.' });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal memperbarui data profil.' });
    }
});

// --- PANEL KOMANDO ADMIN ---
app.get('/api/admin/dashboard-data', verifyToken, adminOnly, async (req, res) => {
    try {
        const countRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'member'");
        const totalMembers = parseInt(countRes.rows[0].count) || 0;

        const paymentsRes = await pool.query(`
            SELECT payments.*, users.fullname, users.pangkat, users.nrp 
            FROM payments JOIN users ON payments.user_id = users.id 
            ORDER BY payments.id DESC
        `);

        const all = paymentsRes.rows;
        const sudahBayar = all.filter(p => p.status === 'LUNAS');
        const belumBayar = all.filter(p => p.status !== 'LUNAS');
        const totalKas = sudahBayar.reduce((acc, curr) => acc + Number(curr.jumlah), 0);

        res.json({
            success: true,
            stats: { totalMembers, totalSudahBayar: sudahBayar.length, totalBelumBayar: belumBayar.length, totalKas },
            sudahBayar,
            belumBayar
        });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal memuat rekapitulasi data kompi.' });
    }
});

app.post('/api/admin/create-bill', verifyToken, adminOnly, async (req, res) => {
    const { keterangan, jumlah } = req.body;
    try {
        const members = await pool.query("SELECT id FROM users WHERE role = 'member'");
        if (members.rows.length === 0) return res.status(400).json({ success: false, message: 'Belum ada prajurit yang terdaftar di pangkalan.' });

        for (const m of members.rows) {
            await pool.query(
                "INSERT INTO payments (user_id, keterangan, jumlah, status) VALUES ($1, $2, $3, 'BELUM BAYAR')",
                [m.id, keterangan, jumlah]
            );
        }
        res.json({ success: true, message: `Instruksi iuran "${keterangan}" diterbitkan untuk ${members.rows.length} personel.` });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal menerbitkan tagihan.' });
    }
});

app.put('/api/admin/payments/:id/lunas', verifyToken, adminOnly, async (req, res) => {
    try {
        await pool.query("UPDATE payments SET status = 'LUNAS' WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: 'Status iuran disahkan LUNAS oleh Danki.' });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal mengesahkan iuran.' });
    }
});

app.get('/api/admin/users', verifyToken, adminOnly, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, fullname, pangkat, nrp, username, role FROM users ORDER BY id ASC");
        res.json({ success: true, users: result.rows });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal memuat personel kompi.' });
    }
});

app.put('/api/admin/users/:id', verifyToken, adminOnly, async (req, res) => {
    const { fullname, pangkat, nrp, role, new_password } = req.body;
    try {
        if (new_password && new_password.trim() !== '') {
            const hash = await bcrypt.hash(new_password.trim(), 10);
            await pool.query(
                "UPDATE users SET fullname = $1, pangkat = $2, nrp = $3, role = $4, password = $5 WHERE id = $6",
                [fullname.trim(), pangkat, nrp.trim(), role, hash, req.params.id]
            );
        } else {
            await pool.query(
                "UPDATE users SET fullname = $1, pangkat = $2, nrp = $3, role = $4 WHERE id = $5",
                [fullname.trim(), pangkat, nrp.trim(), role, req.params.id]
            );
        }
        res.json({ success: true, message: 'Data prajurit berhasil diubah oleh Danki.' });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal mengubah data prajurit.' });
    }
});

app.delete('/api/admin/users/:id', verifyToken, adminOnly, async (req, res) => {
    try {
        await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: 'Prajurit dikeluarkan dari markas kompi.' });
    } catch {
        res.status(500).json({ success: false, message: 'Gagal menghapus prajurit.' });
    }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[KIPAN A] Markas Tempur Operasional: http://localhost:${PORT}`));
