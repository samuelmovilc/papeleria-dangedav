# 🚀 INSTRUCCIONES DEPLOY — PapeleríaPOS
## Contabo MariaDB + GitHub + Vercel

---

## ✅ PASO 1 — Ejecutar el Schema en MariaDB (Contabo)

En tu otra IA o terminal SSH ejecuta:

```bash
docker exec -i papeleria_app_mariadb mariadb \
  -u pos_user \
  -p'Pap3l3r!4#S3cur3_2026' \
  papeleria_app < schema.sql
```

Verificar que las tablas quedaron:
```bash
docker exec -it papeleria_app_mariadb mariadb \
  -u pos_user \
  -p'Pap3l3r!4#S3cur3_2026' \
  papeleria_app \
  -e "SHOW TABLES;"
```

Debe mostrar:
```
configuracion
productos
venta_productos
ventas
```

---

## ✅ PASO 2 — Crear repositorio en GitHub

1. Ve a https://github.com → **New repository**
2. Nombre: `papeleria-pos`
3. Visibilidad: **Private**
4. NO inicialices con README

En tu computadora:
```bash
# Entra a la carpeta del proyecto
cd papeleria-pos-v2

# Inicializar git
git init
git add .
git commit -m "feat: POS Papelería inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/papeleria-pos.git
git push -u origin main
```

---

## ✅ PASO 3 — Deploy Backend en Vercel

1. Ve a https://vercel.com → **Add New Project**
2. Importa el repo `papeleria-pos`
3. **Root Directory:** `backend`
4. **Framework Preset:** Other
5. En **Environment Variables** agrega:

```
DB_HOST       = 89.117.56.39
DB_PORT       = 3308
DB_NAME       = papeleria_app
DB_USER       = pos_user
DB_PASSWORD   = Pap3l3r!4#S3cur3_2026
API_SECRET    = POS_Api_S3cr3t_2026!
NODE_ENV      = production
```

6. Clic en **Deploy**
7. Copia tu URL: `https://papeleria-pos-backend.vercel.app`

### Verificar que funciona:
Abre en el navegador:
```
https://tu-backend.vercel.app/api/health
```
Debe responder:
```json
{"status":"ok","db":"connected","ts":"..."}
```

---

## ✅ PASO 4 — Deploy Frontend en Vercel

1. **Add New Project** → mismo repo `papeleria-pos`
2. **Root Directory:** `frontend`
3. **Framework Preset:** Other
4. Sin variables de entorno
5. Clic en **Deploy**

---

## ✅ PASO 5 — Conectar Frontend con Backend

Edita `frontend/index.html` — busca esta línea al inicio del script:

```javascript
const API_BASE = 'https://TU-BACKEND.vercel.app/api';
```

Reemplaza con tu URL real de Vercel backend, haz commit y push:

```bash
git add .
git commit -m "fix: conectar frontend con backend"
git push
```

Vercel redespliega automáticamente en ~1 minuto.

---

## 🔐 Credenciales (guárdalas seguro)

```
Servidor:     89.117.56.39
Puerto BD:    3308
BD:           papeleria_app
Usuario:      pos_user
Password:     Pap3l3r!4#S3cur3_2026
Root:         R00t#C0nt4b0_P0S!2026
API Secret:   POS_Api_S3cr3t_2026!
```

---

## 💰 Costo total
- Contabo: ya lo pagas
- GitHub: $0
- Vercel: $0
