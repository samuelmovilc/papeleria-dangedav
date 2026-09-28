require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const rateLimit = require('express-rate-limit');

const app = express();

// ── CORS PRIMERO - ANTES DE TODO ──
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,Accept,Origin');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 60*1000, max: 500 }));

// ── DB POOL ──
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '89.117.56.39',
  port:     parseInt(process.env.DB_PORT) || 3308,
  database: process.env.DB_NAME     || 'papeleria_dangedav',
  user:     process.env.DB_USER     || 'pos_user',
  password: process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

// ── HEALTH ──
app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', db: 'connected', ts: new Date() }); }
  catch(e) { res.status(500).json({ status: 'error', db: e.message }); }
});

// ════ PRODUCTOS ════
app.get('/api/productos', async (req, res) => {
  try {
    const { nombre, codigo, stock_max, precio_min, precio_max, orden } = req.query;
    let sql = 'SELECT * FROM productos WHERE 1=1'; const p = [];
    if (nombre)     { sql += ' AND nombre LIKE ?';     p.push('%'+nombre+'%'); }
    if (codigo)     { sql += ' AND id LIKE ?';         p.push('%'+codigo+'%'); }
    if (stock_max)  { sql += ' AND stock <= ?';        p.push(parseInt(stock_max)); }
    if (precio_min) { sql += ' AND precio_venta >= ?'; p.push(parseFloat(precio_min)); }
    if (precio_max) { sql += ' AND precio_venta <= ?'; p.push(parseFloat(precio_max)); }
    if (orden === 'salidas') sql += ' ORDER BY salidas DESC';
    else if (orden === 'stock') sql += ' ORDER BY stock DESC';
    else sql += ' ORDER BY nombre ASC';
    const [rows] = await pool.query(sql, p);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/productos/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/productos', async (req, res) => {
  try {
    const { id, nombre, precio_venta, precio_compra, stock } = req.body;
    if (!id||!nombre||precio_venta==null||stock==null) return res.status(400).json({ error: 'Faltan campos' });
    await pool.query('INSERT INTO productos (id,nombre,precio_venta,precio_compra,stock,entradas,salidas) VALUES (?,?,?,?,?,?,0)',
      [id,nombre,precio_venta,precio_compra,stock,stock]);
    const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [id]);
    res.status(201).json(rows[0]);
  } catch(e) {
    if (e.code==='ER_DUP_ENTRY') return res.status(409).json({ error: 'Código ya existe' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/productos/:id', async (req, res) => {
  try {
    const { nombre, precio_venta, precio_compra, stock } = req.body;
    const [old] = await pool.query('SELECT stock,entradas FROM productos WHERE id=?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'No encontrado' });
    const dE = stock > old[0].stock ? stock - old[0].stock : 0;
    await pool.query('UPDATE productos SET nombre=?,precio_venta=?,precio_compra=?,stock=?,entradas=entradas+? WHERE id=?',
      [nombre,precio_venta,precio_compra,stock,dE,req.params.id]);
    const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/productos/:id/stock', async (req, res) => {
  try {
    const { stock } = req.body;
    const [old] = await pool.query('SELECT stock FROM productos WHERE id=?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'No encontrado' });
    const dE = stock > old[0].stock ? stock - old[0].stock : 0;
    await pool.query('UPDATE productos SET stock=?,entradas=entradas+? WHERE id=?', [stock,dE,req.params.id]);
    const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/productos/:id', async (req, res) => {
  try {
    const [c] = await pool.query('SELECT COUNT(*) as cnt FROM venta_productos WHERE producto_id=?', [req.params.id]);
    if (c[0].cnt > 0) return res.status(409).json({ error: 'Tiene ventas asociadas' });
    await pool.query('DELETE FROM productos WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/productos/importar', async (req, res) => {
  try {
    const { productos } = req.body;
    if (!Array.isArray(productos)) return res.status(400).json({ error: 'Array requerido' });
    let added=0,updated=0,errors=0;
    for (const p of productos) {
      if (!p.id||!p.nombre) { errors++; continue; }
      const [old] = await pool.query('SELECT stock,entradas FROM productos WHERE id=?', [p.id]);
      if (old.length) {
        const dE = p.stock > old[0].stock ? p.stock - old[0].stock : 0;
        await pool.query('UPDATE productos SET nombre=?,precio_venta=?,precio_compra=?,stock=?,entradas=entradas+? WHERE id=?',
          [p.nombre,p.precio_venta,p.precio_compra,p.stock,dE,p.id]);
        updated++;
      } else {
        await pool.query('INSERT INTO productos (id,nombre,precio_venta,precio_compra,stock,entradas,salidas) VALUES (?,?,?,?,?,?,0)',
          [p.id,p.nombre,p.precio_venta,p.precio_compra,p.stock,p.stock]);
        added++;
      }
    }
    res.json({ added, updated, errors });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════ VENTAS ════
app.get('/api/ventas', async (req, res) => {
  try {
    const { fecha, estado } = req.query;
    let sql = 'SELECT * FROM ventas WHERE 1=1'; const p = [];
    if (fecha)  { sql += ' AND fecha=?';  p.push(fecha); }
    if (estado) { sql += ' AND estado=?'; p.push(estado); }
    sql += ' ORDER BY created_at DESC';
    const [ventas] = await pool.query(sql, p);
    for (const v of ventas) {
      const [prods] = await pool.query('SELECT * FROM venta_productos WHERE venta_id=?', [v.id]);
      v.venta_productos = prods;
      try { v.metodos_pago = typeof v.metodos_pago==='string' ? JSON.parse(v.metodos_pago||'[]') : (v.metodos_pago||[]); } catch(e) { v.metodos_pago=[]; }
    }
    res.json(ventas);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ventas/resumen/:fecha', async (req, res) => {
  try {
    const [ventas] = await pool.query('SELECT * FROM ventas WHERE fecha=? AND estado="aceptada"', [req.params.fecha]);
    const totalVendido = ventas.reduce((s,v)=>s+parseFloat(v.total||0),0);
    const byMethod = {};
    for (const v of ventas) {
      let mp = v.metodos_pago;
      try { if (typeof mp==='string') mp=JSON.parse(mp||'[]'); } catch(e){mp=[];}
      (mp||[]).forEach(r=>{ byMethod[r.metodo]=(byMethod[r.metodo]||0)+parseFloat(r.monto||0); });
    }
    // utilidad
    const [vps] = await pool.query(
      'SELECT vp.*, p.precio_compra FROM venta_productos vp LEFT JOIN productos p ON vp.producto_id=p.id WHERE vp.venta_id IN (SELECT id FROM ventas WHERE fecha=? AND estado="aceptada")',
      [req.params.fecha]
    );
    let utilidad = 0;
    vps.forEach(vp=>{ utilidad+=(parseFloat(vp.precio_unitario||0)-parseFloat(vp.precio_compra||0))*parseInt(vp.cantidad||0); });
    res.json({ totalVendido, utilidad, pct: totalVendido>0?(utilidad/totalVendido*100):0, byMethod, cantVentas: ventas.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ventas/:folio', async (req, res) => {
  try {
    const [ventas] = await pool.query('SELECT * FROM ventas WHERE folio=?', [req.params.folio]);
    if (!ventas.length) return res.status(404).json({ error: 'No encontrada' });
    const v = ventas[0];
    const [prods] = await pool.query('SELECT * FROM venta_productos WHERE venta_id=?', [v.id]);
    v.venta_productos = prods;
    try { v.metodos_pago = typeof v.metodos_pago==='string'?JSON.parse(v.metodos_pago||'[]'):(v.metodos_pago||[]); } catch(e){v.metodos_pago=[];}
    res.json(v);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ventas', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { folio,fecha,hora,cliente,observaciones,metodo_pago,metodos_pago,total,cambio,productos } = req.body;
    if (!folio||!fecha||!hora||!total||!productos?.length) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Faltan campos' });
    }
    const [r] = await conn.query(
      'INSERT INTO ventas (folio,fecha,hora,cliente,observaciones,metodo_pago,metodos_pago,total,cambio,estado) VALUES (?,?,?,?,?,?,?,?,?,"aceptada")',
      [folio,fecha,hora,cliente||'CLIENTE POS',observaciones||'',metodo_pago||'',JSON.stringify(metodos_pago||[]),total,cambio||0]
    );
    const ventaId = r.insertId;
    for (const p of productos) {
      await conn.query('INSERT INTO venta_productos (venta_id,producto_id,nombre,cantidad,precio_unitario,subtotal) VALUES (?,?,?,?,?,?)',
        [ventaId,p.codigo,p.nombre,p.cantidad,p.precioUnitario,p.subtotal]);
      await conn.query('UPDATE productos SET stock=GREATEST(0,stock-?),salidas=salidas+? WHERE id=?',
        [p.cantidad,p.cantidad,p.codigo]);
    }
    await conn.commit(); conn.release();
    const [rows] = await pool.query('SELECT * FROM ventas WHERE id=?', [ventaId]);
    res.status(201).json(rows[0]);
  } catch(e) {
    await conn.rollback(); conn.release();
    if (e.code==='ER_DUP_ENTRY') return res.status(409).json({ error: 'Folio duplicado' });
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/ventas/:folio/anular', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ventas] = await conn.query('SELECT * FROM ventas WHERE folio=?', [req.params.folio]);
    if (!ventas.length) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'No encontrada' }); }
    if (ventas[0].estado==='anulada') { await conn.rollback(); conn.release(); return res.status(409).json({ error: 'Ya anulada' }); }
    const [prods] = await conn.query('SELECT * FROM venta_productos WHERE venta_id=?', [ventas[0].id]);
    for (const p of prods) {
      await conn.query('UPDATE productos SET stock=stock+?,salidas=GREATEST(0,salidas-?) WHERE id=?',
        [p.cantidad,p.cantidad,p.producto_id]);
    }
    await conn.query('UPDATE ventas SET estado="anulada" WHERE folio=?', [req.params.folio]);
    await conn.commit(); conn.release();
    res.json({ ok: true, folio: req.params.folio, estado: 'anulada' });
  } catch(e) { await conn.rollback(); conn.release(); res.status(500).json({ error: e.message }); }
});

// ════ CONFIGURACION ════
app.get('/api/configuracion', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM configuracion LIMIT 1');
    if (!rows.length) return res.status(404).json({ error: 'Sin configuración' });
    const cfg = rows[0];
    try { cfg.metodos_pago = typeof cfg.metodos_pago==='string'?JSON.parse(cfg.metodos_pago||'[]'):(cfg.metodos_pago||[]); } catch(e){cfg.metodos_pago=[];}
    res.json(cfg);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/configuracion/:id', async (req, res) => {
  try {
    const { nombre_negocio,direccion,telefono,logo,metodos_pago,mensaje_tirilla,stock_critico,tamano_ticket } = req.body;
    await pool.query(
      'UPDATE configuracion SET nombre_negocio=?,direccion=?,telefono=?,logo=?,metodos_pago=?,mensaje_tirilla=?,stock_critico=?,tamano_ticket=? WHERE id=?',
      [nombre_negocio,direccion,telefono,logo||null,JSON.stringify(metodos_pago||[]),mensaje_tirilla,stock_critico||10,tamano_ticket||'80mm',req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM configuracion WHERE id=?', [req.params.id]);
    const cfg = rows[0];
    try { cfg.metodos_pago = typeof cfg.metodos_pago==='string'?JSON.parse(cfg.metodos_pago||'[]'):(cfg.metodos_pago||[]); } catch(e){cfg.metodos_pago=[];}
    res.json(cfg);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log('API corriendo en puerto ' + PORT));
module.exports = app;
