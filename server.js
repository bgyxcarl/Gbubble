
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
// Allow port to be defined by the cloud environment (Cloud Run uses 8080 by default)
const PORT = process.env.PORT || 3001; 
const SECRET_KEY = process.env.JWT_SECRET || 'chainscope_secret_key_change_this';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Allow large payload for batch insert

// MySQL Connection Config
// Priority: Environment Variables (Cloud) -> Local Defaults
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chainscope_v2',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Handle Socket Path (Common for Google Cloud Run connecting to Cloud SQL via Auth Proxy)
if (process.env.DB_SOCKET_PATH) {
    delete dbConfig.host;
    delete dbConfig.port;
    dbConfig.socketPath = process.env.DB_SOCKET_PATH;
}

// MySQL Connection Pool
const pool = mysql.createPool(dbConfig);

// Test Connection on Start
pool.getConnection()
    .then(conn => {
        console.log(`Successfully connected to Database: ${dbConfig.database} at ${dbConfig.socketPath || dbConfig.host}`);
        conn.release();
    })
    .catch(err => {
        console.error("Database Connection Failed:", err.message);
    });

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ROUTES ---

// 1. Register
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('Missing fields');

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, hashedPassword]
        );
        res.status(201).json({ message: 'User created' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('Username exists');
        console.error(err);
        res.status(500).send(err.message);
    }
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).send('User not found');

        const user = rows[0];
        if (await bcrypt.compare(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '24h' });
            res.json({ token, username: user.username });
        } else {
            res.status(401).send('Invalid password');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// 3. Labels (Shared) - GET
app.get('/api/labels', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT address, label, tag_type FROM address_labels');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// 4. Labels (Shared) - UPSERT
app.post('/api/labels', authenticateToken, async (req, res) => {
    const { address, label, tag_type } = req.body;
    try {
        await pool.execute(
            `INSERT INTO address_labels (address, label, tag_type, updated_by_user_id) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE label = VALUES(label), tag_type = VALUES(tag_type), updated_by_user_id = VALUES(updated_by_user_id)`,
            [address, label, tag_type || 'general', req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// 5. Save Transactions (Batch)
app.post('/api/data/sync', authenticateToken, async (req, res) => {
    const { transactions, type } = req.body; // type: 'native' | 'erc20'
    const userId = req.user.id;
    
    if (!transactions || transactions.length === 0) return res.json({ count: 0 });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        if (type === 'native') {
            const sql = `
                INSERT IGNORE INTO tx_native 
                (user_id, tx_hash, method, block_number, timestamp, from_addr, to_addr, value, fee, chain_id)
                VALUES ?
            `;
            const values = transactions.map(t => [
                userId, t.hash, t.method, t.block, new Date(t.timestamp), t.from, t.to, t.value, t.fee || 0, '1' // Assuming '1' for now, can be passed
            ]);
            await connection.query(sql, [values]);
        } else {
            const sql = `
                INSERT IGNORE INTO tx_erc20 
                (user_id, unique_id, tx_hash, method, block_number, timestamp, from_addr, to_addr, value, token_symbol, chain_id)
                VALUES ?
            `;
            const values = transactions.map(t => [
                userId, t.id, t.hash, t.method, t.block, new Date(t.timestamp), t.from, t.to, t.value, t.token, '1'
            ]);
            await connection.query(sql, [values]);
        }

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).send(err.message);
    } finally {
        connection.release();
    }
});

// 6. Get User Data
app.get('/api/data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const [nativeRows] = await pool.execute(
            'SELECT id, tx_hash as hash, method, block_number as block, timestamp, from_addr as `from`, to_addr as `to`, value, fee, "native" as type FROM tx_native WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5000',
            [userId]
        );
        const [erc20Rows] = await pool.execute(
            'SELECT unique_id as id, tx_hash as hash, method, block_number as block, timestamp, from_addr as `from`, to_addr as `to`, value, token_symbol as token, "erc20" as type FROM tx_erc20 WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5000',
            [userId]
        );
        
        // Normalize IDs and Types
        const format = (rows) => rows.map(r => ({ ...r, id: r.id.toString(), value: parseFloat(r.value), fee: r.fee ? parseFloat(r.fee) : undefined }));

        res.json({
            native: format(nativeRows),
            erc20: format(erc20Rows)
        });
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// Health Check for Cloud Run
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
