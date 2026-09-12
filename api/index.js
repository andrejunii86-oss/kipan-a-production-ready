const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn("[WARNING] DATABASE_URL belum diatur.");
}

const pool = new Pool({
    connectionString:
        connectionString ||
        "postgresql://unconfigured:unconfigured@localhost:5432/unconfigured",
    ssl: {
        rejectUnauthorized: false,
    },
});

const JWT_SECRET =
    process.env.JWT_SECRET || "kipan_a_tni_ad_super_secret_key_2026";

/* =========================================================
   STATIC FILE
========================================================= */

app.use(express.static(path.join(process.cwd(), "public")));

if (__dirname) {
    app.use(express.static(path.join(__dirname, "../public")));
}

/* =========================================================
   HELPER
========================================================= */

function sendError(res, status, message) {
    return res.status(status).json({
        success: false,
        message,
    });
}

function getTokenFromRequest(req) {
    const auth = req.headers.authorization || "";

    if (auth.startsWith("Bearer ")) {
        return auth.substring(7);
    }

    return null;
}

function authRequired(req, res, next) {
    try {
        const token = getTokenFromRequest(req);

        if (!token) {
            return sendError(res, 401, "Sesi login tidak ditemukan.");
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded;

        next();
    } catch (err) {
        console.error("[AUTH ERROR]", err.message);

        return sendError(
            res,
            401,
            "Sesi login tidak valid atau sudah kedaluwarsa."
        );
    }
}

function adminRequired(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return sendError(res, 403, "Akses khusus Komando/Admin.");
    }

    next();
}

function rupiah(value) {
    return new Intl.NumberFormat("id-ID").format(Number(value || 0));
}

/* =========================================================
   DATABASE INITIALIZATION / MIGRATION
========================================================= */

async function ensureDatabase() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL belum tersedia.");
    }

    /*
     * USERS
     */
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            fullname VARCHAR(100) NOT NULL,
            pangkat VARCHAR(50) NOT NULL DEFAULT 'Prada',
            nrp VARCHAR(30) DEFAULT '-',
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'member',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS fullname VARCHAR(100);
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS pangkat VARCHAR(50) DEFAULT 'Prada';
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS nrp VARCHAR(30) DEFAULT '-';
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS username VARCHAR(50);
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password VARCHAR(255);
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member';
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS created_at
        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    /*
     * BILLS
     */
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bills (
            id SERIAL PRIMARY KEY,
            description TEXT NOT NULL,
            amount NUMERIC(14,2) NOT NULL DEFAULT 0,
            created_by INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE bills
        ADD COLUMN IF NOT EXISTS description TEXT;
    `);

    await pool.query(`
        ALTER TABLE bills
        ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2) DEFAULT 0;
    `);

    await pool.query(`
        ALTER TABLE bills
        ADD COLUMN IF NOT EXISTS created_by INTEGER;
    `);

    await pool.query(`
        ALTER TABLE bills
        ADD COLUMN IF NOT EXISTS created_at
        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    /*
     * PAYMENTS
     *
     * Ini bagian penting untuk memperbaiki:
     *
     * column p.bill_id does not exist
     */
    await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            bill_id INTEGER,
            user_id INTEGER,
            amount  NUMERIC(14,2) DEFAULT 0,
            keterangan TEXT DEFAULT '',
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            payment_method VARCHAR(50) DEFAULT 'bank_transfer',
            paid_at TIMESTAMP WITH TIME ZONE,
            verified_at TIMESTAMP WITH TIME ZONE,
            verified_by INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS bill_id INTEGER;
    `);
    await pool.query(`
    ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS keterangan TEXT DEFAULT '';
`);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS user_id INTEGER;
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2) DEFAULT 0;
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending';
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)
        DEFAULT 'bank_transfer';
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS paid_at
        TIMESTAMP WITH TIME ZONE;
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS verified_at
        TIMESTAMP WITH TIME ZONE;
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS verified_by INTEGER;
    `);

    await pool.query(`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS created_at
        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
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
            qris_nmid VARCHAR(100) DEFAULT '',
            qris_payload TEXT DEFAULT '',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    /*
     * INDEX
     */
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_username
        ON users(username);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_nrp
        ON users(nrp);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_payments_bill_id
        ON payments(bill_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_payments_user_id
        ON payments(user_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_payments_status
        ON payments(status);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_bills_created_at
        ON bills(created_at);
    `);

    /*
     * DEFAULT PAYMENT CONFIG
     */
    await pool.query(`
        INSERT INTO payment_config (
            id,
            bank_name,
            account_number,
            account_holder,
            qris_nmid,
            qris_payload
        )
        VALUES (1, '', '', '', '', '')
        ON CONFLICT (id) DO NOTHING;
    `);

    console.log("[DATABASE] Database siap.");
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", async (req, res) => {
    try {
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
   DATABASE SETUP
========================================================= */

app.get("/api/setup-admin-darurat", async (req, res) => {
    try {
        await ensureDatabase();

        const adminHash = await bcrypt.hash("admin123", 10);

        const existingAdmin = await pool.query(`
            SELECT id
            FROM users
            WHERE LOWER(username) = 'admin'
            LIMIT 1
        `);

        if (existingAdmin.rows.length === 0) {
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
                VALUES ($1,$2,$3,$4,$5,'admin')
                `,
                [
                    "Komandan Kompi A (Danki)",
                    "Kapten Inf",
                    "11030012345",
                    "admin",
                    adminHash,
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
                    password = $4,
                    role = 'admin'
                WHERE LOWER(username) = 'admin'
                `,
                [
                    "Komandan Kompi A (Danki)",
                    "Kapten Inf",
                    "11030012345",
                    adminHash,
                ]
            );
        }

        res.send(`
            <div style="
                font-family:Arial;
                text-align:center;
                margin-top:60px;
                background:#07120d;
                color:#fff;
                min-height:300px;
                padding:40px;
            ">
                <h1 style="color:#b5c86a;">DATABASE SIAP</h1>
                <p>Admin berhasil disiapkan.</p>
                <p>Username: <b>admin</b></p>
                <p>Password: <b>admin123</b></p>
                <br>
                <a href="/" style="color:#b5c86a;">KEMBALI KE MARKAS</a>
            </div>
        `);
    } catch (err) {
        console.error("[SETUP ERROR]", err);

        res.status(500).send(`
            <h2 style="color:red;text-align:center;margin-top:50px;">
                GAGAL SETUP DATABASE
            </h2>
            <p style="text-align:center;">${err.message}</p>
        `);
    }
});

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/login", async (req, res) => {
    try {
        await ensureDatabase();

        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");

        if (!username || !password) {
            return sendError(
                res,
                400,
                "Username/NRP dan kata sandi wajib diisi."
            );
        }

        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE LOWER(username) = LOWER($1)
               OR LOWER(nrp) = LOWER($1)
            LIMIT 1
            `,
            [username]
        );

        if (result.rows.length === 0) {
            return sendError(
                res,
                400,
                "Pengguna atau NRP tidak ditemukan."
            );
        }

        const user = result.rows[0];

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return sendError(res, 400, "Kata sandi salah.");
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
            },
            JWT_SECRET,
            {
                expiresIn: "1d",
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
   REGISTER
========================================================= */

app.post("/api/register", async (req, res) => {
    try {
        await ensureDatabase();

        const fullname = String(req.body.fullname || "").trim();
        const pangkat = String(req.body.pangkat || "Prada").trim();
        const nrp = String(req.body.nrp || "").trim();
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");

        if (!fullname || !nrp || !username || !password) {
            return sendError(
                res,
                400,
                "Semua kolom wajib diisi."
            );
        }

        const existing = await pool.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(username) = LOWER($1)
               OR LOWER(nrp) = LOWER($2)
            LIMIT 1
            `,
            [username, nrp]
        );

        if (existing.rows.length > 0) {
            return sendError(
                res,
                400,
                "Username atau NRP sudah terdaftar."
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const inserted = await pool.query(
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
            VALUES ($1,$2,$3,$4,$5,'member')
            RETURNING id
            `,
            [
                fullname,
                pangkat,
                nrp,
                username,
                hashedPassword,
            ]
        );

        /*
         * Jika sudah ada tagihan yang diterbitkan sebelumnya,
         * otomatis buat record pembayaran untuk member baru.
         */
        const newUserId = inserted.rows[0].id;

        await pool.query(
            `
            INSERT INTO payments
            (
                bill_id,
                user_id,
                amount,
                status
            )
            SELECT
                b.id,
                $1,
                b.amount,
                'pending'
            FROM bills b
            WHERE NOT EXISTS (
                SELECT 1
                FROM payments p
                WHERE p.bill_id = b.id
                  AND p.user_id = $1
            )
            `,
            [newUserId]
        );

        res.json({
            success: true,
            message:
                "Pendaftaran personel berhasil! Silakan login.",
        });
    } catch (err) {
        console.error("[REGISTER ERROR]", err);

        res.status(500).json({
            success: false,
            message: "Terjadi kesalahan server: " + err.message,
        });
    }
});

/* =========================================================
   GET CURRENT USER
========================================================= */

app.get(
    "/api/me",
    authRequired,
    async (req, res) => {
        try {
            const result = await pool.query(
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

            if (result.rows.length === 0) {
                return sendError(
                    res,
                    404,
                    "Data personel tidak ditemukan."
                );
            }

            res.json({
                success: true,
                user: result.rows[0],
            });
        } catch (err) {
            console.error("[ME ERROR]", err);

            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);

/* =========================================================
   MEMBER DASHBOARD
========================================================= */

app.get(
    "/api/member/data",
    authRequired,
    async (req, res) => {
        try {
            /*
             * Sinkronisasi tagihan:
             * setiap bill harus memiliki record payment
             * untuk setiap member.
             */
            await pool.query(
                `
                INSERT INTO payments
                (
                    bill_id,
                    user_id,
                    amount,
                    status
                )
                SELECT
                    b.id,
                    u.id,
                    b.amount,
                    'pending'
                FROM bills b
                CROSS JOIN users u
                WHERE u.role = 'member'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM payments p
                      WHERE p.bill_id = b.id
                        AND p.user_id = u.id
                  )
                `
            );

            const userResult = await pool.query(
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

            const bills = await pool.query(
                `
                SELECT
                    p.id AS payment_id,
                    b.id AS bill_id,
                    b.description,
                    b.amount,
                    p.status,
                    p.payment_method,
                    p.paid_at,
                    p.verified_at,
                    b.created_at
                FROM payments p
                INNER JOIN bills b
                    ON b.id = p.bill_id
                WHERE p.user_id = $1
                ORDER BY b.created_at DESC, b.id DESC
                `,
                [req.user.id]
            );

            const config = await pool.query(`
                SELECT *
                FROM payment_config
                WHERE id = 1
                LIMIT 1
            `);

            res.json({
                success: true,
                user: userResult.rows[0] || null,
                bills: bills.rows,
                paymentConfig: config.rows[0] || null,
            });
        } catch (err) {
            console.error("[MEMBER DATA ERROR]", err);

            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);

/* =========================================================
   MEMBER PAY BILL
========================================================= */

app.post(
    "/api/member/pay",
    authRequired,
    async (req, res) => {
        try {
            const billId = Number(req.body.bill_id);

            if (!billId) {
                return sendError(
                    res,
                    400,
                    "ID tagihan tidak valid."
                );
            }

            const bill = await pool.query(
                `
                SELECT id, amount, description
                FROM bills
                WHERE id = $1
                LIMIT 1
                `,
                [billId]
            );

            if (bill.rows.length === 0) {
                return sendError(
                    res,
                    404,
                    "Tagihan tidak ditemukan."
                );
            }

            const existing = await pool.query(
                `
                SELECT *
                FROM payments
                WHERE bill_id = $1
                  AND user_id = $2
                ORDER BY id DESC
                LIMIT 1
                `,
                [billId, req.user.id]
            );

            if (existing.rows.length === 0) {
                await pool.query(
                    `
                    INSERT INTO payments
                    (
                        bill_id,
                        user_id,
                        amount,
                        status,
                        payment_method,
                        paid_at
                    )
                    VALUES ($1,$2,$3,'pending','bank_transfer',CURRENT_TIMESTAMP)
                    `,
                    [
                        billId,
                        req.user.id,
                        bill.rows[0].amount,
                    ]
                );
            } else {
                const payment = existing.rows[0];

                if (payment.status === "paid") {
                    return sendError(
                        res,
                        400,
                        "Tagihan ini sudah lunas."
                    );
                }

                await pool.query(
                    `
                    UPDATE payments
                    SET
                        amount = $1,
                        status = 'pending',
                        payment_method = 'bank_transfer',
                        paid_at = CURRENT_TIMESTAMP,
                        verified_at = NULL,
                        verified_by = NULL
                    WHERE id = $2
                    `,
                    [
                        bill.rows[0].amount,
                        payment.id,
                    ]
                );
            }

            res.json({
                success: true,
                message:
                    "Pembayaran dicatat dan menunggu verifikasi Komando.",
            });
        } catch (err) {
            console.error("[MEMBER PAY ERROR]", err);

            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);

/* =========================================================
   ADMIN DATA
========================================================= */

app.get(
    "/api/admin/data",
    authRequired,
    adminRequired,
    async (req, res) => {
        try {
            /*
             * Sinkronisasi semua tagihan ke semua member.
             */
            await pool.query(`
                INSERT INTO payments
                (
                    bill_id,
                    user_id,
                    amount,
                    status
                )
                SELECT
                    b.id,
                    u.id,
                    b.amount,
                    'pending'
                FROM bills b
                CROSS JOIN users u
                WHERE u.role = 'member'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM payments p
                      WHERE p.bill_id = b.id
                        AND p.user_id = u.id
                  )
            `);

            const users = await pool.query(`
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
                    CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
                    id ASC
            `);

            const bills = await pool.query(`
                SELECT
                    b.id,
                    b.description,
                    b.amount,
                    b.created_at,
                    COUNT(
                        CASE
                            WHEN p.status = 'paid'
                            THEN 1
                        END
                    ) AS paid_count,
                    COUNT(
                        CASE
                            WHEN p.status <> 'paid'
                            THEN 1
                        END
                    ) AS unpaid_count
                FROM bills b
                LEFT JOIN payments p
                    ON p.bill_id = b.id
                GROUP BY
                    b.id,
                    b.description,
                    b.amount,
                    b.created_at
                ORDER BY
                    b.created_at DESC,
                    b.id DESC
            `);

            /*
             * Semua pembayaran yang belum lunas.
             */
            const unpaid = await pool.query(`
                SELECT
                    p.id AS payment_id,
                    b.id AS bill_id,
                    u.id AS user_id,
                    u.fullname,
                    u.pangkat,
                    u.nrp,
                    b.description,
                    b.amount,
                    p.status,
                    p.paid_at,
                    p.created_at
                FROM payments p
                INNER JOIN users u
                    ON u.id = p.user_id
                INNER JOIN bills b
                    ON b.id = p.bill_id
                WHERE p.status <> 'paid'
                ORDER BY
                    b.created_at DESC,
                    u.fullname ASC
            `);

            /*
             * Semua pembayaran lunas.
             */
            const paid = await pool.query(`
                SELECT
                    p.id AS payment_id,
                    b.id AS bill_id,
                    u.id AS user_id,
                    u.fullname,
                    u.pangkat,
                    u.nrp,
                    b.description,
                    b.amount,
                    p.status,
                    p.paid_at,
                    p.verified_at
                FROM payments p
                INNER JOIN users u
                    ON u.id = p.user_id
                INNER JOIN bills b
                    ON b.id = p.bill_id
                WHERE p.status = 'paid'
                ORDER BY
                    p.verified_at DESC NULLS LAST,
                    u.fullname ASC
            `);

            const config = await pool.query(`
                SELECT *
                FROM payment_config
                WHERE id = 1
                LIMIT 1
            `);

            const stats = await pool.query(`
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM users
                        WHERE role = 'member'
                    ) AS total_members,

                    (
                        SELECT COUNT(*)
                        FROM payments
                        WHERE status = 'paid'
                    ) AS total_lunas,

                    (
                        SELECT COUNT(*)
                        FROM payments
                        WHERE status <> 'paid'
                    ) AS total_menunggak,

                    (
                        SELECT COALESCE(SUM(amount),0)
                        FROM payments
                        WHERE status = 'paid'
                    ) AS total_kas
            `);

            res.json({
                success: true,

                stats: {
                    totalMembers:
                        Number(
                            stats.rows[0].total_members || 0
                        ),

                    totalLunas:
                        Number(
                            stats.rows[0].total_lunas || 0
                        ),

                    totalMenunggak:
                        Number(
                            stats.rows[0].total_menunggak || 0
                        ),

                    totalKas:
                        Number(
                            stats.rows[0].total_kas || 0
                        ),
                },

                users: users.rows,
                bills: bills.rows,
                unpaid: unpaid.rows,
                paid: paid.rows,

                paymentConfig:
                    config.rows[0] || null,
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
   ADMIN CREATE MASS BILL
========================================================= */

app.post(
    "/api/admin/create-bill",
    authRequired,
    adminRequired,
    async (req, res) => {
        const client = await pool.connect();

        try {
            const description = String(
                req.body.description || ""
            ).trim();

            const amount = Number(req.body.amount);

            if (!description) {
                return sendError(
                    res,
                    400,
                    "Nama/keterangan iuran wajib diisi."
                );
            }

            if (!Number.isFinite(amount) || amount <= 0) {
                return sendError(
                    res,
                    400,
                    "Nominal iuran tidak valid."
                );
            }

            await client.query("BEGIN");

            const billResult = await client.query(
                `
                INSERT INTO bills
                (
                    description,
                    amount,
                    created_by
                )
                VALUES ($1,$2,$3)
                RETURNING id, description, amount, created_at
                `,
                [
                    description,
                    amount,
                    req.user.id,
                ]
            );

            const bill = billResult.rows[0];

            /*
             * MASSAL:
             * Buat tagihan untuk seluruh member.
             */
            await client.query(
                `
                INSERT INTO payments
(
    bill_id,
    user_id,
    amount,
    keterangan,
    status
)
SELECT
    $1,
    id,
    $2,
    $3,
    'pending'
FROM users
WHERE role = 'member'
                `,
                [
    bill.id,
    amount,
    description,
]
            );

            await client.query("COMMIT");

            res.json({
                success: true,
                message:
                    "Iuran berhasil diterbitkan ke seluruh anggota.",
                bill,
            });
        } catch (err) {
            await client.query("ROLLBACK");

            console.error(
                "[CREATE BILL ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message,
            });
        } finally {
            client.release();
        }
    }
);

/* =========================================================
   ADMIN VERIFY PAYMENT
========================================================= */

app.post(
    "/api/admin/verify-payment",
    authRequired,
    adminRequired,
    async (req, res) => {
        try {
            const paymentId = Number(
                req.body.payment_id
            );

            if (!paymentId) {
                return sendError(
                    res,
                    400,
                    "ID pembayaran tidak valid."
                );
            }

            const result = await pool.query(
                `
                UPDATE payments
                SET
                    status = 'paid',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $1
                WHERE id = $2
                RETURNING *
                `,
                [
                    req.user.id,
                    paymentId,
                ]
            );

            if (result.rows.length === 0) {
                return sendError(
                    res,
                    404,
                    "Data pembayaran tidak ditemukan."
                );
            }

            res.json({
                success: true,
                message:
                    "Pembayaran berhasil diverifikasi sebagai LUNAS.",
                payment: result.rows[0],
            });
        } catch (err) {
            console.error(
                "[VERIFY PAYMENT ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);

/* =========================================================
   ADMIN PAYMENT CONFIG
========================================================= */

app.post(
    "/api/admin/payment-config",
    authRequired,
    adminRequired,
    async (req, res) => {
        try {
            const bankName = String(
                req.body.bank_name || ""
            ).trim();

            const accountNumber = String(
                req.body.account_number || ""
            ).trim();

            const accountHolder = String(
                req.body.account_holder || ""
            ).trim();

            const qrisNmid = String(
                req.body.qris_nmid || ""
            ).trim();

            const qrisPayload = String(
                req.body.qris_payload || ""
            ).trim();

            await pool.query(
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
                (1,$1,$2,$3,$4,$5,CURRENT_TIMESTAMP)
                ON CONFLICT (id)
                DO UPDATE SET
                    bank_name = EXCLUDED.bank_name,
                    account_number = EXCLUDED.account_number,
                    account_holder = EXCLUDED.account_holder,
                    qris_nmid = EXCLUDED.qris_nmid,
                    qris_payload = EXCLUDED.qris_payload,
                    updated_at = CURRENT_TIMESTAMP
                `,
                [
                    bankName,
                    accountNumber,
                    accountHolder,
                    qrisNmid,
                    qrisPayload,
                ]
            );

            res.json({
                success: true,
                message:
                    "Pengaturan rekening dan QRIS berhasil disimpan.",
            });
        } catch (err) {
            console.error(
                "[PAYMENT CONFIG ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);

/* =========================================================
   UPDATE OWN ACCOUNT
========================================================= */

app.put(
    "/api/settings",
    authRequired,
    async (req, res) => {
        try {
            const fullname = String(
                req.body.fullname || ""
            ).trim();

            const pangkat = String(
                req.body.pangkat || "Prada"
            ).trim();

            const nrp = String(
                req.body.nrp || ""
            ).trim();

            const password = String(
                req.body.password || ""
            );

            if (!fullname || !nrp) {
                return sendError(
                    res,
                    400,
                    "Nama dan NRP wajib diisi."
                );
            }

            const duplicate = await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(nrp) = LOWER($1)
                  AND id <> $2
                LIMIT 1
                `,
                [
                    nrp,
                    req.user.id,
                ]
            );

            if (duplicate.rows.length > 0) {
                return sendError(
                    res,
                    400,
                    "NRP sudah digunakan oleh personel lain."
                );
            }

            if (password) {
                const hashed = await bcrypt.hash(
                    password,
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
                        fullname,
                        pangkat,
                        nrp,
                        hashed,
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
                        fullname,
                        pangkat,
                        nrp,
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
                    "Profil berhasil diperbarui.",
                user: updated.rows[0],
            });
        } catch (err) {
            console.error(
                "[SETTINGS ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);

/* =========================================================
   ADMIN EDIT USER
========================================================= */

app.put(
    "/api/admin/user",
    authRequired,
    adminRequired,
    async (req, res) => {
        try {
            const userId = Number(
                req.body.id
            );

            const fullname = String(
                req.body.fullname || ""
            ).trim();

            const pangkat = String(
                req.body.pangkat || "Prada"
            ).trim();

            const nrp = String(
                req.body.nrp || ""
            ).trim();

            const role =
                req.body.role === "admin"
                    ? "admin"
                    : "member";

            const password = String(
                req.body.password || ""
            );

            if (!userId || !fullname || !nrp) {
                return sendError(
                    res,
                    400,
                    "Data personel belum lengkap."
                );
            }

            const duplicate = await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(nrp) = LOWER($1)
                  AND id <> $2
                LIMIT 1
                `,
                [
                    nrp,
                    userId,
                ]
            );

            if (duplicate.rows.length > 0) {
                return sendError(
                    res,
                    400,
                    "NRP sudah digunakan."
                );
            }

            if (password) {
                const hashed = await bcrypt.hash(
                    password,
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
                        fullname,
                        pangkat,
                        nrp,
                        role,
                        hashed,
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
                        fullname,
                        pangkat,
                        nrp,
                        role,
                        userId,
                    ]
                );
            }

            res.json({
                success: true,
                message:
                    "Data personel berhasil diperbarui.",
            });
        } catch (err) {
            console.error(
                "[ADMIN EDIT USER ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);

/* =========================================================
   DELETE USER
========================================================= */

app.delete(
    "/api/admin/user/:id",
    authRequired,
    adminRequired,
    async (req, res) => {
        try {
            const userId = Number(
                req.params.id
            );

            if (!userId) {
                return sendError(
                    res,
                    400,
                    "ID personel tidak valid."
                );
            }

            if (userId === Number(req.user.id)) {
                return sendError(
                    res,
                    400,
                    "Akun admin yang sedang digunakan tidak dapat dihapus."
                );
            }

            await pool.query(
                `
                DELETE FROM payments
                WHERE user_id = $1
                `,
                [userId]
            );

            const result = await pool.query(
                `
                DELETE FROM users
                WHERE id = $1
                RETURNING id
                `,
                [userId]
            );

            if (result.rows.length === 0) {
                return sendError(
                    res,
                    404,
                    "Personel tidak ditemukan."
                );
            }

            res.json({
                success: true,
                message:
                    "Personel berhasil dihapus.",
            });
        } catch (err) {
            console.error(
                "[DELETE USER ERROR]",
                err
            );

            res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);

/* =========================================================
   SPA FALLBACK
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
   VERCEL
========================================================= */

module.exports = app;
