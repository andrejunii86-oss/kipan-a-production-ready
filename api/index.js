const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString || 'postgresql://unconfigured:unconfigured@localhost:5432/unconfigured',
    ssl: {
        rejectUnauthorized: false
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'kipan_a_tni_ad_super_secret_key_2026';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.static(path.join(__dirname, '../public')));

// Setup / Inisialisasi Database Darurat
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
        `);

        const adminHash = await bcrypt.hash('admin123', 10);
        await pool.query("DELETE FROM users WHERE LOWER(username) = 'admin' OR LOWER(nrp) = '11030012345'");
        await pool.query(
            "INSERT INTO users (fullname, pangkat, nrp, username, password, role) VALUES ($1, $2, $3, $4, $5, 'admin')",
            ['Komandan Kompi A (Danki)', 'Kapten Inf', '11030012345', 'admin', adminHash]
        );

        res.send(`<h2 style="color:green; text-align:center; margin-top:50px;">DATABASE & ADMIN SIAP! <a href="/">Kembali ke Markas</a></h2>`);
    } catch (err) {
        console.error('[SETUP ERROR]', err);
        res.status(500).send(`<h2 style="color:red; text-align:center; margin-top:50px;">GAGAL KONEKSI: ${err.message}</h2>`);
    }
});

// Rute API Login
app.post('/api/login', async (req, res) => {
    try {
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
        res.status(500).json({ success: false, message: "Terjadi kesalahan server: " + err.message });
    }
});

// Rute API Register
app.post('/api/register', async (req, res) => {
    try {
        const { fullname, pangkat, nrp, username, password } = req.body;
        
        if (!username || !password || !nrp || !fullname) {
            return res.status(400).json({ success: false, message: "Semua kolom wajib diisi." });
        }

        const existing = await pool.query(
            "SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(nrp) = LOWER($2)",
            [username.trim(), nrp.trim()]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Username atau NRP sudah terdaftar." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        await pool.query(
            "INSERT INTO users (fullname, pangkat, nrp, username, password, role) VALUES ($1, $2, $3, $4, $5, 'member')",
            [fullname, pangkat, nrp.trim(), username.trim(), hashedPassword]
        );

        res.json({ success: true, message: "Pendaftaran personel berhasil! Silakan login." });
    } catch (err) {
        console.error('[REGISTER ERROR]', err);
        res.status(500).json({ success: false, message: "Terjadi kesalahan server: " + err.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// PENTING: Wajib mengekspor app untuk Vercel Serverless, TANPA app.listen()
module.exports = app;
