# 🏪 PapeleríaPOS

Sistema POS completo — HTML/CSS/JS + Node.js/Express + MariaDB

## Stack
- **Frontend:** HTML puro → Vercel Static
- **Backend:** Node.js/Express → Vercel Serverless
- **Base de datos:** MariaDB en Contabo (Docker aislado)

## Estructura
```
papeleria-pos/
├── frontend/
│   └── index.html        ← App POS completa
├── backend/
│   ├── api/
│   │   └── index.js      ← API REST completa
│   ├── package.json
│   ├── vercel.json
│   └── .env.example
└── schema.sql            ← Ejecutar en MariaDB
```

## Ver INSTRUCCIONES.md para el deploy completo
