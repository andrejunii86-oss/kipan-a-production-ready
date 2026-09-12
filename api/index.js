const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   ENVIRONMENT
========================================================= */

const DATABASE_URL = process.env.DATABASE_URL;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "CHANGE_THIS_JWT_SECRET_2026";

/* =========================================================
   DATABASE
========================================================= */

let pool = null;

if (DATABASE_URL) {
    pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        },
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    });

    pool.on("error", (err) => {
        console.error("[POSTGRES ERROR]", err);
    });
}

/* =========================================================
   STATIC WEBSITE
========================================================= */

app.use(
    express.static(
        path.join(process.cwd(), "public")
    )
);

app.use(
    express.static(
        path.join(__dirname, "../public")
    )
);

/* =========================================================
   DATABASE REQUIRED
========================================================= */

function requireDatabase(req, res, next) {
    if (!DATABASE_URL || !pool) {
        return res.status(503).json({
            success: false,
            message:
                "DATABASE_URL belum dikonfigurasi di Vercel."
        });
    }

    next();
}

/* =========================================================
   INITIALIZE DATABASE
========================================================= */

async function initDatabase() {
    if (!pool) {
        throw new Error(
            "DATABASE_URL belum dikonfigurasi."
        );
    }

    /*
     * USERS
     */
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            fullname VARCHAR(100) NOT NULL,
            pangkat VARCHAR(50) NOT NULL DEFAULT 'Prada',
            nrp VARCHAR(30) NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'member',
            created_at TIMESTAMP WITH TIME ZONE
                DEFAULT CURRENT_TIMESTAMP
        );
    `);

    /*
     * BILL / IURAN
     */
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bills (
            id SERIAL PRIMARY KEY,
            description VARCHAR(255) NOT NULL,
            amount NUMERIC(15,2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE
                DEFAULT CURRENT_TIMESTAMP
        );
    `);

    /*
     * PAYMENT
     *
     * status:
     * menunggak
     * menunggu_verifikasi
     * lunas
     */
    await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            bill_id INTEGER NOT NULL
                REFERENCES bills(id)
                ON DELETE CASCADE,
            user_id INTEGER NOT NULL
                REFERENCES users(id)
                ON DELETE CASCADE,
            status VARCHAR(30) NOT NULL
                DEFAULT 'menunggak',
            paid_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE
                DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (bill_id, user_id)
        );
    `);

    /*
     * PAYMENT CONFIG
     */
    await pool.query(`
        CREATE TABLE IF NOT EXISTS payment_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            bank_name VARCHAR(100) DEFAULT '',
            account_number VARCHAR(100) DEFAULT '',
            account_holder VARCHAR(150) DEFAULT '',
            qris_nmid VARCHAR(150) DEFAULT '',
            qris_payload TEXT DEFAULT ''
        );
    `);

    await pool.query(`
        INSERT INTO payment_config (
            id,
            bank_name,
            account_number,
            account_holder,
            qris_nmid,
            qris_payload
        )
        VALUES (
            1,
            '',
            '',
            '',
            '',
            ''
        )
        ON CONFLICT (id) DO NOTHING;
    `);

    /*
     * MIGRATION UNTUK DATABASE LAMA
     */
    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS nrp VARCHAR(30);
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(20)
        DEFAULT 'member';
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS created_at
        TIMESTAMP WITH TIME ZONE
        DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS paid_at
        TIMESTAMP WITH TIME ZONE;
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS created_at
        TIMESTAMP WITH TIME ZONE
        DEFAULT CURRENT_TIMESTAMP;
    `);
}

/* =========================================================
   AUTHENTICATION
========================================================= */

function getTokenFromRequest(req) {
    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    return header.substring(7);
}

function auth(req, res, next) {
    const token =
        getTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Sesi login tidak ditemukan."
        });
    }

    try {
        req.user =
            jwt.verify(
                token,
                JWT_SECRET
            );

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message:
                "Sesi login sudah tidak berlaku. Silakan login kembali."
        });
    }
}

/* =========================================================
   ADMIN CHECK
========================================================= */

async function adminOnly(req, res, next) {
    try {
        const result =
            await pool.query(
                `
                SELECT role
                FROM users
                WHERE id = $1
                `,
                [req.user.id]
            );

        if (
            !result.rows.length ||
            result.rows[0].role !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Akses hanya untuk Komando/Admin."
            });
        }

        next();

    } catch (err) {
        console.error(
            "[ADMIN CHECK ERROR]",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal memeriksa hak akses."
        });
    }
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
    "/api/health",
    async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({
                    success: false,
                    database: false,
                    message:
                        "DATABASE_URL belum diset."
                });
            }

            await pool.query("SELECT 1");

            res.json({
                success: true,
                database: true,
                message:
                    "API dan database aktif."
            });

        } catch (err) {
            console.error(
                "[HEALTH ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                database: false,
                message:
                    "Database gagal terhubung."
            });
        }
    }
);

/* =========================================================
   DATABASE SETUP / ADMIN
========================================================= */

app.get(
    "/api/setup-admin-darurat",
    requireDatabase,
    async (req, res) => {
        try {
            await initDatabase();

            const adminPassword =
                process.env.ADMIN_PASSWORD;

            if (!adminPassword) {
                return res.status(500).send(`
                    <div style="
                        font-family:Arial;
                        text-align:center;
                        margin-top:60px;
                    ">
                        <h2 style="color:red;">
                            ADMIN_PASSWORD BELUM DISET
                        </h2>

                        <p>
                            Tambahkan ADMIN_PASSWORD
                            di Vercel Environment Variables.
                        </p>
                    </div>
                `);
            }

            const passwordHash =
                await bcrypt.hash(
                    adminPassword,
                    12
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
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    'admin'
                )
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
                    <h1 style="color:green;">
                        ADMIN SIAP
                    </h1>

                    <p>
                        Username:
                        <b>admin</b>
                    </p>

                    <p>
                        Password mengikuti
                        <b>ADMIN_PASSWORD</b>
                        di Vercel.
                    </p>

                    <a href="/">
                        Kembali ke Markas
                    </a>
                </div>
            `);

        } catch (err) {
            console.error(
                "[SETUP ERROR]",
                err
            );

            res.status(500).send(`
                <h2 style="
                    color:red;
                    text-align:center;
                    margin-top:50px;
                ">
                    GAGAL SETUP DATABASE
                </h2>
                <p style="
                    text-align:center;
                    font-family:Arial;
                ">
                    Periksa DATABASE_URL.
                </p>
            `);
        }
    }
);

/* =========================================================
   REGISTER
========================================================= */

app.post(
    "/api/register",
    requireDatabase,
    async (req, res) => {
        try {
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
                        "Semua data pendaftaran wajib diisi."
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
                    WHERE
                        LOWER(username)
                        = LOWER($1)
                    OR
                        LOWER(nrp)
                        = LOWER($2)
                    LIMIT 1
                    `,
                    [
                        username.trim(),
                        nrp.trim()
                    ]
                );

            if (existing.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Username atau NRP sudah terdaftar."
                });
            }

            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );

            const result =
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
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        'member'
                    )
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
                        fullname.trim(),
                        pangkat || "Prada",
                        nrp.trim(),
                        username.trim(),
                        passwordHash
                    ]
                );

            res.json({
                success: true,
                message:
                    "Pendaftaran personel berhasil.",
                user: result.rows[0]
            });

        } catch (err) {
            console.error(
                "[REGISTER ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal mendaftarkan personel."
            });
        }
    }
);

/* =========================================================
   LOGIN
========================================================= */

app.post(
    "/api/login",
    requireDatabase,
    async (req, res) => {
        try {
            await initDatabase();

            const {
                username,
                password
            } = req.body;

            if (
                !username ||
                !password
            ) {
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
                    WHERE
                        LOWER(username)
                        = LOWER($1)
                    OR
                        LOWER(nrp)
                        = LOWER($1)
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

            const user =
                result.rows[0];

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!passwordMatch) {
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
                message:
                    "Login berhasil.",
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
            console.error(
                "[LOGIN ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Terjadi kesalahan server."
            });
        }
    }
);

/* =========================================================
   GET CURRENT USER
========================================================= */

app.get(
    "/api/user/profile",
    auth,
    requireDatabase,
    async (req, res) => {
        try {
            const result =
                await pool.query(
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

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Data prajurit tidak ditemukan."
                });
            }

            res.json({
                success: true,
                user: result.rows[0]
            });

        } catch (err) {
            console.error(
                "[PROFILE ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil profil."
            });
        }
    }
);

/* =========================================================
   UPDATE PROFILE
========================================================= */

app.put(
    "/api/user/profile",
    auth,
    requireDatabase,
    async (req, res) => {
        try {
            const {
                fullname,
                pangkat,
                nrp,
                password
            } = req.body;

            if (
                !fullname ||
                !nrp
            ) {
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
                        12
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
                        pangkat || "Prada",
                        nrp.trim(),
                        hash,
                        req.user.id
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
                        pangkat || "Prada",
                        nrp.trim(),
                        req.user.id
                    ]
                );
            }

            const updated =
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
                    WHERE id = $1
                    `,
                    [req.user.id]
                );

            res.json({
                success: true,
                message:
                    "Profil berhasil diperbarui.",
                user:
                    updated.rows[0]
            });

        } catch (err) {
            console.error(
                "[UPDATE PROFILE ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal memperbarui profil."
            });
        }
    }
);

/* =========================================================
   MEMBER DASHBOARD
========================================================= */

app.get(
    "/api/member/dashboard",
    auth,
    requireDatabase,
    async (req, res) => {
        try {
            const bills =
                await pool.query(
                    `
                    SELECT
                        p.id AS payment_id,
                        b.id AS bill_id,
                        b.description,
                        b.amount,
                        p.status,
                        p.paid_at,
                        p.created_at
                    FROM payments p
                    INNER JOIN bills b
                        ON b.id = p.bill_id
                    WHERE p.user_id = $1
                    ORDER BY
                        b.created_at DESC,
                        p.id DESC
                    `,
                    [req.user.id]
                );

            const config =
                await pool.query(
                    `
                    SELECT *
                    FROM payment_config
                    WHERE id = 1
                    `
                );

            res.json({
                success: true,
                bills: bills.rows,
                paymentConfig:
                    config.rows[0] || null
            });

        } catch (err) {
            console.error(
                "[MEMBER DASHBOARD ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil tagihan."
            });
        }
    }
);

/* =========================================================
   MEMBER REQUEST PAYMENT
========================================================= */

app.post(
    "/api/member/payments/:paymentId/request",
    auth,
    requireDatabase,
    async (req, res) => {
        try {
            const paymentId =
                Number(req.params.paymentId);

            if (!Number.isInteger(paymentId)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "ID pembayaran tidak valid."
                });
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        p.id,
                        p.user_id,
                        p.status
                    FROM payments p
                    WHERE p.id = $1
                    `,
                    [paymentId]
                );

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Tagihan tidak ditemukan."
                });
            }

            const payment =
                result.rows[0];

            if (
                Number(payment.user_id) !==
                Number(req.user.id)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Tagihan bukan milik akun ini."
                });
            }

            if (payment.status === "lunas") {
                return res.status(400).json({
                    success: false,
                    message:
                        "Tagihan sudah lunas."
                });
            }

            await pool.query(
                `
                UPDATE payments
                SET status = 'menunggu_verifikasi'
                WHERE id = $1
                `,
                [paymentId]
            );

            res.json({
                success: true,
                message:
                    "Pembayaran dikirim dan menunggu verifikasi Komando."
            });

        } catch (err) {
            console.error(
                "[PAYMENT REQUEST ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal mengirim pembayaran."
            });
        }
    }
);

/* =========================================================
   ADMIN DATA
========================================================= */

app.get(
    "/api/admin/data",
    auth,
    requireDatabase,
    adminOnly,
    async (req, res) => {
        try {

            /*
             * SELURUH MEMBER
             */
            const users =
                await pool.query(
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
                    ORDER BY
                        CASE
                            WHEN role = 'admin'
                            THEN 0
                            ELSE 1
                        END,
                        id ASC
                    `
                );

            /*
             * SEMUA TAGIHAN + USER
             */
            const payments =
                await pool.query(
                    `
                    SELECT
                        p.id,
                        p.user_id,
                        p.bill_id,
                        p.status,
                        p.paid_at,
                        p.created_at,
                        b.description,
                        b.amount,
                        u.fullname,
                        u.pangkat,
                        u.nrp,
                        u.username
                    FROM payments p
                    INNER JOIN bills b
                        ON b.id = p.bill_id
                    INNER JOIN users u
                        ON u.id = p.user_id
                    ORDER BY
                        p.id DESC
                    `
                );

            /*
             * SEMUA BILL
             */
            const bills =
                await pool.query(
                    `
                    SELECT
                        id,
                        description,
                        amount,
                        created_at
                    FROM bills
                    ORDER BY id DESC
                    `
                );

            /*
             * CONFIG
             */
            const config =
                await pool.query(
                    `
                    SELECT *
                    FROM payment_config
                    WHERE id = 1
                    `
                );

            /*
             * TOTAL MEMBER
             *
             * Admin tidak dihitung.
             */
            const memberCount =
                await pool.query(
                    `
                    SELECT COUNT(*)::INTEGER AS total
                    FROM users
                    WHERE role = 'member'
                    `
                );

            /*
             * TOTAL LUNAS
             */
            const lunasCount =
                await pool.query(
                    `
                    SELECT COUNT(*)::INTEGER AS total
                    FROM payments
                    WHERE status = 'lunas'
                    `
                );

            /*
             * TOTAL MENUNGGAK
             *
             * Termasuk yang belum bayar.
             */
            const menunggakCount =
                await pool.query(
                    `
                    SELECT COUNT(*)::INTEGER AS total
                    FROM payments
                    WHERE status = 'menunggak'
                    `
                );

            /*
             * TOTAL KAS
             */
            const kas =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(b.amount),
                            0
                        ) AS total
                    FROM payments p
                    INNER JOIN bills b
                        ON b.id = p.bill_id
                    WHERE p.status = 'lunas'
                    `
                );

            res.json({
                success: true,

                users: users.rows,

                bills: bills.rows,

                payments:
                    payments.rows,

                paymentConfig:
                    config.rows[0] || null,

                stats: {
                    totalMembers:
                        Number(
                            memberCount
                                .rows[0]
                                .total
                        ),

                    totalLunas:
                        Number(
                            lunasCount
                                .rows[0]
                                .total
                        ),

                    totalMenunggak:
                        Number(
                            menunggakCount
                                .rows[0]
                                .total
                        ),

                    totalKas:
                        Number(
                            kas
                                .rows[0]
                                .total
                        )
                }
            });

        } catch (err) {
            console.error(
                "[ADMIN DATA ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil data panel Komando."
            });
        }
    }
);

/* =========================================================
   ADMIN CREATE BILL
========================================================= */

app.post(
    "/api/admin/bills",
    auth,
    requireDatabase,
    adminOnly,
    async (req, res) => {
        const client =
            await pool.connect();

        try {
            const {
                description,
                amount
            } = req.body;

            if (
                !description ||
                !amount
            ) {
                client.release();

                return res.status(400).json({
                    success: false,
                    message:
                        "Nama iuran dan nominal wajib diisi."
                });
            }

            const numericAmount =
                Number(amount);

            if (
                !Number.isFinite(
                    numericAmount
                ) ||
                numericAmount <= 0
            ) {
                client.release();

                return res.status(400).json({
                    success: false,
                    message:
                        "Nominal iuran tidak valid."
                });
            }

            await client.query(
                "BEGIN"
            );

            /*
             * BUAT IURAN
             */
            const billResult =
                await client.query(
                    `
                    INSERT INTO bills
                    (
                        description,
                        amount
                    )
                    VALUES
                    (
                        $1,
                        $2
                    )
                    RETURNING *
                    `,
                    [
                        description.trim(),
                        numericAmount
                    ]
                );

            const bill =
                billResult.rows[0];

            /*
             * AMBIL SEMUA MEMBER
             */
            const members =
                await client.query(
                    `
                    SELECT id
                    FROM users
                    WHERE role = 'member'
                    `
                );

            /*
             * BUAT TAGIHAN UNTUK SEMUA MEMBER
             */
            for (
                const member
                of members.rows
            ) {
                await client.query(
                    `
                    INSERT INTO payments
                    (
                        bill_id,
                        user_id,
                        status
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        'menunggak'
                    )
                    ON CONFLICT
                    (
                        bill_id,
                        user_id
                    )
                    DO NOTHING
                    `,
                    [
                        bill.id,
                        member.id
                    ]
                );
            }

            await client.query(
                "COMMIT"
            );

            res.json({
                success: true,
                message:
                    `Iuran berhasil diterbitkan kepada ${members.rows.length} member.`,
                bill: bill,
                affectedMembers:
                    members.rows.length
            });

        } catch (err) {

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (_) {}

            console.error(
                "[CREATE BILL ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal menerbitkan iuran."
            });

        } finally {
            client.release();
        }
    }
);

/* =========================================================
   ADMIN VERIFY PAYMENT
========================================================= */

app.put(
    "/api/admin/payments/:paymentId/verify",
    auth,
    requireDatabase,
    adminOnly,
    async (req, res) => {
        try {
            const paymentId =
                Number(req.params.paymentId);

            if (!Number.isInteger(paymentId)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "ID pembayaran tidak valid."
                });
            }

            const result =
                await pool.query(
                    `
                    UPDATE payments
                    SET
                        status = 'lunas',
                        paid_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
                    `,
                    [paymentId]
                );

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Pembayaran tidak ditemukan."
                });
            }

            res.json({
                success: true,
                message:
                    "Pembayaran berhasil diverifikasi sebagai LUNAS."
            });

        } catch (err) {
            console.error(
                "[VERIFY PAYMENT ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal memverifikasi pembayaran."
            });
        }
    }
);

/* =========================================================
   ADMIN RESET PAYMENT TO UNPAID
========================================================= */

app.put(
    "/api/admin/payments/:paymentId/unpaid",
    auth,
    requireDatabase,
    adminOnly,
    async (req, res) => {
        try {
            const paymentId =
                Number(req.params.paymentId);

            const result =
                await pool.query(
                    `
                    UPDATE payments
                    SET
                        status = 'menunggak',
                        paid_at = NULL
                    WHERE id = $1
                    RETURNING *
                    `,
                    [paymentId]
                );

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Pembayaran tidak ditemukan."
                });
            }

            res.json({
                success: true,
                message:
                    "Status pembayaran dikembalikan menjadi MENUNGGAK."
            });

        } catch (err) {
            console.error(
                "[UNPAID ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal mengubah status."
            });
        }
    }
);

/* =========================================================
   ADMIN PAYMENT CONFIG
========================================================= */

app.post(
    "/api/admin/payment-config",
    auth,
    requireDatabase,
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
                (
                    1,
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                ON CONFLICT (id)
                DO UPDATE SET
                    bank_name =
                        EXCLUDED.bank_name,
                    account_number =
                        EXCLUDED.account_number,
                    account_holder =
                        EXCLUDED.account_holder,
                    qris_nmid =
                        EXCLUDED.qris_nmid,
                    qris_payload =
                        EXCLUDED.qris_payload
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
                    "Pengaturan rekening & QRIS berhasil disimpan."
            });

        } catch (err) {
            console.error(
                "[PAYMENT CONFIG ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Gagal menyimpan pengaturan pembayaran."
            });
        }
    }
);

/* =========================================================
   ADMIN EDIT USER
========================================================= */

app.put(
    "/api/admin/users/:id",
    auth,
    requireDatabase,
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
                !Number.isInteger(id) ||
                !fullname ||
                !nrp ||
                !role
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Data personel tidak lengkap."
                });
            }

            /*
             * Jangan izinkan admin menghapus
             * akses dirinya sendiri secara tidak sengaja.
             */
            if (
                id === req.user.id &&
                role !== "admin"
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Akun admin yang sedang digunakan tidak dapat diturunkan menjadi member."
                });
            }

            if (password) {

                const hash =
                    await bcrypt.hash(
                        password,
                        12
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
                        pangkat || "Prada",
                        nrp.trim(),
                        role,
                        hash,
                        id
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
                        pangkat || "Prada",
                        nrp.trim(),
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
                message:
                    "Gagal memperbarui data personel."
            });
        }
    }
);

/* =========================================================
   ADMIN DELETE USER
========================================================= */

app.delete(
    "/api/admin/users/:id",
    auth,
    requireDatabase,
    adminOnly,
    async (req, res) => {
        try {
            const id =
                Number(req.params.id);

            if (
                id === req.user.id
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Akun admin yang sedang login tidak dapat dihapus."
                });
            }

            const result =
                await pool.query(
                    `
                    DELETE FROM users
                    WHERE id = $1
                    RETURNING id
                    `,
                    [id]
                );

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Personel tidak ditemukan."
                });
            }

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
                message:
                    "Gagal menghapus personel."
            });
        }
    }
);

/* =========================================================
   API 404
========================================================= */

app.use(
    "/api",
    (req, res) => {
        res.status(404).json({
            success: false,
            message:
                "Endpoint API tidak ditemukan."
        });
    }
);

/* =========================================================
   WEBSITE FALLBACK
========================================================= */

app.get(
    "*",
    (req, res) => {
        res.sendFile(
            path.join(
                process.cwd(),
                "public",
                "index.html"
            )
        );
    }
);

/* =========================================================
   EXPORT FOR VERCEL
========================================================= */

module.exports = app;
