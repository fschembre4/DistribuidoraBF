require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = 3000;
const PRODUCTS_MAYOR = path.join(__dirname, 'productos_mayor.json');
const PRODUCTS_DETAL = path.join(__dirname, 'productos_detal.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

function getProductFile(tipo) {
    if (tipo === 'detal') return PRODUCTS_DETAL;
    return PRODUCTS_MAYOR;
}
const sessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24h

function cleanExpiredSessions() {
    const now = Date.now();
    for (const [token, ts] of sessions) {
        if (now - ts > SESSION_TTL) sessions.delete(token);
    }
}

app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Demasiados intentos. Intenta de nuevo en 15 min.' } });
const orderLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Demasiados pedidos. Espera un minuto.' } });

// Auth middleware — protege POST/PUT/DELETE en /api/* (excepto /api/auth/* y POST /api/pedidos)
function authMiddleware(req, res, next) {
    if (req.method === 'GET') return next();
    if (req.path.startsWith('/auth/')) return next();
    if (req.method === 'POST' && req.path === '/pedidos') return next();
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const ts = sessions.get(token);
    if (!ts || Date.now() - ts > SESSION_TTL) {
        sessions.delete(token);
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}
app.use('/api', authMiddleware);

function readProducts(tipo) {
    const raw = fs.readFileSync(getProductFile(tipo), 'utf-8');
    return JSON.parse(raw);
}

function writeProducts(data, tipo) {
    const file = tipo ? getProductFile(tipo) : PRODUCTS_FILE;
    fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf-8');
}

function readConfig() {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
}

function writeConfig(data) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 4), 'utf-8');
}

app.get('/api/productos', (req, res) => {
    try {
        const tipo = req.query.tipo || 'mayor';
        const products = readProducts(tipo);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Error al leer productos' });
    }
});

app.get('/api/productos/:id', (req, res) => {
    try {
        const tipo = req.query.tipo || 'mayor';
        const products = readProducts(tipo);
        const product = products.find(p => p.id === parseInt(req.params.id));
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: 'Error al leer producto' });
    }
});

app.post('/api/productos', (req, res) => {
    try {
        const tipo = req.query.tipo || 'mayor';
        const products = readProducts(tipo);
        const maxId = products.reduce((max, p) => Math.max(max, p.id), 0);
        const newProduct = {
            id: maxId + 1,
            categoria: req.body.categoria || '',
            nombre: req.body.nombre || '',
            empaque: req.body.empaque || '',
            presentacion: req.body.presentacion || '',
            precio: parseFloat(req.body.precio) || 0,
            utilidad: req.body.utilidad !== undefined ? parseFloat(req.body.utilidad) : 0,
            disponible: req.body.disponible !== undefined ? req.body.disponible : true
        };
        if (req.body.etiqueta) newProduct.etiqueta = req.body.etiqueta;
        products.push(newProduct);
        writeProducts(products, tipo);
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

app.put('/api/productos/:id', (req, res) => {
    try {
        const tipo = req.query.tipo || 'mayor';
        const products = readProducts(tipo);
        const index = products.findIndex(p => p.id === parseInt(req.params.id));
        if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });

        const updated = { ...products[index] };
        if (req.body.categoria !== undefined) updated.categoria = req.body.categoria;
        if (req.body.nombre !== undefined) updated.nombre = req.body.nombre;
        if (req.body.empaque !== undefined) updated.empaque = req.body.empaque;
        if (req.body.presentacion !== undefined) updated.presentacion = req.body.presentacion;
        if (req.body.precio !== undefined) updated.precio = parseFloat(req.body.precio);
        if (req.body.utilidad !== undefined) updated.utilidad = parseFloat(req.body.utilidad);
        if (req.body.disponible !== undefined) updated.disponible = req.body.disponible;
        if (req.body.etiqueta !== undefined) updated.etiqueta = req.body.etiqueta;

        products[index] = updated;
        writeProducts(products, tipo);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

app.get('/api/config', (req, res) => {
    try {
        res.json(readConfig());
    } catch (err) {
        res.status(500).json({ error: 'Error al leer configuración' });
    }
});

app.put('/api/config', (req, res) => {
    try {
        const config = readConfig();
        if (req.body.tasa_bcv !== undefined) config.tasa_bcv = parseFloat(req.body.tasa_bcv) || 0;
        if (req.body.diferencial !== undefined) config.diferencial = parseFloat(req.body.diferencial) || 0;
        writeConfig(config);
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

async function fetchTasas() {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares');
    const tasas = await response.json();
    const oficial = tasas.find(t => t.fuente === 'oficial')?.promedio;
    const paralelo = tasas.find(t => t.fuente === 'paralelo')?.promedio;
    if (!oficial || !paralelo) throw new Error('No se pudieron obtener las tasas');
    return { oficial, paralelo };
}

async function fetchAndSaveTasas() {
    const { oficial, paralelo } = await fetchTasas();
    const config = readConfig();
    config.tasa_bcv = oficial;
    config.diferencial = parseFloat(((paralelo - oficial) / oficial * 100).toFixed(1));
    config.ultima_actualizacion = new Date().toISOString();
    writeConfig(config);
    return { oficial, paralelo, tasa_bcv: oficial, diferencial: config.diferencial, ultima_actualizacion: config.ultima_actualizacion };
}

// Horarios VET (UTC-4) para auto-actualización: 6am, 10am, 2pm, 6pm, 10pm, 2am
const AUTO_HOURS_VET = [6, 10, 14, 18, 22, 2];

function iniciarAutoUpdate() {
    const checkInterval = setInterval(async () => {
        const ahora = new Date();
        const horaVET = (ahora.getUTCHours() - 4 + 24) % 24;
        const minVET = ahora.getUTCMinutes();
        if (!AUTO_HOURS_VET.includes(horaVET)) return;
        if (minVET > 5) return; // solo en el minuto 0-5 de cada hora programada
        try {
            const config = readConfig();
            if (config.ultima_actualizacion) {
                const diffHours = (Date.now() - new Date(config.ultima_actualizacion).getTime()) / 3600000;
                if (diffHours < 3.5) return;
            }
            const result = await fetchAndSaveTasas();
            console.log(`[Auto] Tasas actualizadas: BCV ${result.tasa_bcv.toFixed(2)} | Diferencial ${result.diferencial}% | ${new Date().toLocaleString()}`);
        } catch (e) {
            console.error('[Auto] Error:', e.message);
        }
    }, 60000);

    // También actualizar al iniciar si estamos en ventana horaria
    const now = new Date();
    const vetHour = (now.getUTCHours() - 4 + 24) % 24;
    if (AUTO_HOURS_VET.includes(vetHour)) {
        setTimeout(async () => {
            try {
                await fetchAndSaveTasas();
                console.log(`[Auto] Tasas actualizadas al iniciar: ${new Date().toLocaleString()}`);
            } catch (e) {
                console.error('[Auto] Error al iniciar:', e.message);
            }
        }, 3000);
    }

    return checkInterval;
}

// GET /api/diferencial/calcular — solo consulta (no guarda)
app.get('/api/diferencial/calcular', async (req, res) => {
    try {
        const { oficial, paralelo } = await fetchTasas();
        res.json({ oficial, paralelo, tasa_bcv: oficial });
    } catch {
        res.status(502).json({ error: 'Error al conectar con el servicio de tasas' });
    }
});

// POST /api/diferencial/auto-actualizar — consulta y guarda (manual/forzado)
app.post('/api/diferencial/auto-actualizar', async (req, res) => {
    try {
        const result = await fetchAndSaveTasas();
        res.json(result);
    } catch {
        res.status(502).json({ error: 'Error al actualizar tasas' });
    }
});

// GET /api/diferencial/ultima — info de última actualización
app.get('/api/diferencial/ultima', (req, res) => {
    try {
        const config = readConfig();
        res.json({
            tasa_bcv: config.tasa_bcv || 0,
            diferencial: config.diferencial || 0,
            ultima_actualizacion: config.ultima_actualizacion || null
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al leer configuración' });
    }
});

// Auth - login/logout
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
if (!ADMIN_USER || !ADMIN_PASS) {
    console.error('[ERROR] Define ADMIN_USER y ADMIN_PASS en el archivo .env');
    process.exit(1);
}

app.post('/api/auth/login', loginLimiter, (req, res) => {
    const { user, pass } = req.body || {};
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        cleanExpiredSessions();
        const token = crypto.randomUUID();
        sessions.set(token, Date.now());
        return res.json({ token });
    }
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
});

app.post('/api/auth/logout', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    sessions.delete(token);
    cleanExpiredSessions();
    res.json({ ok: true });
});

app.get('/api/auth/verificar', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const ts = sessions.get(token);
    const valido = ts && Date.now() - ts <= SESSION_TTL;
    if (!valido) sessions.delete(token);
    res.json({ autenticado: !!valido });
});

const PEDIDOS_FILE = path.join(__dirname, 'pedidos.json');

function readPedidos() {
    try {
        const raw = fs.readFileSync(PEDIDOS_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch { return []; }
}
function writePedidos(data) {
    fs.writeFileSync(PEDIDOS_FILE, JSON.stringify(data, null, 4), 'utf-8');
}

// GET /api/pedidos — historial (protegido)
app.get('/api/pedidos', (req, res) => {
    try {
        const pedidos = readPedidos();
        res.json(pedidos.reverse()); // más reciente primero
    } catch {
        res.status(500).json({ error: 'Error al leer pedidos' });
    }
});

// POST /api/pedidos — guardar pedido desde el catálogo (público)
app.post('/api/pedidos', orderLimiter, (req, res) => {
    try {
        const { items, cliente, total_usd, total_bs, modo, nota, phone } = req.body || {};
        if (!items || !items.length) return res.status(400).json({ error: 'Pedido vacío' });
        const pedidos = readPedidos();
        const maxId = pedidos.reduce((m, p) => Math.max(m, p.id), 0);
        const sanitizedItems = items.map(i => ({
            id: parseInt(i.id) || 0,
            nombre: (i.nombre || '').replace(/[<>&"']/g, '').slice(0, 200),
            presentacion: (i.presentacion || '').replace(/[<>&"']/g, '').slice(0, 100),
            empaque: (i.empaque || '').replace(/[<>&"']/g, '').slice(0, 100),
            precio: parseFloat(i.precio) || 0,
            quantity: parseFloat(i.quantity) || 1,
            list: i.list === 'detal' ? 'detal' : 'mayor'
        }));
        const pedido = {
            id: maxId + 1,
            phone: (phone || '').replace(/[<>&"']/g, '').slice(0, 30),
            cliente: (cliente || 'Cliente').replace(/[<>&"']/g, '').slice(0, 100),
            items: sanitizedItems,
            total_usd: parseFloat(total_usd) || 0,
            total_bs: parseFloat(total_bs) || 0,
            modo: modo === 'BCV' ? 'BCV' : 'DIVISA',
            nota: (nota || '').replace(/[<>&"']/g, '').slice(0, 500),
            fecha: new Date().toISOString(),
            estado: 'Pendiente'
        };
        pedidos.push(pedido);
        writePedidos(pedidos);
        res.status(201).json(pedido);
    } catch {
        res.status(500).json({ error: 'Error al guardar pedido' });
    }
});

// PUT /api/pedidos/:id/cliente — editar nombre del cliente (protegido)
app.put('/api/pedidos/:id/cliente', (req, res) => {
    try {
        const pedidos = readPedidos();
        const idx = pedidos.findIndex(p => p.id === parseInt(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Pedido no encontrado' });
        pedidos[idx].cliente = req.body.cliente || pedidos[idx].cliente;
        writePedidos(pedidos);
        res.json(pedidos[idx]);
    } catch {
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
});

// PUT /api/pedidos/:id/estado — cambiar estado (protegido)
app.put('/api/pedidos/:id/estado', (req, res) => {
    try {
        const pedidos = readPedidos();
        const idx = pedidos.findIndex(p => p.id === parseInt(req.params.id));
        if (idx === -1) return res.status(404).json({ error: 'Pedido no encontrado' });
        pedidos[idx].estado = req.body.estado || 'Pendiente';
        writePedidos(pedidos);
        res.json(pedidos[idx]);
    } catch {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

app.post('/api/productos/import', (req, res) => {
    try {
        let data = req.body;
        if (data && data.products) data = data.products;
        if (!Array.isArray(data) || !data.length) {
            return res.status(400).json({ error: 'Enviar un array de productos' });
        }
        const valid = data.every(p => p.nombre && p.categoria && p.precio !== undefined);
        if (!valid) return res.status(400).json({ error: 'Cada producto debe tener nombre, categoria y precio' });
        const tipo = req.body.tipo || 'mayor';
        writeProducts(data, tipo);
        res.json({ ok: true, count: data.length });
    } catch (err) {
        res.status(500).json({ error: 'Error al importar productos' });
    }
});

app.delete('/api/productos/:id', (req, res) => {
    try {
        const tipo = req.query.tipo || 'mayor';
        let products = readProducts(tipo);
        const index = products.findIndex(p => p.id === parseInt(req.params.id));
        if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });
        const deleted = products.splice(index, 1)[0];
        writeProducts(products, tipo);
        res.json(deleted);
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Catálogo: http://localhost:${PORT}`);
    console.log(`Admin:    http://localhost:${PORT}/admin.html`);
    iniciarAutoUpdate();
    console.log(`[Auto] Actualización programada cada 4h (VET: ${AUTO_HOURS_VET.join(', ')}:00)`);
});
