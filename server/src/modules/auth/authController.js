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
                reference_id: user.reference_id,
                full_name: user.full_name,
                email: user.email,
                avatar_url: user.avatar_url,
                notify_personal_phone: user.notify_personal_phone
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

// Admin creates staff user (DOCTOR, RECEPTIONIST, LAB)
const registerUser = async (req, res) => {
    try {
        const { username, password, role, full_name, email, reference_id } = req.body;
        const validRoles = ['DOCTOR', 'RECEPTIONIST', 'LAB', 'MANAGER', 'DIRECTOR'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be DOCTOR, RECEPTIONIST, LAB, MANAGER, or DIRECTOR' });
        }

        const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await db.query(
            `INSERT INTO users (username, password_hash, role, full_name, email, reference_id) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id, username, role, full_name, email, reference_id, is_active, created_at`,
            [username, hash, role, full_name || null, email || null, reference_id || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Error creating user: ' + err.message });
    }
};

// Public: patient self-registration
const registerPatient = async (req, res) => {
    try {
        const { username, password, full_name, email, phone, document_id, gender, birth_date } = req.body;

        if (!username || !password || !full_name || !phone) {
            return res.status(400).json({ error: 'username, password, full_name and phone are required' });
        }

        const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        // Create patient record
        const patientRes = await db.query(
            `INSERT INTO patients (full_name, phone, document_id, gender, birth_date) VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (phone) DO UPDATE SET full_name = $1, document_id = $3, gender = $4, birth_date = $5
             RETURNING id`,
            [full_name, phone, document_id || null, gender || null, birth_date || null]
        );
        const patientId = patientRes.rows[0].id;

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await db.query(
            `INSERT INTO users (username, password_hash, role, full_name, email, reference_id) 
             VALUES ($1, $2, 'PATIENT', $3, $4, $5) 
             RETURNING id, username, role, full_name, email, reference_id`,
            [username, hash, full_name, email || null, patientId]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error registering patient:', err);
        res.status(500).json({ error: 'Error al registrar: ' + err.message });
    }
};

// Get all staff users (admin only)
const getUsers = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, username, role, full_name, email, reference_id, is_active, created_at 
             FROM users WHERE role != 'PATIENT' ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Toggle user active/inactive
const toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, username, role, is_active',
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get my profile
const getMe = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, role, full_name, email, avatar_url, reference_id, notify_personal_phone, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update my profile
const updateMe = async (req, res) => {
    const { full_name, email, notify_personal_phone } = req.body;
    try {
        const result = await db.query(
            'UPDATE users SET full_name = $1, email = $2, notify_personal_phone = $3, updated_at = NOW() WHERE id = $4 RETURNING id, username, role, full_name, email, avatar_url, notify_personal_phone',
            [full_name, email, notify_personal_phone, req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Change password
const changePassword = async (req, res) => {
    const { current_password, new_password } = req.body;
    try {
        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!isMatch) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(new_password, salt);
        await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
        res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update avatar (base64)
const updateAvatar = async (req, res) => {
    const { avatar_url } = req.body; // base64 data URL string
    try {
        const result = await db.query(
            'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, avatar_url',
            [avatar_url, req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    login,
    registerInitialAdmin,
    registerUser,
    registerPatient,
    getUsers,
    toggleUserStatus,
    getMe,
    updateMe,
    changePassword,
    updateAvatar
};
