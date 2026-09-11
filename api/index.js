// RUTE API REGISTER (PENDAFTARAN PERSONEL BARU)
app.post('/api/register', async (req, res) => {
    try {
        const { fullname, pangkat, nrp, username, password } = req.body;
        
        if (!username || !password || !nrp || !fullname) {
            return res.status(400).json({ success: false, message: "Semua kolom wajib diisi." });
        }

        // Cek apakah username atau NRP sudah terdaftar
        const existing = await pool.query(
            "SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(nrp) = LOWER($2)",
            [username.trim(), nrp.trim()]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Username atau NRP sudah terdaftar di Markas." });
        }

        // Enkripsi password menggunakan bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Masukkan ke database dengan role default 'member'
        await pool.query(
            "INSERT INTO users (fullname, pangkat, nrp, username, password, role) VALUES ($1, $2, $3, $4, $5, 'member')",
            [fullname, pangkat, nrp.trim(), username.trim(), hashedPassword]
        );

        res.json({ success: true, message: "Pendaftaran personel berhasil! Silakan login." });
    } catch (err) {
        console.error('[REGISTER ERROR]', err);
        res.status(500).json({ success: false, message: "Terjadi kesalahan pada server database." });
    }
});
