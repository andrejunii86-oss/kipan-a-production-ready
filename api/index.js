const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

// Konfigurasi koneksi database yang aman untuk Cloud/Vercel (Mencegah lari ke localhost)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("[CRITICAL ERROR] DATABASE_URL belum terpasang di Environment Variables Vercel!");
}

const pool = new Pool({
    connectionString: connectionString || 'postgresql://unconfigured:unconfigured@localhost:5432/unconfigured',
    ssl: {
        rejectUnauthorized: false
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'kipan_a_tni_ad_super_secret_key_2026';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pengaturan file statis untuk Vercel Serverless
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.static(path.join(__dirname, '../public')));

// 1. RUTE DARURAT: Sinkronisasi Tabel & Admin
app.get('/api/setup-admin-darurat', async (req, res) => {
    try {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL kosong di Vercel Environment Variables!");
        }

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
        `);

        const adminHash = await bcrypt.hash('admin123', 10);
        await pool.query("DELETE FROM users WHERE LOWER(username) = 'admin' OR LOWER(nrp) = '11030012345'");
        await pool.query(
            "INSERT INTO users (fullname, pangkat, nrp, username, password, role) VALUES ($1, $2, $3, $4, $5, 'admin')",
            ['Komandan Kompi A (Danki)', 'Kapten Inf', '11030012345', 'admin', adminHash]
        );

        res.send(`
            <div style="font-family:Arial,sans-serif;padding:30px;max-width:500px;margin:50px auto;border:2px solid #2ecc71;border-radius:8px;background:#f9fdfa;text-align:center;">
                <h2 style="color:#27ae60;margin-top:0;">DATABASE & ADMIN SIAP!</h2>
                <p style="color:#333;">Struktur tabel dan akun Komando telah disinkronkan ke Cloud Neon.</p>
                <div style="background:#fff;padding:12px;border:1px dashed #27ae60;margin:15px 0;text-align:left;">
                    <strong>Username / NRP:</strong> admin<br>
                    <strong>Password:</strong> admin123
                </div>
                <a href="/" style="display:inline-block;padding:10px 20px;background:#27ae60;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">Masuk ke Markas</a>
            </div>
        `);
    } catch (err) {
        console.error('[SETUP ERROR]', err);
        res.status(500).send(`
            <div style="font-family:Arial,sans-serif;padding:30px;max-width:500px;margin:50px auto;border:2px solid #e74c3c;border-radius:8px;background:#fffaf9;">
                <h2 style="color:#c0392b;margin-top:0;">GAGAL KONEKSI DATABASE</h2>
                <p style="color:#333;">Detail galat: <b>${err.message}</b></p>
                <p style="font-size:12px;color:#777;">Pastikan DATABASE_URL sudah terpasang di Environment Variables Vercel (Production, Preview, Development).</p>
            </div>
        `);
    }
});

// 2. RUTE API LOGIN
app.post('/api/login', async (req, res) => {
    try {
        if (!process.env.DATABASE_URL) {
            return res.status(500).json({ success: false, message: "DATABASE_URL belum dikonfigurasi di Vercel." });
        }

        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Username dan password wajib diisi." });
        }

        const result = await pool.query(
            "SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(nrp) = LOWER($1)",
            [username.trim()]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, message: "Pengguna atau NRP tidak ditemukan." });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(400).json({ success: false, message: "Kata sandi salah." });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            success: true,
            message: "Login berhasil",
            token,
            user: {
                id: user.id,
                fullname: user.fullname,
                pangkat: user.pangkat,
                nrp: user.nrp,
                username: user.username,
                role: user.role
            }
        });
    } catch (err) {
        console.error('[LOGIN ERROR]', err);
        res.status(500).json({ success: false, message: "Terjadi kesalahan pada server database: " + err.message });
    }
});

// 3. FALLBACK RUTE UTAMA (MENGARAHKAN KE INDEX.HTML)
app.get('*', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

module.exports = app;
