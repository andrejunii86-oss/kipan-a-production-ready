const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "kipan_a_tni_ad_super_secret_key_2026";

app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.static(path.join(__dirname, "../public")));


/* =========================================
   DATABASE
========================================= */

async function initDatabase() {
    if (!DATABASE_URL) {
        console.warn(
            "[DATABASE] DATABASE_URL belum diset."
        );
        return false;
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            fullname VARCHAR(100) NOT NULL,
            pangkat VARCHAR(50) NOT NULL DEFAULT 'Prada',
            nrp VARCHAR(30) UNIQUE NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'member',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bills (
            id SERIAL PRIMARY KEY,
            description VARCHAR(255) NOT NULL,
            amount NUMERIC(15,2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(30) DEFAULT 'menunggak',
            paid_at TIMESTAMP WITH TIME ZONE
        );

        CREATE TABLE IF NOT EXISTS payment_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            bank_name VARCHAR(100) DEFAULT '',
            account_number VARCHAR(100) DEFAULT '',
            account_holder VARCHAR(150) DEFAULT '',
            qris_nmid VARCHAR(150) DEFAULT '',
            qris_payload TEXT DEFAULT ''
        );

        INSERT INTO payment_config
            (id, bank_name, account_number, account_holder, qris_nmid, qris_payload)
        VALUES
            (1, '', '', '', '', '')
        ON CONFLICT (id) DO NOTHING;
    `);

    return true;
}


/* =========================================
   HEALTH CHECK
========================================= */

app.get("/api/health", async (req, res) => {
    try {
        if (!DATABASE_URL) {
            return res.status(503).json({
                success: false,
                database: false,
                message: "DATABASE_URL belum diset di Environment Variables."
            });
        }

        await pool.query("SELECT 1");

        res.json({
            success: true,
            database: true,
            message: "API dan database aktif."
        });
    } catch (err) {
        console.error("[HEALTH ERROR]", err);

        res.status(500).json({
            success: false,
            database: false,
            message: err.message
        });
    }
});


/* =========================================
   SETUP ADMIN
========================================= */

app.get("/api/setup-admin-darurat", async (req, res) => {
    try {
        if (!DATABASE_URL) {
            return res.status(500).send(`
                <h2 style="color:red;text-align:center;margin-top:50px">
                    DATABASE_URL BELUM DISET DI VERCEL
                </h2>
            `);
        }

        await initDatabase();

        const passwordHash =
            await bcrypt.hash("admin123", 10);

        await pool.query(
            `
            INSERT INTO users
            (fullname, pangkat, nrp, username, password, role)
            VALUES
            ($1, $2, $3, $4, $5, 'admin')
            ON CONFLICT (username)
            DO UPDATE SET
                fullname = EXCLUDED.fullname,
                pangkat = EXCLUDED.pangkat,
                nrp = EXCLUDED.nrp,
                password = EXCLUDED.password,
                role = 'admin'
            `,
            [
                "Komandan Kompi A",
                "Kapten Inf",
                "11030012345",
                "admin",
                passwordHash
            ]
        );

        res.send(`
            <div style="
                font-family:Arial;
                text-align:center;
                margin-top:60px;
            ">
                <h1 style="color:green">
                    DATABASE SIAP
                </h1>

                <p>
                    Admin berhasil dibuat.
                </p>

                <p>
                    Username: <b>admin</b>
                </p>

                <p>
                    Password: <b>admin123</b>
                </p>

                <a href="/">
                    Kembali ke Markas
                </a>
            </div>
        `);

    } catch (err) {
        console.error("[SETUP ERROR]", err);

        res.status(500).send(`
            <h2 style="
                color:red;
                text-align:center;
                margin-top:50px;
            ">
                GAGAL: ${escapeHtml(err.message)}
            </h2>
        `);
    }
});


/* =========================================
   REGISTER
========================================= */

app.post("/api/register", async (req, res) => {
    try {
        if (!DATABASE_URL) {
            return res.status(503).json({
                success: false,
                message:
                    "Database belum dikonfigurasi di server."
            });
        }

        await initDatabase();

        const {
            fullname,
            pangkat,
            nrp,
            username,
            password
        } = req.body;

        if (
            !fullname ||
            !nrp ||
            !username ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Nama, NRP, username dan password wajib diisi."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message:
                    "Password minimal 6 karakter."
            });
        }

        const existing =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(username) = LOWER($1)
                   OR LOWER(nrp) = LOWER($2)
                `,
                [
                    username.trim(),
                    nrp.trim()
                ]
            );

        if (existing.rows.length) {
            return res.status(409).json({
                success: false,
                message:
                    "Username atau NRP sudah terdaftar."
            });
        }

        const hash =
            await bcrypt.hash(password, 10);

        await pool.query(
            `
            INSERT INTO users
            (fullname, pangkat, nrp, username, password, role)
            VALUES ($1,$2,$3,$4,$5,'member')
            `,
            [
                fullname.trim(),
                pangkat || "Prada",
                nrp.trim(),
                username.trim(),
                hash
            ]
        );

        res.json({
            success: true,
            message:
                "Pendaftaran berhasil. Silakan login."
        });

    } catch (err) {
        console.error("[REGISTER ERROR]", err);

        res.status(500).json({
            success: false,
            message:
                "Terjadi kesalahan server: " +
                err.message
        });
    }
});


/* =========================================
   LOGIN
========================================= */

app.post("/api/login", async (req, res) => {
    try {
        if (!DATABASE_URL) {
            return res.status(503).json({
                success: false,
                message:
                    "Database belum dikonfigurasi di server."
            });
        }

        await initDatabase();

        const {
            username,
            password
        } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message:
                    "Username/NRP dan password wajib diisi."
            });
        }

        const result =
            await pool.query(
                `
                SELECT *
                FROM users
                WHERE LOWER(username) = LOWER($1)
                   OR LOWER(nrp) = LOWER($1)
                LIMIT 1
                `,
                [username.trim()]
            );

        if (!result.rows.length) {
            return res.status(401).json({
                success: false,
                message:
                    "Username atau NRP tidak ditemukan."
            });
        }

        const user = result.rows[0];

        const valid =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!valid) {
            return res.status(401).json({
                success: false,
                message:
                    "Kata sandi salah."
            });
        }

        const token =
            jwt.sign(
                {
                    id: user.id,
                    username: user.username,
                    role: user.role
                },
                JWT_SECRET,
                {
                    expiresIn: "1d"
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
                role: user.role
            }
        });

    } catch (err) {
        console.error("[LOGIN ERROR]", err);

        res.status(500).json({
            success: false,
            message:
                "Terjadi kesalahan server: " +
                err.message
        });
    }
});


/* =========================================
   AUTH MIDDLEWARE
========================================= */

function auth(req, res, next) {
    const header =
        req.headers.authorization || "";

    const token =
        header.startsWith("Bearer ")
            ? header.substring(7)
            : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Token tidak ditemukan."
        });
    }

    try {
        req.user =
            jwt.verify(token, JWT_SECRET);

        next();

    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Sesi login sudah tidak berlaku."
        });
    }
}


function adminOnly(req, res, next) {
    if (
        !req.user ||
        req.user.role !== "admin"
    ) {
        return res.status(403).json({
            success: false,
            message: "Akses khusus admin."
        });
    }

    next();
}


/* =========================================
   USER PROFILE
========================================= */

app.put(
    "/api/user/profile",
    auth,
    async (req, res) => {
        try {
            const {
                fullname,
                pangkat,
                nrp,
                password
            } = req.body;

            if (!fullname || !nrp) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Nama dan NRP wajib diisi."
                });
            }

            if (password) {
                const hash =
                    await bcrypt.hash(
                        password,
                        10
                    );

                await pool.query(
                    `
                    UPDATE users
                    SET fullname=$1,
                        pangkat=$2,
                        nrp=$3,
                        password=$4
                    WHERE id=$5
                    `,
                    [
                        fullname,
                        pangkat || "Prada",
                        nrp,
                        hash,
                        req.user.id
                    ]
                );
            } else {
                await pool.query(
                    `
                    UPDATE users
                    SET fullname=$1,
                        pangkat=$2,
                        nrp=$3
                    WHERE id=$4
                    `,
                    [
                        fullname,
                        pangkat || "Prada",
                        nrp,
                        req.user.id
                    ]
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        fullname,
                        pangkat,
                        nrp,
                        username,
                        role
                    FROM users
                    WHERE id=$1
                    `,
                    [req.user.id]
                );

            res.json({
                success: true,
                message:
                    "Profil berhasil diperbarui.",
                user: result.rows[0]
            });

        } catch (err) {
            console.error(
                "[PROFILE ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
);


/* =========================================
   ADMIN DATA
========================================= */

app.get(
    "/api/admin/data",
    auth,
    adminOnly,
    async (req, res) => {
        try {
            const users =
                await pool.query(`
                    SELECT
                        id,
                        fullname,
                        pangkat,
                        nrp,
                        username,
                        role,
                        created_at
                    FROM users
                    ORDER BY id ASC
                `);

            const bills =
                await pool.query(`
                    SELECT *
                    FROM bills
                    ORDER BY id DESC
                `);

            const payments =
                await pool.query(`
                    SELECT
                        p.id,
                        p.status,
                        p.paid_at,
                        b.description,
                        b.amount,
                        u.id AS user_id,
                        u.fullname,
                        u.pangkat,
                        u.nrp
                    FROM payments p
                    JOIN bills b
                        ON b.id = p.bill_id
                    JOIN users u
                        ON u.id = p.user_id
                    ORDER BY p.id DESC
                `);

            const config =
                await pool.query(`
                    SELECT *
                    FROM payment_config
                    WHERE id=1
                `);

            res.json({
                success: true,
                users: users.rows,
                bills: bills.rows,
                payments: payments.rows,
                paymentConfig:
                    config.rows[0] || null
            });

        } catch (err) {
            console.error(
                "[ADMIN DATA ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
);


/* =========================================
   ADMIN CREATE BILL
========================================= */

app.post(
    "/api/admin/bills",
    auth,
    adminOnly,
    async (req, res) => {
        try {
            const {
                description,
                amount
            } = req.body;

            if (
                !description ||
                !amount ||
                Number(amount) <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Keterangan dan nominal wajib valid."
                });
            }

            const bill =
                await pool.query(
                    `
                    INSERT INTO bills
                    (description, amount)
                    VALUES ($1,$2)
                    RETURNING *
                    `,
                    [
                        description.trim(),
                        Number(amount)
                    ]
                );

            const users =
                await pool.query(`
                    SELECT id
                    FROM users
                    WHERE role='member'
                `);

            for (const user of users.rows) {
                await pool.query(
                    `
                    INSERT INTO payments
                    (bill_id,user_id,status)
                    VALUES ($1,$2,'menunggak')
                    `,
                    [
                        bill.rows[0].id,
                        user.id
                    ]
                );
            }

            res.json({
                success: true,
                message:
                    "Iuran berhasil diterbitkan.",
                bill: bill.rows[0]
            });

        } catch (err) {
            console.error(
                "[CREATE BILL ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
);


/* =========================================
   ADMIN PAYMENT CONFIG
========================================= */

app.post(
    "/api/admin/payment-config",
    auth,
    adminOnly,
    async (req, res) => {
        try {
            const {
                bank_name,
                account_number,
                account_holder,
                qris_nmid,
                qris_payload
            } = req.body;

            await pool.query(
                `
                INSERT INTO payment_config
                (
                    id,
                    bank_name,
                    account_number,
                    account_holder,
                    qris_nmid,
                    qris_payload
                )
                VALUES
                (1,$1,$2,$3,$4,$5)
                ON CONFLICT (id)
                DO UPDATE SET
                    bank_name=EXCLUDED.bank_name,
                    account_number=EXCLUDED.account_number,
                    account_holder=EXCLUDED.account_holder,
                    qris_nmid=EXCLUDED.qris_nmid,
                    qris_payload=EXCLUDED.qris_payload
                `,
                [
                    bank_name || "",
                    account_number || "",
                    account_holder || "",
                    qris_nmid || "",
                    qris_payload || ""
                ]
            );

            res.json({
                success: true,
                message:
                    "Pengaturan pembayaran disimpan."
            });

        } catch (err) {
            console.error(
                "[PAYMENT CONFIG ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
);


/* =========================================
   ADMIN EDIT USER
========================================= */

app.put(
    "/api/admin/users/:id",
    auth,
    adminOnly,
    async (req, res) => {
        try {
            const id =
                Number(req.params.id);

            const {
                fullname,
                pangkat,
                nrp,
                role,
                password
            } = req.body;

            if (
                !fullname ||
                !nrp ||
                !role
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Data personel belum lengkap."
                });
            }

            if (password) {
                const hash =
                    await bcrypt.hash(
                        password,
                        10
                    );

                await pool.query(
                    `
                    UPDATE users
                    SET fullname=$1,
                        pangkat=$2,
                        nrp=$3,
                        role=$4,
                        password=$5
                    WHERE id=$6
                    `,
                    [
                        fullname,
                        pangkat,
                        nrp,
                        role,
                        hash,
                        id
                    ]
                );
            } else {
                await pool.query(
                    `
                    UPDATE users
                    SET fullname=$1,
                        pangkat=$2,
                        nrp=$3,
                        role=$4
                    WHERE id=$5
                    `,
                    [
                        fullname,
                        pangkat,
                        nrp,
                        role,
                        id
                    ]
                );
            }

            res.json({
                success: true,
                message:
                    "Data personel berhasil diperbarui."
            });

        } catch (err) {
            console.error(
                "[EDIT USER ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
);


/* =========================================
   DELETE USER
========================================= */

app.delete(
    "/api/admin/users/:id",
    auth,
    adminOnly,
    async (req, res) => {
        try {
            const id =
                Number(req.params.id);

            if (id === req.user.id) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Admin yang sedang login tidak dapat dihapus."
                });
            }

            await pool.query(
                "DELETE FROM users WHERE id=$1",
                [id]
            );

            res.json({
                success: true,
                message:
                    "Personel berhasil dihapus."
            });

        } catch (err) {
            console.error(
                "[DELETE USER ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
);


/* =========================================
   FALLBACK WEBSITE
========================================= */

app.get("*", (req, res) => {
    res.sendFile(
        path.join(
            process.cwd(),
            "public",
            "index.html"
        )
    );
});


/* =========================================
   VERCEL
========================================= */

module.exports = app;


/* =========================================
   HELPER
========================================= */

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
