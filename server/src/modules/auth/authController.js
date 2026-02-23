const db = require('../../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'User is disabled' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, reference_id: user.reference_id },
            process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                reference_id: user.reference_id
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
};

const registerInitialAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;
        // Just a quick setup route, ideally should be removed or protected later
        const existing = await db.query('SELECT * FROM users WHERE role = $1', ['ADMIN']);
        if (existing.rows.length > 0) {
            return res.status(403).json({ error: 'Admin already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await db.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hash, 'ADMIN']
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating admin:', err);
        res.status(500).json({ error: 'Error creating admin' });
    }
};

module.exports = {
    login,
    registerInitialAdmin
};
