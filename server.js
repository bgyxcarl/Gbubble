
import express from 'express';
import pg from 'pg';
import cors from 'cors';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080; 
const SECRET_KEY = process.env.JWT_SECRET || 'chainscope_secret_key_change_this';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// --- PostgreSQL Connection Config ---
// Using the details provided by the user for Cloud SQL
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '865691863', // Provided password
    database: process.env.DB_NAME || 'gbubble',      // Provided DB name
};

// Cloud Run Connection Logic
const CLOUD_SQL_CONNECTION_NAME = process.env.INSTANCE_CONNECTION_NAME || 'gen-lang-client-0389385347:asia-east2:gbubble';

if (process.env.NODE_ENV === 'production' || process.env.K_SERVICE) {
    // We are in Cloud Run, use the socket
    dbConfig.host = `/cloudsql/${CLOUD_SQL_CONNECTION_NAME}`;
} else {
    // Local fallback (won't work for Cloud SQL unless using Cloud SQL Proxy, but safe for code structure)
    dbConfig.host = process.env.DB_HOST || '127.0.0.1';
    dbConfig.port = 5432;
}

const pool = new Pool(dbConfig);

// Test Connection
pool.connect()
    .then(client => {
        console.log(`Successfully connected to PostgreSQL database: ${dbConfig.database} via ${dbConfig.host}`);
        client.release();
    })
    .catch(err => {
        console.error("Database Connection Failed:", err.message);
        // Do not crash, let Cloud Run restart if needed, but log error
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
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
            [username, hashedPassword]
        );
        res.status(201).json({ message: 'User created', userId: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') return res.status(409).send('Username exists');
        console.error(err);
        res.status(500).send(err.message);
    }
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
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
        const { rows } = await pool.query('SELECT address, label, tag_type FROM address_labels');
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
        await pool.query(
            `INSERT INTO address_labels (address, label, tag_type, updated_by_user_id) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (address) 
             DO UPDATE SET label = EXCLUDED.label, tag_type = EXCLUDED.tag_type, updated_by_user_id = EXCLUDED.updated_by_user_id`,
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
    const { transactions, type } = req.body; 
    const userId = req.user.id;
    
    if (!transactions || transactions.length === 0) return res.json({ count: 0 });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (type === 'native') {
            const chunkSize = 500;
            for (let i = 0; i < transactions.length; i += chunkSize) {
                const chunk = transactions.slice(i, i + chunkSize);
                const values = [];
                const placeholders = chunk.map((t, idx) => {
                    const offset = idx * 10;
                    values.push(
                        userId, t.hash, t.method, t.block, new Date(t.timestamp), t.from, t.to, t.value, t.fee || 0, '1'
                    );
                    return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10})`;
                }).join(',');

                const sql = `
                    INSERT INTO tx_native 
                    (user_id, tx_hash, method, block_number, timestamp, from_addr, to_addr, value, fee, chain_id)
                    VALUES ${placeholders}
                    ON CONFLICT (tx_hash, user_id) DO NOTHING
                `;
                await client.query(sql, values);
            }
        } else {
            const chunkSize = 500;
            for (let i = 0; i < transactions.length; i += chunkSize) {
                const chunk = transactions.slice(i, i + chunkSize);
                const values = [];
                const placeholders = chunk.map((t, idx) => {
                    const offset = idx * 11;
                    values.push(
                        userId, t.id, t.hash, t.method, t.block, new Date(t.timestamp), t.from, t.to, t.value, t.token, '1'
                    );
                    return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10}, $${offset+11})`;
                }).join(',');

                const sql = `
                    INSERT INTO tx_erc20 
                    (user_id, unique_id, tx_hash, method, block_number, timestamp, from_addr, to_addr, value, token_symbol, chain_id)
                    VALUES ${placeholders}
                    ON CONFLICT (unique_id, user_id) DO NOTHING
                `;
                await client.query(sql, values);
            }
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).send(err.message);
    } finally {
        client.release();
    }
});

// 6. Get User Data
app.get('/api/data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const nativeRes = await pool.query(
            'SELECT id, tx_hash as hash, method, block_number as block, timestamp, from_addr as "from", to_addr as "to", value, fee, \'native\' as type FROM tx_native WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 5000',
            [userId]
        );
        const erc20Res = await pool.query(
            'SELECT unique_id as id, tx_hash as hash, method, block_number as block, timestamp, from_addr as "from", to_addr as "to", value, token_symbol as token, \'erc20\' as type FROM tx_erc20 WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 5000',
            [userId]
        );
        
        const format = (rows) => rows.map(r => ({ 
            ...r, 
            id: r.id.toString(), 
            value: parseFloat(r.value), 
            fee: r.fee ? parseFloat(r.fee) : undefined,
            timestamp: r.timestamp.toISOString()
        }));

        res.json({
            native: format(nativeRes.rows),
            erc20: format(erc20Res.rows)
        });
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// Serve Static Files (React App)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to React Index
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
