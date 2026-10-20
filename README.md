# GanaderíaGT

Control ganadero para fincas de Guatemala. Backend Node.js + PostgreSQL, app móvil Expo (React Native).

## Requisitos

- Docker Desktop
- Node.js 20 o superior
- Emulador Android (Android Studio) o la app Expo Go en tu celular

## Primera vez

```bash
# 1. Variables de entorno (llena los valores vacíos)
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Genera cada secreto con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`DB_PASSWORD` y `JWT_SECRET` deben ser iguales en `.env` y `backend/.env`. `JWT_SECRET` necesita al menos 32 caracteres o el backend no arranca.

```bash
# 2. Dependencias
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

## Desarrollo (día a día)

```bash
# Base de datos (crea las tablas la primera vez con backend/migrations/)
docker compose up -d postgres

# Backend con recarga automática → http://localhost:3000/health
cd backend && npm run dev

# App móvil (otra terminal) → presiona "a" para abrir el emulador Android
cd frontend && npx expo start
```

pgAdmin no arranca por defecto. Cuando lo necesites:

```bash
docker compose --profile tools up -d pgadmin   # http://localhost:5050
```

En pgAdmin, el host del servidor es `postgres` y el puerto `5432`.

### Probar en un celular físico

Todos los puertos están limitados a `127.0.0.1`, así que nadie en tu red puede llegar a la base de datos ni al API. Para usar un celular en la misma Wi-Fi:

1. Corre el backend con `npm run dev`, que escucha en todas las interfaces de tu PC.
2. En `frontend/.env` pon `EXPO_PUBLIC_API_URL=http://<IP-de-tu-PC>:3000/api/v1`.
3. Permite el puerto 3000 en el Firewall de Windows **solo para redes privadas**.

## Todo en Docker (modo producción local)

```bash
docker compose up -d --build   # postgres + backend en NODE_ENV=production
```

Detén antes `npm run dev`, porque ambos usan el puerto 3000.

## Seguridad: checklist antes de producción

- [ ] Secretos únicos generados para producción (nunca reutilizar los de desarrollo).
- [ ] API detrás de HTTPS (Nginx/Caddy o la plataforma de hosting) y `TRUST_PROXY=1`.
- [ ] `EXPO_PUBLIC_API_URL` con `https://`; la app se niega a arrancar en producción sin HTTPS.
- [ ] `DB_SSL=true` si PostgreSQL está en otro servidor.
- [ ] Respaldos automáticos y cifrados de la base de datos.
- [ ] Puerto de PostgreSQL y pgAdmin nunca expuestos a internet.
