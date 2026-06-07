require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ERROR] Define SUPABASE_URL y SUPABASE_KEY en .env');
  process.exit(1);
}

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function sbGet(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); console.error('[SB]', url.slice(0,60)+'...', JSON.stringify(err)); throw err; }
  return res.json();
}

async function sbGetSingle(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, { headers: { ...SB_HEADERS, Accept: 'application/vnd.pgrst.object+json' } });
  if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); throw err; }
  return res.json();
}

async function sbInsert(table, body) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, { method: 'POST', headers: { ...SB_HEADERS, Prefer: 'return=representation' }, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); throw err; }
  const json = await res.json();
  return Array.isArray(json) ? json[0] : json;
}

async function sbUpdate(table, body, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, { method: 'PATCH', headers: { ...SB_HEADERS, Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' }, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); throw err; }
  return res.json();
}

async function sbDelete(table, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, { method: 'DELETE', headers: { ...SB_HEADERS, Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' } });
  if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); throw err; }
  return res.json();
}

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
      workerSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      childSrc: ["'self'", "https://cdnjs.cloudflare.com", "blob:"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    }
  }
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Demasiados intentos. Intenta de nuevo en 15 min.' } });
const orderLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Demasiados pedidos. Espera un minuto.' } });

function authMiddleware(req, res, next) {
  if (req.method === 'GET') return next();
  if (req.path.startsWith('/auth/')) return next();
  if (req.method === 'POST' && req.path === '/pedidos') return next();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'No autorizado' });
  }
}
app.use('/api', authMiddleware);

app.get('/api/debug', (req, res) => {
  const urlOk = !!SUPABASE_URL;
  const keyOk = !!SUPABASE_KEY;
  const urlLen = SUPABASE_URL ? SUPABASE_URL.length : 0;
  const keyLen = SUPABASE_KEY ? SUPABASE_KEY.length : 0;
  res.json({ urlOk, urlLen, keyOk, keyLen, keyStart: keyOk ? SUPABASE_KEY.slice(0,10)+'...' : '' });
});

// ─── Productos ───────────────────────────────────────────────────────────────

app.get('/api/productos', async (req, res) => {
  try {
    const tipo = req.query.tipo || 'mayor';
    const data = await sbGet('productos', `?select=*&lista=eq.${tipo}&order=id`);
    const mapped = data.map(p => ({
      id: p.ref_id,
      categoria: p.categoria,
      nombre: p.nombre,
      empaque: p.empaque,
      presentacion: p.presentacion,
      precio: p.precio,
      disponible: p.disponible,
      utilidad: p.utilidad,
      etiqueta: p.etiqueta
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Error al leer productos' });
  }
});

app.get('/api/productos/:id', async (req, res) => {
  try {
    const tipo = req.query.tipo || 'mayor';
    const data = await sbGetSingle('productos', `?select=*&lista=eq.${tipo}&ref_id=eq.${parseInt(req.params.id)}`);
    if (!data) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({
      id: data.ref_id,
      categoria: data.categoria,
      nombre: data.nombre,
      empaque: data.empaque,
      presentacion: data.presentacion,
      precio: data.precio,
      disponible: data.disponible,
      utilidad: data.utilidad,
      etiqueta: data.etiqueta
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer producto' });
  }
});

app.post('/api/productos', async (req, res) => {
  try {
    const tipo = req.query.tipo || 'mayor';
    const rows = await sbGet('productos', `?select=ref_id&lista=eq.${tipo}&order=ref_id.desc&limit=1`);
    const newRefId = (rows?.[0]?.ref_id || 0) + 1;
    const product = {
      ref_id: newRefId,
      lista: tipo,
      categoria: req.body.categoria || '',
      nombre: req.body.nombre || '',
      empaque: req.body.empaque || '',
      presentacion: req.body.presentacion || '',
      precio: parseFloat(req.body.precio) || 0,
      utilidad: req.body.utilidad !== undefined ? parseFloat(req.body.utilidad) : 0,
      disponible: req.body.disponible !== undefined ? req.body.disponible : true,
      etiqueta: req.body.etiqueta || ''
    };
    const data = await sbInsert('productos', product);
    res.status(201).json({
      id: data.ref_id,
      categoria: data.categoria,
      nombre: data.nombre,
      empaque: data.empaque,
      presentacion: data.presentacion,
      precio: data.precio,
      utilidad: data.utilidad,
      disponible: data.disponible,
      etiqueta: data.etiqueta
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

app.put('/api/productos/:id', async (req, res) => {
  try {
    const tipo = req.query.tipo || 'mayor';
    const updates = {};
    if (req.body.categoria !== undefined) updates.categoria = req.body.categoria;
    if (req.body.nombre !== undefined) updates.nombre = req.body.nombre;
    if (req.body.empaque !== undefined) updates.empaque = req.body.empaque;
    if (req.body.presentacion !== undefined) updates.presentacion = req.body.presentacion;
    if (req.body.precio !== undefined) updates.precio = parseFloat(req.body.precio);
    if (req.body.utilidad !== undefined) updates.utilidad = parseFloat(req.body.utilidad);
    if (req.body.disponible !== undefined) updates.disponible = req.body.disponible;
    if (req.body.etiqueta !== undefined) updates.etiqueta = req.body.etiqueta;
    updates.updated_at = new Date().toISOString();

    const data = await sbUpdate('productos', updates, `?lista=eq.${tipo}&ref_id=eq.${parseInt(req.params.id)}`);
    if (!data) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({
      id: data.ref_id,
      categoria: data.categoria,
      nombre: data.nombre,
      empaque: data.empaque,
      presentacion: data.presentacion,
      precio: data.precio,
      utilidad: data.utilidad,
      disponible: data.disponible,
      etiqueta: data.etiqueta
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

app.delete('/api/productos/:id', async (req, res) => {
  try {
    const tipo = req.query.tipo || 'mayor';
    const data = await sbDelete('productos', `?lista=eq.${tipo}&ref_id=eq.${parseInt(req.params.id)}`);
    if (!data) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({
      id: data.ref_id,
      categoria: data.categoria,
      nombre: data.nombre,
      empaque: data.empaque,
      presentacion: data.presentacion,
      precio: data.precio,
      utilidad: data.utilidad,
      disponible: data.disponible,
      etiqueta: data.etiqueta
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

app.post('/api/productos/import', async (req, res) => {
  try {
    let data = req.body;
    if (data && data.products) data = data.products;
    if (!Array.isArray(data) || !data.length) {
      return res.status(400).json({ error: 'Enviar un array de productos' });
    }
    const valid = data.every(p => p.nombre && p.categoria && p.precio !== undefined);
    if (!valid) return res.status(400).json({ error: 'Cada producto debe tener nombre, categoria y precio' });
    const tipo = req.body.tipo || 'mayor';

    // Delete all existing products for this list type, then insert fresh
    await fetch(`${SUPABASE_URL}/rest/v1/productos?lista=eq.${tipo}`, {
      method: 'DELETE', headers: SB_HEADERS
    });

    const rows = data.map((p, i) => ({
      ref_id: i + 1,
      lista: tipo,
      categoria: p.categoria,
      nombre: p.nombre,
      empaque: p.empaque || '',
      presentacion: p.presentacion || '',
      precio: parseFloat(p.precio) || 0,
      disponible: p.disponible !== undefined ? p.disponible : true,
      utilidad: p.utilidad || 0,
      etiqueta: p.etiqueta || ''
    }));

    await sbInsert('productos', rows);
    res.json({ ok: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Error al importar productos' });
  }
});



// ─── Config ──────────────────────────────────────────────────────────────────

app.get('/api/config', async (req, res) => {
  try {
    const data = await sbGetSingle('configuracion', '?select=*&id=eq.1');
    res.json({
      tasa_bcv: data.tasa_bcv,
      diferencial: data.diferencial,
      ultima_actualizacion: data.ultima_actualizacion
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer configuración' });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const updates = { updated_at: new Date().toISOString() };
    if (req.body.tasa_bcv !== undefined) updates.tasa_bcv = parseFloat(req.body.tasa_bcv) || 0;
    if (req.body.diferencial !== undefined) updates.diferencial = parseFloat(req.body.diferencial) || 0;
    const data = await sbUpdate('configuracion', updates, '?id=eq.1');
    res.json({
      tasa_bcv: data.tasa_bcv,
      diferencial: data.diferencial,
      ultima_actualizacion: data.ultima_actualizacion
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

// ─── Diferencial / Tasas ─────────────────────────────────────────────────────

async function fetchDolarApi() {
  const res = await fetch('https://ve.dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(8000) });
  const tasas = await res.json();
  const oficial = tasas.find(t => t.fuente === 'oficial')?.promedio;
  const paralelo = tasas.find(t => t.fuente === 'paralelo')?.promedio;
  if (!oficial || !paralelo) throw new Error('dolarapi: tasas incompletas');
  return { oficial, paralelo };
}

async function fetchBinanceP2P() {
  const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset: 'USDT', fiat: 'VES', tradeType: 'SELL', page: 1, rows: 10, payTypes: [], publisherType: null })
  });
  const data = await res.json();
  const ads = data.data || [];
  if (ads.length === 0) throw new Error('binance: sin anuncios');
  const prices = ads.map(a => parseFloat(a.adv.price)).filter(p => p > 0);
  if (prices.length === 0) throw new Error('binance: precios inválidos');
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

async function fetchBcvRafnxg() {
  const res = await fetch('https://bcv-api.rafnixg.dev/v1/exchange-rates/latest/USD', { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  const rate = parseFloat(data.rate);
  if (!rate || rate <= 0) throw new Error('rafnxg: tasa inválida');
  return rate;
}

async function fetchTasas() {
  let lastError;
  // Tier 1: dolarapi (da ambas tasas)
  try {
    return await fetchDolarApi();
  } catch (e) { lastError = e; }

  // Tier 2: fallback individual
  let oficial, paralelo;
  try { oficial = await fetchBcvRafnxg(); } catch (e) { lastError = e; }
  try { paralelo = await fetchBinanceP2P(); } catch (e) { lastError = e; }
  if (oficial && paralelo) return { oficial, paralelo, fallback: true };
  throw lastError || new Error('No se pudieron obtener las tasas');
}

async function fetchAndSaveTasas() {
  const { oficial, paralelo } = await fetchTasas();
  const diferencial = parseFloat(((paralelo - oficial) / oficial * 100).toFixed(1));
  const data = await sbUpdate('configuracion', {
      tasa_bcv: oficial,
      diferencial,
      ultima_actualizacion: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, '?id=eq.1');
  return { oficial, paralelo, tasa_bcv: oficial, diferencial: data.diferencial, ultima_actualizacion: data.ultima_actualizacion };
}

const AUTO_HOURS_VET = [6, 14, 22];

function iniciarAutoUpdate() {
  const checkInterval = setInterval(async () => {
    const ahora = new Date();
    const horaVET = (ahora.getUTCHours() - 4 + 24) % 24;
    const minVET = ahora.getUTCMinutes();
    if (!AUTO_HOURS_VET.includes(horaVET)) return;
    if (minVET > 5) return;
    try {
      const data = await sbGetSingle('configuracion', '?select=ultima_actualizacion&id=eq.1');
      if (data?.ultima_actualizacion) {
        const diffHours = (Date.now() - new Date(data.ultima_actualizacion).getTime()) / 3600000;
        if (diffHours < 3.5) return;
      }
      const result = await fetchAndSaveTasas();
      console.log(`[Auto] Tasas actualizadas: BCV ${result.tasa_bcv.toFixed(2)} | Diferencial ${result.diferencial}% | ${new Date().toLocaleString()}`);
    } catch (e) {
      console.error('[Auto] Error:', e.message);
    }
  }, 60000);

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

app.get('/api/diferencial/calcular', async (req, res) => {
  try {
    const result = await fetchTasas();
    res.json({ ...result, tasa_bcv: result.oficial });
  } catch {
    res.status(502).json({ error: 'Error al conectar con servicios de tasas' });
  }
});

app.post('/api/diferencial/auto-actualizar', async (req, res) => {
  try {
    const result = await fetchAndSaveTasas();
    res.json(result);
  } catch {
    res.status(502).json({ error: 'Error al actualizar tasas' });
  }
});

app.get('/api/diferencial/ultima', async (req, res) => {
  try {
    const data = await sbGetSingle('configuracion', '?select=*&id=eq.1');
    res.json({
      tasa_bcv: data.tasa_bcv || 0,
      diferencial: data.diferencial || 0,
      ultima_actualizacion: data.ultima_actualizacion || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer configuración' });
  }
});

// ─── Auth ────────────────────────────────────────────────────────────────────

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('[ERROR] Define ADMIN_USER y ADMIN_PASS en el archivo .env');
  process.exit(1);
}

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { user, pass } = req.body || {};
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    const token = jwt.sign({ user: ADMIN_USER, ts: Date.now() }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/verificar', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ autenticado: true });
  } catch {
    res.json({ autenticado: false });
  }
});

// ─── Pedidos ─────────────────────────────────────────────────────────────────

app.get('/api/pedidos', async (req, res) => {
  try {
    const data = await sbGet('pedidos', '?select=*,pedido_items(*)&order=id.desc');
    const mapped = data.map(p => ({
      id: p.id,
      phone: p.phone,
      cliente: p.cliente,
      items: (p.pedido_items || []).map(i => ({
        id: i.ref_id,
        nombre: i.nombre,
        presentacion: i.presentacion,
        empaque: i.empaque,
        precio: i.precio,
        quantity: i.quantity,
        list: i.lista
      })),
      total_usd: p.total_usd,
      total_bs: p.total_bs,
      modo: p.modo,
      nota: p.nota,
      fecha: p.created_at,
      estado: p.estado
    }));
    res.json(mapped);
  } catch {
    res.status(500).json({ error: 'Error al leer pedidos' });
  }
});

app.post('/api/pedidos', orderLimiter, async (req, res) => {
  try {
    const { items: rawItems, cliente, total_usd, total_bs, modo, nota, phone } = req.body || {};
    if (!rawItems || !rawItems.length) return res.status(400).json({ error: 'Pedido vacío' });

    const sanitizedItems = rawItems.map(i => ({
      ref_id: parseInt(i.id) || 0,
      nombre: (i.nombre || '').replace(/[<>&"']/g, '').slice(0, 200),
      presentacion: (i.presentacion || '').replace(/[<>&"']/g, '').slice(0, 100),
      empaque: (i.empaque || '').replace(/[<>&"']/g, '').slice(0, 100),
      precio: parseFloat(i.precio) || 0,
      quantity: parseFloat(i.quantity) || 1,
      lista: i.list === 'detal' ? 'detal' : 'mayor'
    }));

    const pedido = await sbInsert('pedidos', {
        phone: (phone || '').replace(/[<>&"']/g, '').slice(0, 30),
        cliente: (cliente || 'Cliente').replace(/[<>&"']/g, '').slice(0, 100),
        total_usd: parseFloat(total_usd) || 0,
        total_bs: parseFloat(total_bs) || 0,
        modo: modo === 'BCV' ? 'BCV' : 'DIVISA',
        nota: (nota || '').replace(/[<>&"']/g, '').slice(0, 500),
        estado: 'Pendiente'
      });

    const itemsWithPedido = sanitizedItems.map(i => ({ ...i, pedido_id: pedido.id }));
    await sbInsert('pedido_items', itemsWithPedido);

    res.status(201).json({
      id: pedido.id,
      phone: pedido.phone,
      cliente: pedido.cliente,
      items: sanitizedItems.map(i => ({
        id: i.ref_id,
        nombre: i.nombre,
        presentacion: i.presentacion,
        empaque: i.empaque,
        precio: i.precio,
        quantity: i.quantity,
        list: i.lista
      })),
      total_usd: pedido.total_usd,
      total_bs: pedido.total_bs,
      modo: pedido.modo,
      nota: pedido.nota,
      fecha: pedido.created_at,
      estado: pedido.estado
    });
  } catch {
    res.status(500).json({ error: 'Error al guardar pedido' });
  }
});

app.put('/api/pedidos/:id/cliente', async (req, res) => {
  try {
    const data = await sbUpdate('pedidos', { cliente: req.body.cliente, updated_at: new Date().toISOString() }, `?id=eq.${parseInt(req.params.id)}`);
    if (!data) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ id: data.id, cliente: data.cliente });
  } catch {
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

app.put('/api/pedidos/:id/estado', async (req, res) => {
  try {
    const data = await sbUpdate('pedidos', { estado: req.body.estado || 'Pendiente', updated_at: new Date().toISOString() }, `?id=eq.${parseInt(req.params.id)}`);
    if (!data) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ id: data.id, estado: data.estado });
  } catch {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

iniciarAutoUpdate();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Catálogo: http://localhost:${PORT}`);
    console.log(`Admin:    http://localhost:${PORT}/admin.html`);
    console.log(`[Auto] Actualización programada cada 8h (VET: ${AUTO_HOURS_VET.join(', ')}:00)`);
  });
}

module.exports = app;
