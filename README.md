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

En `backend/.env`:
- `DB_USER`/`DB_PASSWORD` son el `APP_DB_USER`/`APP_DB_PASSWORD` del `.env` de la raíz. El API usa un usuario de **permisos mínimos**, nunca el superusuario de PostgreSQL.
- `JWT_SECRET` debe ser igual en ambos archivos y tener al menos 32 caracteres, o el backend no arranca.

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

**Recuperar contraseña en desarrollo:** si no hay `MAIL_USER` en `backend/.env`, el código de 6 dígitos aparece en la consola del backend en lugar de enviarse por correo.

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

## Migraciones en una base existente

Docker solo ejecuta `backend/migrations/` la primera vez que crea el volumen. Para aplicar una migración nueva a una base que ya existe:

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/00X_nombre.sql'
```

## Pruebas y lint

```bash
cd backend
npm test        # pruebas de seguridad contra la base de desarrollo (requiere postgres arriba)
npm run lint
```

## Respaldos cifrados

```bash
./scripts/respaldo-db.sh                                    # crea respaldo cifrado en respaldos/
./scripts/respaldo-db.sh restaurar respaldos/<archivo>.enc  # restaura (reemplaza los datos)
```

Usa `BACKUP_PASSPHRASE` del `.env`. **Guarda esa frase también en un gestor de contraseñas:** sin ella los respaldos no se pueden abrir. Copia los respaldos fuera de esta computadora (disco externo o nube).

## Cifrado de la base local del teléfono

La caché offline (SQLite) se cifra con SQLCipher, y la clave vive en el Keystore del teléfono. **Expo Go no incluye SQLCipher**, así que ahí la base local no se cifra (aparece un aviso en consola). El cifrado se activa en un build propio:

```bash
cd frontend
npx expo run:android      # build de desarrollo con módulos nativos
```

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
