require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const initializeSchema = require('./db/schema');
const poolDb = require('./db/index');


// Initialize Database
initializeSchema().catch(err => console.error('Database initialization error:', err));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let isBotEnabledGlobal = true; // Global state in memory, backed by DB
const loadSettings = async () => {
  try {
    if (!poolDb || typeof poolDb.query !== 'function') {
      console.error('poolDb.query is not a function. Check db/index.js exports.');
      return;
    }
    const res = await poolDb.query('SELECT value FROM settings WHERE key = $1', ['is_bot_enabled']);
    if (res.rows.length > 0) {
      isBotEnabledGlobal = res.rows[0].value === 'true';
      console.log(`[SETTINGS] Global Bot Status: ${isBotEnabledGlobal ? 'ENABLED' : 'DISABLED'}`);
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }

};
loadSettings();


const port = process.env.PORT || 3001;

// Clear WhatsApp locks recursively if any
const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || './.wwebjs_auth';
const clearLocks = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      clearLocks(fullPath);
    } else if (file === 'SingletonLock') {
      try {
        fs.unlinkSync(fullPath);
        console.log(`Stale Chromium lock removed at: ${fullPath}`);
      } catch (e) {
        console.error(`Error removing lock at ${fullPath}:`, e);
      }
    }
  }
};
clearLocks(SESSION_PATH);

// WhatsApp Client Setup
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "session", // Explicitly name the session
    dataPath: SESSION_PATH
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
    executablePath: process.env.CHROME_PATH || undefined
  }
});

let whatsappStatus = 'disconnected'; // disconnected, qr, ready, error

client.on('qr', (qr) => {
  console.log('QR RECEIVED', qr);
  whatsappStatus = 'qr';
  io.emit('qr', qr);
});

client.on('ready', () => {
  console.log('WhatsApp Client is ready!');
  whatsappStatus = 'ready';
  io.emit('ready');
});

client.on('authenticated', () => {
  console.log('WhatsApp Client authenticated');
  whatsappStatus = 'ready';
});

client.on('auth_failure', msg => {
  console.error('AUTHENTICATION FAILURE', msg);
  whatsappStatus = 'disconnected';
});

const WhatsAppController = require('./modules/whatsapp/WhatsAppController');
WhatsAppController.setSocket(io);


const serverStartTime = Math.floor(Date.now() / 1000);

client.on('message', async msg => {
  // Ignorar mensajes antiguos del caché para no escribir a todo el mundo al iniciar
  if (msg.timestamp < serverStartTime) {
    console.log(`[BOT-DEBUG] Ignorando mensaje antiguo de ${msg.from}`);
    return;
  }

  // We no longer block messages globally here. We pass the flag to the controller
  // so it can allow messages from testing phones.

  console.log(`[BOT-DEBUG] Mensaje recibido: "${msg.body}" de ${msg.from}`);
  if (msg.body === '!ping') {
    msg.reply('pong');
    return;
  }

  await WhatsAppController.handleMessage(client, msg, isBotEnabledGlobal);
});

const initializeClient = async (isRetry = false) => {
  try {
    whatsappStatus = 'connecting';
    io.emit('status_sync', { status: 'connecting' });
    await client.initialize();
  } catch (err) {
    console.error('Initialization error:', err);

    // If init fails, we should try to close the browser before wiping files
    try {
      await client.destroy();
    } catch (destroyErr) {
      console.error('Error destroying client after init failure:', destroyErr);
    }

    if (!isRetry) {
      console.log('Attempting to recover by clearing session...');
      clearLocks(SESSION_PATH);

      // Add a small delay for OS to release file handles
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        if (fs.existsSync(SESSION_PATH)) {
          fs.rmSync(SESSION_PATH, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
          console.log('Session folder wiped for recovery');
        }
      } catch (e) {
        console.error('Failed to wipe session folder (might be busy):', e.message);
      }

      // Wait a bit and retry
      setTimeout(() => initializeClient(true), 2000);
    } else {
      whatsappStatus = 'error';
      io.emit('status_sync', { status: 'error', message: err.message });
    }
  }
};

initializeClient();

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Admin panel connected');

  // Allow manual reset from UI
  socket.emit('status_sync', {
    status: whatsappStatus,
    isBotEnabledGlobal
  });

  socket.on('toggle_global_bot', async (enabled) => {
    isBotEnabledGlobal = enabled;
    try {
      if (poolDb && typeof poolDb.query === 'function') {
        await poolDb.query('UPDATE settings SET value = $1 WHERE key = $2', [String(enabled), 'is_bot_enabled']);
      }
      io.emit('status_sync', { status: whatsappStatus, isBotEnabledGlobal });
      console.log(`[SETTINGS] Global Bot ${enabled ? 'ENABLED' : 'DISABLED'} by admin`);
    } catch (e) {
      console.error('Error updating bot setting:', e);
    }

  });

  // Allow manual reset from UI

  socket.on('reset_session', async () => {
    console.log('Manual session reset requested');
    try {
      whatsappStatus = 'disconnected';
      io.emit('status_sync', { status: 'disconnected' });

      try {
        await client.destroy();
      } catch (e) {
        console.error('Error destroying client during manual reset:', e);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (fs.existsSync(SESSION_PATH)) {
        fs.rmSync(SESSION_PATH, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
      }

      console.log('Manual reset complete, exiting for restart...');
      // Restart process (Nodemon or Docker restart policy will handle it)
      process.exit(0);
    } catch (e) {
      console.error('Error during manual reset:', e);
    }
  });
});

app.get('/status', (req, res) => {
  res.json({ status: 'running' });
});

// Routes
app.use('/api/auth', require('./modules/auth/authRoutes'));

const authMiddleware = require('./middleware/authMiddleware');

app.use('/api/services', authMiddleware(), require('./modules/services/serviceRoutes'));
app.use('/api/specialties', authMiddleware(), require('./modules/specialties/specialtyRoutes'));
app.use('/api/doctors', authMiddleware(), require('./modules/doctors/doctorRoutes'));

// Inject client into appointment routes
app.use('/api/appointments', authMiddleware(), require('./modules/appointments/appointmentRoutes')(client));

app.use('/api/chats', authMiddleware(), require('./modules/chat/chatRoutes')(client));
app.use('/api/patients', authMiddleware(), require('./modules/patients/patientRoutes'));
app.use('/api/reports', authMiddleware(), require('./modules/reports/reportsRoutes'));
app.use('/api/chatbot', require('./modules/chatbot/chatbotRoutes'));
app.use('/api/results', authMiddleware(), require('./modules/results/resultsRoutes'));

app.get('/api/catalog', authMiddleware(), (req, res) => {
  try {
    const catalogPath1 = path.join(__dirname, '../catalogos.json'); // /app/catalogos.json
    const catalogPath2 = path.join(__dirname, '../../catalogos.json'); // root fallback

    if (fs.existsSync(catalogPath1)) {
      const data = fs.readFileSync(catalogPath1, 'utf8');
      res.json(JSON.parse(data));
    } else if (fs.existsSync(catalogPath2)) {
      const data = fs.readFileSync(catalogPath2, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.status(404).json({ error: 'Catalog not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error loading catalog' });
  }
});

// Background Jobs
const AppointmentControllerFactory = require('./modules/appointments/AppointmentController');
const appointmentController = AppointmentControllerFactory(client);

// Check for no-shows and send reminders every 5 minutes
setInterval(() => {
  appointmentController.updateNoShows();
  appointmentController.sendReminders();
}, 5 * 60 * 1000);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
