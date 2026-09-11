// RUTE DARURAT KHUSUS VERCEL: PAKSA SETEL ULANG ADMIN & REPAIR DATABASE
app.get('/api/setup-admin-darurat', async (req, res) => {
    try {
        // 1. Pastikan tabel users dan payment_settings sudah ada beserta kolomnya
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

        // 2. Buat ulang akun admin dengan password fresh
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
                <p style="font-size:12px;color:#777;">Periksa apakah DATABASE_URL di Environment Variables Vercel sudah terpasang dengan benar.</p>
            </div>
        `);
    }
});
