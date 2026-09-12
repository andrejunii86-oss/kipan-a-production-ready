const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   DATABASE
========================================================= */

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString:
        DATABASE_URL ||
        "postgresql://unconfigured:unconfigured@localhost:5432/unconfigured",
    ssl: {
        rejectUnauthorized: false,
    },
    max: 5,
});

/* =========================================================
   JWT
========================================================= */

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "kipan_a_tni_ad_super_secret_key_2026";

/* =========================================================
   STATIC FILE
========================================================= */

app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.static(path.join(__dirname, "../public")));

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

let databaseReady = false;

async function initDatabase() {
    if (databaseReady) return;

    if (!DATABASE_URL) {
        throw new Error("DATABASE_URL belum diatur di Vercel.");
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            fullname VARCHAR(100) NOT NULL,
            pangkat VARCHAR(50) NOT NULL DEFAULT 'Prada',
            nrp VARCHAR(30) UNIQUE NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'member',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS nrp VARCHAR(30);
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member';
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bills (
            id SERIAL PRIMARY KEY,
            description TEXT NOT NULL,
            amount NUMERIC(14,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount NUMERIC(14,2) NOT NULL DEFAULT 0,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            note TEXT DEFAULT '',
            paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            verified_at TIMESTAMP WITH TIME ZONE
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS payment_config (
            id INTEGER PRIMARY KEY,
            bank_name VARCHAR(100) DEFAULT '',
            account_number VARCHAR(100) DEFAULT '',
            account_holder VARCHAR(150) DEFAULT '',
            qris_nmid VARCHAR(150) DEFAULT '',
            qris_payload TEXT DEFAULT '',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        INSERT INTO payment_config
            (id, bank_name, account_number, account_holder, qris_nmid, qris_payload)
        VALUES
            (1, '', '', '', '', '')
        ON CONFLICT (id) DO NOTHING;
    `);

    databaseReady = true;
}

/* =========================================================
   AUTH HELPER
========================================================= */

function getToken(req) {
    const auth = req.headers.authorization || "";

    if (auth.startsWith("Bearer ")) {
        return auth.substring(7);
    }

    return null;
}

function authenticate(req, res, next) {
    try {
        const token = getToken(req);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Sesi login tidak ditemukan.",
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded;

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Sesi login sudah tidak valid. Silakan login kembali.",
        });
    }
}

function adminOnly(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Akses hanya untuk admin.",
        });
    }

    next();
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", async (req, res) => {
    try {
        await initDatabase();
        await pool.query("SELECT 1");

        res.json({
            success: true,
            database: true,
            message: "API dan database aktif.",
        });
    } catch (err) {
        console.error("[HEALTH ERROR]", err);

        res.status(500).json({
            success: false,
            database: false,
            message: err.message,
        });
    }
});

/* =========================================================
   SETUP ADMIN DARURAT
========================================================= */

app.get("/api/setup-admin-darurat", async (req, res) => {
    try {
        await initDatabase();

        const passwordHash = await bcrypt.hash("admin123", 10);

        await pool.query(
            `
            DELETE FROM users
            WHERE LOWER(username) = 'admin'
            `
        );

        await pool.query(
            `
            INSERT INTO users
            (
                fullname,
                pangkat,
                nrp,
                username,
                password,
                role
            )
            VALUES
            ($1, $2, $3, $4, $5, 'admin')
            `,
            [
                "Komandan Kompi A (Danki)",
                "Kapten Inf",
                "11030012345",
                "admin",
                passwordHash,
            ]
        );

        res.send(`
            <div style="
                font-family:Arial;
                text-align:center;
                margin-top:50px;
            ">
                <h2 style="color:green;">
                    ADMIN BERHASIL DIBUAT
                </h2>

                <p>Username: <b>admin</b></p>
                <p>Password: <b>admin123</b></p>

                <a href="/">
                    Kembali ke Markas
                </a>
            </div>
        `);
    } catch (err) {
        console.error("[SETUP ADMIN ERROR]", err);

        res.status(500).send(`
            <h2 style="color:red;text-align:center;">
                GAGAL
            </h2>

            <p style="text-align:center;">
                ${err.message}
            </p>
        `);
    }
});

/* =========================================================
   REGISTER
========================================================= */

app.post("/api/register", async (req, res) => {
    try {
        await initDatabase();

        const {
            fullname,
            pangkat,
            nrp,
            username,
            password,
        } = req.body;

        if (!fullname || !nrp || !username || !password) {
            return res.status(400).json({
                success: false,
                message: "Semua kolom wajib diisi.",
            });
        }

        const cleanFullname = String(fullname).trim();
        const cleanPangkat = String(pangkat || "Prada").trim();
        const cleanNrp = String(nrp).trim();
        const cleanUsername = String(username).trim();

        if (password.length < 4) {
            return res.status(400).json({
                success: false,
                message: "Kata sandi minimal 4 karakter.",
            });
        }

        const existing = await pool.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(username) = LOWER($1)
               OR LOWER(nrp) = LOWER($2)
            LIMIT 1
            `,
            [cleanUsername, cleanNrp]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Username atau NRP sudah terdaftar.",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `
            INSERT INTO users
            (
                fullname,
                pangkat,
                nrp,
                username,
                password,
                role
            )
            VALUES
            ($1, $2, $3, $4, $5, 'member')
            RETURNING
                id,
                fullname,
                pangkat,
                nrp,
                username,
                role,
                created_at
            `,
            [
                cleanFullname,
                cleanPangkat,
                cleanNrp,
                cleanUsername,
                hashedPassword,
            ]
        );

        const newUser = result.rows[0];

        res.json({
            success: true,
            message: "Pendaftaran personel berhasil! Silakan login.",
            user: newUser,
        });
    } catch (err) {
        console.error("[REGISTER ERROR]", err);

        res.status(500).json({
            success: false,
            message: "Gagal mendaftarkan personel: " + err.message,
        });
    }
});

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/login", async (req, res) => {
    try {
        await initDatabase();

        const {
            username,
            password,
        } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username/NRP dan password wajib diisi.",
            });
        }

        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE LOWER(username) = LOWER($1)
               OR LOWER(nrp) = LOWER($1)
            LIMIT 1
            `,
            [String(username).trim()]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Pengguna atau NRP tidak ditemukan.",
            });
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(400).json({
                success: false,
                message: "Kata sandi salah.",
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
            }
        );

        res.json({
            success: true,
            message: "Login berhasil.",
            token,
            user: {
                id: user.id,
                fullname: user.fullname,
                pangkat: user.pangkat,
                nrp: user.nrp,
                username: user.username,
                role: user.role,
            },
        });
    } catch (err) {
        console.error("[LOGIN ERROR]", err);

        res.status(500).json({
            success: false,
            message: "Terjadi kesalahan server: " + err.message,
        });
    }
});

/* =========================================================
   MEMBER DATA
========================================================= */

app.get(
    "/api/member/data",
    authenticate,
    async (req, res) => {
        try {
            await initDatabase();

            const userResult = await pool.query(
                `
                SELECT
                    id,
                    fullname,
                    pangkat,
                    nrp,
                    username,
                    role,
                    created_at
                FROM users
                WHERE id = $1
                `,
                [req.user.id]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Data prajurit tidak ditemukan.",
                });
            }

            const billsResult = await pool.query(
                `
                SELECT
                    p.id AS payment_id,
                    b.id AS bill_id,
                    b.description,
                    b.amount,
                    p.status,
                    p.note,
                    p.paid_at,
                    p.verified_at
                FROM payments p
                INNER JOIN bills b
                    ON b.id = p.bill_id
                WHERE p.user_id = $1
                ORDER BY b.created_at DESC, p.id DESC
                `,
                [req.user.id]
            );

            const configResult = await pool.query(`
                SELECT
                    bank_name,
                    account_number,
                    account_holder,
                    qris_nmid,
                    qris_payload
                FROM payment_config
                WHERE id = 1
            `);

            res.json({
                success: true,
                user: userResult.rows[0],
                bills: billsResult.rows,
                payment_config:
                    configResult.rows[0] || {},
            });
        } catch (err) {
            console.error("[MEMBER DATA ERROR]", err);

            res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil data prajurit: " +
                    err.message,
            });
        }
    }
);

/* =========================================================
   ADMIN DATA
========================================================= */

app.get(
    "/api/admin/data",
    authenticate,
    adminOnly,
    async (req, res) => {
        try {
            await initDatabase();

            const usersResult = await pool.query(`
                SELECT
                    id,
                    fullname,
                    pangkat,
                    nrp,
                    username,
                    role,
                    created_at
                FROM users
                ORDER BY created_at DESC
            `);

            const paymentsResult = await pool.query(`
                SELECT
                    p.id AS payment_id,
                    p.amount,
                    p.status,
                    p.note,
                    p.paid_at,
                    p.verified_at,

                    b.id AS bill_id,
                    b.description,
                    b.amount AS bill_amount,

                    u.id AS user_id,
                    u.fullname,
                    u.pangkat,
                    u.nrp,
                    u.username

                FROM payments p

                INNER JOIN bills b
                    ON b.id = p.bill_id

                INNER JOIN users u
                    ON u.id = p.user_id

                ORDER BY p.id DESC
            `);

            const billsResult = await pool.query(`
                SELECT
                    id,
                    description,
                    amount,
                    created_at
                FROM bills
                ORDER BY created_at DESC
            `);

            const configResult = await pool.query(`
                SELECT
                    bank_name,
                    account_number,
                    account_holder,
                    qris_nmid,
                    qris_payload,
                    updated_at
                FROM payment_config
                WHERE id = 1
            `);

            const totalMembersResult = await pool.query(`
                SELECT COUNT(*)::INTEGER AS total
                FROM users
                WHERE role = 'member'
            `);

            const lunasResult = await pool.query(`
                SELECT COUNT(*)::INTEGER AS total
                FROM payments
                WHERE status = 'verified'
            `);

            const menunggakResult = await pool.query(`
                SELECT COUNT(*)::INTEGER AS total
                FROM payments
                WHERE status != 'verified'
            `);

            const kasResult = await pool.query(`
                SELECT
                    COALESCE(
                        SUM(amount) FILTER (
                            WHERE status = 'verified'
                        ),
                        0
                    ) AS total
                FROM payments
            `);

            const totalMembers =
                Number(totalMembersResult.rows[0].total) || 0;

            const totalLunas =
                Number(lunasResult.rows[0].total) || 0;

            const totalMenunggak =
                Number(menunggakResult.rows[0].total) || 0;

            const totalKas =
                Number(kasResult.rows[0].total) || 0;

            res.json({
                success: true,

                stats: {
                    total_members: totalMembers,
                    total_lunas: totalLunas,
                    total_menunggak: totalMenunggak,
                    total_kas: totalKas,
                },

                users: usersResult.rows,

                members: usersResult.rows.filter(
                    (user) => user.role === "member"
                ),

                payments: paymentsResult.rows,

                bills: billsResult.rows,

                payment_config:
                    configResult.rows[0] || {
                        bank_name: "",
                        account_number: "",
                        account_holder: "",
                        qris_nmid: "",
                        qris_payload: "",
                    },
            });
        } catch (err) {
            console.error("[ADMIN DATA ERROR]", err);

            res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil data panel Komando: " +
                    err.message,
            });
        }
    }
);

/* =========================================================
   ADMIN CREATE BILL
========================================================= */

app.post(
    "/api/admin/bills",
    authenticate,
    adminOnly,
    async (req, res) => {
        const client = await pool.connect();

        try {
            await initDatabase();

            const {
                description,
                amount,
            } = req.body;

            const cleanDescription =
                String(description || "").trim();

            const cleanAmount = Number(amount);

            if (!cleanDescription) {
                return res.status(400).json({
                    success: false,
                    message: "Nama/keterangan iuran wajib diisi.",
                });
            }

            if (
                !Number.isFinite(cleanAmount) ||
                cleanAmount <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Nominal iuran tidak valid.",
                });
            }

            await client.query("BEGIN");

            const billResult = await client.query(
                `
                INSERT INTO bills
                (
                    description,
                    amount
                )
                VALUES
                ($1, $2)
                RETURNING *
                `,
                [
                    cleanDescription,
                    cleanAmount,
                ]
            );

            const bill = billResult.rows[0];

            const usersResult = await client.query(`
                SELECT id
                FROM users
                WHERE role = 'member'
                ORDER BY id
            `);

            for (const user of usersResult.rows) {
                await client.query(
                    `
                    INSERT INTO payments
                    (
                        bill_id,
                        user_id,
                        amount,
                        status
                    )
                    VALUES
                    ($1, $2, $3, 'pending')
                    `,
                    [
                        bill.id,
                        user.id,
                        cleanAmount,
                    ]
                );
            }

            await client.query("COMMIT");

            res.json({
                success: true,
                message:
                    `Iuran berhasil diterbitkan kepada ${usersResult.rows.length} prajurit.`,
                bill,
                total_members:
                    usersResult.rows.length,
            });
        } catch (err) {
            await client.query("ROLLBACK");

            console.error("[CREATE BILL ERROR]", err);

            res.status(500).json({
                success: false,
                message:
                    "Gagal menerbitkan iuran: " +
                    err.message,
            });
        } finally {
            client.release();
        }
    }
);

/* =========================================================
   MEMBER SUBMIT PAYMENT
========================================================= */

app.post(
    "/api/member/pay",
    authenticate,
    async (req, res) => {
        try {
            await initDatabase();

            const {
                payment_id,
                note,
            } = req.body;

            const paymentId = Number(payment_id);

            if (!Number.isInteger(paymentId)) {
                return res.status(400).json({
                    success: false,
                    message: "ID pembayaran tidak valid.",
                });
            }

            const result = await pool.query(
                `
                UPDATE payments
                SET
                    status = 'submitted',
                    note = $1,
                    paid_at = CURRENT_TIMESTAMP
                WHERE id = $2
                  AND user_id = $3
                  AND status != 'verified'
                RETURNING *
                `,
                [
                    String(note || ""),
                    paymentId,
                    req.user.id,
                ]
            );

            if (result.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Tagihan tidak ditemukan atau sudah diverifikasi.",
                });
            }

            res.json({
                success: true,
                message:
                    "Pembayaran berhasil dikirim untuk verifikasi.",
                payment: result.rows[0],
            });
        } catch (err) {
            console.error("[MEMBER PAY ERROR]", err);

            res.status(500).json({
                success: false,
                message:
                    "Gagal mengirim pembayaran: " +
                    err.message,
            });
        }
    }
);

/* =========================================================
   ADMIN VERIFY PAYMENT
========================================================= */

app.post(
    "/api/admin/payments/:id/verify",
    authenticate,
    adminOnly,
    async (req, res) => {
        try {
            await initDatabase();

            const paymentId = Number(req.params.id);

            if (!Number.isInteger(paymentId)) {
                return res.status(400).json({
                    success: false,
                    message: "ID pembayaran tidak valid.",
                });
            }

            const result = await pool.query(
                `
                UPDATE payments
                SET
                    status = 'verified',
                    verified_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
                `,
                [paymentId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Pembayaran tidak ditemukan.",
                });
            }

            res.json({
                success: true,
                message:
                    "Pembayaran berhasil diverifikasi.",
                payment: result.rows[0],
            });
        } catch (err) {
            console.error("[VERIFY PAYMENT ERROR]", err);

            res.status(500).json({
                success: false,
                message:
                    "Gagal memverifikasi pembayaran: " +
                    err.message,
            });
        }
    }
);

/* =========================================================
   ADMIN PAYMENT CONFIG
========================================================= */

app.post(
    "/api/admin/payment-config",
    authenticate,
    adminOnly,
    async (req, res) => {
        try {
            await initDatabase();

            const {
                bank_name,
                account_number,
                account_holder,
                qris_nmid,
                qris_payload,
            } = req.body;

            const result = await pool.query(
                `
                INSERT INTO payment_config
                (
                    id,
                    bank_name,
                    account_number,
                    account_holder,
                    qris_nmid,
                    qris_payload,
                    updated_at
                )
                VALUES
                (
                    1,
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (id)
                DO UPDATE SET
                    bank_name = EXCLUDED.bank_name,
                    account_number = EXCLUDED.account_number,
                    account_holder = EXCLUDED.account_holder,
                    qris_nmid = EXCLUDED.qris_nmid,
                    qris_payload = EXCLUDED.qris_payload,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
                `,
                [
                    String(bank_name || ""),
                    String(account_number || ""),
                    String(account_holder || ""),
                    String(qris_nmid || ""),
                    String(qris_payload || ""),
                ]
            );

            res.json({
                success: true,
                message:
                    "Pengaturan rekening dan QRIS berhasil disimpan.",
                config: result.rows[0],
            });
        } catch (err) {
            console.error(
                "[PAYMENT CONFIG ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal menyimpan pengaturan pembayaran: " +
                    err.message,
            });
        }
    }
);

/* =========================================================
   UPDATE USER PROFILE
========================================================= */

app.put(
    "/api/user/profile",
    authenticate,
    async (req, res) => {
        try {
            await initDatabase();

            const {
                fullname,
                pangkat,
                nrp,
                password,
            } = req.body;

            if (!fullname || !nrp) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Nama lengkap dan NRP wajib diisi.",
                });
            }

            const userResult = await pool.query(
                `
                SELECT *
                FROM users
                WHERE id = $1
                `,
                [req.user.id]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "User tidak ditemukan.",
                });
            }

            if (password && password.trim()) {
                const hash = await bcrypt.hash(
                    password.trim(),
                    10
                );

                await pool.query(
                    `
                    UPDATE users
                    SET
                        fullname = $1,
                        pangkat = $2,
                        nrp = $3,
                        password = $4
                    WHERE id = $5
                    `,
                    [
                        fullname.trim(),
                        String(pangkat || "Prada").trim(),
                        nrp.trim(),
                        hash,
                        req.user.id,
                    ]
                );
            } else {
                await pool.query(
                    `
                    UPDATE users
                    SET
                        fullname = $1,
                        pangkat = $2,
                        nrp = $3
                    WHERE id = $4
                    `,
                    [
                        fullname.trim(),
                        String(pangkat || "Prada").trim(),
                        nrp.trim(),
                        req.user.id,
                    ]
                );
            }

            const updated = await pool.query(
                `
                SELECT
                    id,
                    fullname,
                    pangkat,
                    nrp,
                    username,
                    role
                FROM users
                WHERE id = $1
                `,
                [req.user.id]
            );

            res.json({
                success: true,
                message:
                    "Data akun berhasil diperbarui.",
                user: updated.rows[0],
            });
        } catch (err) {
            console.error(
                "[UPDATE PROFILE ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal memperbarui akun: " +
                    err.message,
            });
        }
    }
);

/* =========================================================
   ADMIN EDIT USER
========================================================= */

app.put(
    "/api/admin/users/:id",
    authenticate,
    adminOnly,
    async (req, res) => {
        try {
            await initDatabase();

            const userId = Number(req.params.id);

            const {
                fullname,
                pangkat,
                nrp,
                role,
                password,
            } = req.body;

            if (!Number.isInteger(userId)) {
                return res.status(400).json({
                    success: false,
                    message: "ID user tidak valid.",
                });
            }

            if (!fullname || !nrp) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Nama dan NRP wajib diisi.",
                });
            }

            if (password && password.trim()) {
                const hash = await bcrypt.hash(
                    password.trim(),
                    10
                );

                await pool.query(
                    `
                    UPDATE users
                    SET
                        fullname = $1,
                        pangkat = $2,
                        nrp = $3,
                        role = $4,
                        password = $5
                    WHERE id = $6
                    `,
                    [
                        fullname.trim(),
                        String(pangkat || "Prada").trim(),
                        nrp.trim(),
                        role === "admin"
                            ? "admin"
                            : "member",
                        hash,
                        userId,
                    ]
                );
            } else {
                await pool.query(
                    `
                    UPDATE users
                    SET
                        fullname = $1,
                        pangkat = $2,
                        nrp = $3,
                        role = $4
                    WHERE id = $5
                    `,
                    [
                        fullname.trim(),
                        String(pangkat || "Prada").trim(),
                        nrp.trim(),
                        role === "admin"
                            ? "admin"
                            : "member",
                        userId,
                    ]
                );
            }

            const result = await pool.query(
                `
                SELECT
                    id,
                    fullname,
                    pangkat,
                    nrp,
                    username,
                    role
                FROM users
                WHERE id = $1
                `,
                [userId]
            );

            res.json({
                success: true,
                message:
                    "Data personel berhasil diperbarui.",
                user: result.rows[0],
            });
        } catch (err) {
            console.error(
                "[ADMIN EDIT USER ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal mengubah data personel: " +
                    err.message,
            });
        }
    }
);

/* =========================================================
   FALLBACK FRONTEND
========================================================= */

app.get("*", (req, res) => {
    res.sendFile(
        path.join(
            process.cwd(),
            "public",
            "index.html"
        )
    );
});

/* =========================================================
   VERCEL EXPORT
========================================================= */

module.exports = app;
