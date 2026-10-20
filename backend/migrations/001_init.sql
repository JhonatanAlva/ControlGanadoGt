-- ============================================================
--  GanaderíaGT - Schema PostgreSQL
--  Control Ganadero para fincas de Guatemala
-- ============================================================

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  ENUM TYPES
-- ============================================================

CREATE TYPE raza_animal AS ENUM (
  'Brahman', 'Holstein', 'Simmental', 'Charolais', 'Angus',
  'Cebu', 'Criollo', 'Brown Swiss', 'Gyr', 'Nelore', 'Otra'
);

CREATE TYPE sexo_animal AS ENUM ('Macho', 'Hembra');

CREATE TYPE tipo_animal AS ENUM (
  'Vaca', 'Toro', 'Novillo', 'Novilla', 'Ternero', 'Ternera', 'Buey'
);

CREATE TYPE estado_animal AS ENUM ('Activo', 'Vendido', 'Muerto', 'Robado');

CREATE TYPE proposito_animal AS ENUM (
  'Carne', 'Leche', 'Doble propósito', 'Reproducción'
);

CREATE TYPE tipo_vacuna AS ENUM (
  'Aftosa', 'Brucelosis', 'Carbunco', 'Rabia', 'IBR', 'DVB',
  'Leptospirosis', 'Clostridiosis', 'Desparasitante', 'Vitaminas', 'Otra'
);

CREATE TYPE via_aplicacion AS ENUM (
  'Subcutánea', 'Intramuscular', 'Oral', 'Intranasal'
);

CREATE TYPE tipo_reproduccion AS ENUM (
  'Monta natural', 'Inseminación artificial', 'Transferencia de embriones'
);

CREATE TYPE tipo_parto AS ENUM ('Normal', 'Distócico', 'Cesárea', 'Aborto');

CREATE TYPE resultado_parto AS ENUM ('Vivo', 'Muerto', 'Gemelar', 'Aborto');

CREATE TYPE categoria_gasto AS ENUM (
  'Alimentación', 'Veterinario', 'Vacunas', 'Medicamentos',
  'Mano de obra', 'Infraestructura', 'Transporte',
  'Compra de animales', 'Venta de animales', 'Otros'
);

CREATE TYPE tipo_movimiento AS ENUM ('Gasto', 'Ingreso');

CREATE TYPE tipo_post AS ENUM (
  'Precio de mercado', 'Alerta sanitaria', 'Venta de animal',
  'Compra de animal', 'Consejo', 'Pregunta'
);

CREATE TYPE region_guatemala AS ENUM (
  'Alta Verapaz', 'Baja Verapaz', 'Chiquimula', 'El Progreso',
  'Escuintla', 'Guatemala', 'Huehuetenango', 'Izabal', 'Jalapa',
  'Jutiapa', 'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu',
  'Sacatepéquez', 'San Marcos', 'Santa Rosa', 'Sololá',
  'Suchitepéquez', 'Totonicapán', 'Zacapa'
);

-- ============================================================
--  TABLA: usuarios
--  Ganaderos que usan la aplicación
-- ============================================================

CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        VARCHAR(150) NOT NULL,
  telefono      VARCHAR(20),
  email         VARCHAR(255) UNIQUE,
  password_hash TEXT,
  region        region_guatemala,
  whatsapp      VARCHAR(20),
  foto_url      TEXT,
  plan          VARCHAR(20) NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free', 'pro')),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE usuarios IS 'Ganaderos registrados en la plataforma';

-- ============================================================
--  TABLA: fincas
--  Una finca pertenece a un usuario (o puede ser compartida)
-- ============================================================

CREATE TABLE fincas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre        VARCHAR(200) NOT NULL,
  ubicacion     TEXT,
  region        region_guatemala,
  hectareas     NUMERIC(10,2),
  notas         TEXT,
  activa        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fincas IS 'Fincas ganaderas del usuario';

-- ============================================================
--  TABLA: animales
-- ============================================================

CREATE TABLE animales (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id       UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  finca_id         UUID REFERENCES fincas(id) ON DELETE SET NULL,

  -- Identificación
  numero_arete     VARCHAR(50) NOT NULL,
  nombre           VARCHAR(100),

  -- Clasificación
  raza             raza_animal NOT NULL,
  sexo             sexo_animal NOT NULL,
  tipo             tipo_animal NOT NULL,
  proposito        proposito_animal,
  estado           estado_animal NOT NULL DEFAULT 'Activo',

  -- Datos físicos
  fecha_nacimiento DATE,
  peso_actual      NUMERIC(8,2),       -- libras
  peso_compra      NUMERIC(8,2),       -- libras

  -- Datos financieros
  precio_compra    NUMERIC(12,2),      -- quetzales
  precio_venta     NUMERIC(12,2),
  fecha_venta      DATE,

  -- Genealogía (auto-referencia)
  madre_id         UUID REFERENCES animales(id) ON DELETE SET NULL,
  padre_id         UUID REFERENCES animales(id) ON DELETE SET NULL,
  madre_arete      VARCHAR(50),        -- Cuando la madre no está en el sistema
  padre_arete      VARCHAR(50),        -- Cuando el padre no está en el sistema

  -- Procedencia
  procedencia      TEXT,

  -- Media y notas
  foto_url         TEXT,
  notas            TEXT,

  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un arete es único por usuario
  CONSTRAINT uq_arete_usuario UNIQUE (usuario_id, numero_arete)
);

COMMENT ON TABLE animales IS 'Registro individual de cada animal en la finca';
COMMENT ON COLUMN animales.peso_actual IS 'Peso en libras';
COMMENT ON COLUMN animales.precio_compra IS 'Precio en quetzales GTQ';

-- ============================================================
--  TABLA: vacunas
-- ============================================================

CREATE TABLE vacunas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id        UUID NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  finca_id         UUID REFERENCES fincas(id) ON DELETE SET NULL,

  tipo_vacuna      tipo_vacuna NOT NULL,
  nombre_producto  VARCHAR(200),
  lote             VARCHAR(100),

  fecha_aplicacion DATE NOT NULL,
  proxima_dosis    DATE,
  alerta_enviada   BOOLEAN NOT NULL DEFAULT FALSE,

  dosis            VARCHAR(50),        -- ej: "2ml"
  via_aplicacion   via_aplicacion,

  veterinario      VARCHAR(150),
  costo            NUMERIC(10,2),      -- quetzales
  notas            TEXT,

  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vacunas IS 'Historial de vacunación y desparasitación por animal';

-- ============================================================
--  TABLA: partos
-- ============================================================

CREATE TABLE partos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  madre_id             UUID NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  padre_id             UUID REFERENCES animales(id) ON DELETE SET NULL,
  padre_arete          VARCHAR(50),    -- Si el padre no está en el sistema
  finca_id             UUID REFERENCES fincas(id) ON DELETE SET NULL,

  tipo_reproduccion    tipo_reproduccion NOT NULL,

  fecha_servicio       DATE,
  fecha_parto_esperada DATE,           -- fecha_servicio + 280 días
  fecha_parto          DATE,

  tipo_parto           tipo_parto,
  resultado            resultado_parto,

  -- Cría registrada al nacer
  cria_id              UUID REFERENCES animales(id) ON DELETE SET NULL,
  cria_arete           VARCHAR(50),
  cria_sexo            sexo_animal,
  peso_nacimiento      NUMERIC(8,2),   -- libras

  -- Veterinario
  asistencia_veterinaria BOOLEAN NOT NULL DEFAULT FALSE,
  costo_veterinario    NUMERIC(10,2),

  notas                TEXT,

  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE partos IS 'Registro de partos, servicios e inseminaciones';

-- ============================================================
--  TABLA: gastos
--  Gastos e ingresos de la finca
-- ============================================================

CREATE TABLE gastos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  finca_id      UUID REFERENCES fincas(id) ON DELETE SET NULL,
  animal_id     UUID REFERENCES animales(id) ON DELETE SET NULL,

  tipo          tipo_movimiento NOT NULL DEFAULT 'Gasto',
  categoria     categoria_gasto NOT NULL,
  descripcion   TEXT,
  monto         NUMERIC(12,2) NOT NULL CHECK (monto > 0),  -- quetzales
  fecha         DATE NOT NULL,

  proveedor     VARCHAR(200),
  factura       VARCHAR(100),
  notas         TEXT,

  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gastos IS 'Control financiero: gastos e ingresos de la operación';

-- ============================================================
--  TABLA: comunidad_posts
-- ============================================================

CREATE TABLE comunidad_posts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  autor_id          UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  tipo              tipo_post NOT NULL,
  titulo            VARCHAR(255) NOT NULL,
  contenido         TEXT NOT NULL,
  region            region_guatemala NOT NULL,

  -- Datos específicos de compra/venta
  precio            NUMERIC(12,2),
  raza_animal       VARCHAR(100),
  peso_animal       NUMERIC(8,2),

  foto_url          TEXT,
  contacto_whatsapp VARCHAR(20),

  likes             INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  activo            BOOLEAN NOT NULL DEFAULT TRUE,

  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE comunidad_posts IS 'Foro comunitario: precios, alertas, compra-venta';

-- ============================================================
--  TABLA: comunidad_likes
--  Evitar likes duplicados por usuario
-- ============================================================

CREATE TABLE comunidad_likes (
  post_id    UUID NOT NULL REFERENCES comunidad_posts(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, usuario_id)
);

-- ============================================================
--  TABLA: pesos_historico
--  Registro de pesajes a lo largo del tiempo
-- ============================================================

CREATE TABLE pesos_historico (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id  UUID NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  peso       NUMERIC(8,2) NOT NULL,  -- libras
  fecha      DATE NOT NULL,
  notas      TEXT,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pesos_historico IS 'Historial de pesajes para seguimiento de ganancia de peso';

-- ============================================================
--  ÍNDICES
-- ============================================================

-- Animales
CREATE INDEX idx_animales_usuario    ON animales(usuario_id);
CREATE INDEX idx_animales_finca      ON animales(finca_id);
CREATE INDEX idx_animales_estado     ON animales(estado);
CREATE INDEX idx_animales_tipo       ON animales(tipo);
CREATE INDEX idx_animales_raza       ON animales(raza);
CREATE INDEX idx_animales_arete      ON animales(numero_arete);
CREATE INDEX idx_animales_madre      ON animales(madre_id);

-- Vacunas
CREATE INDEX idx_vacunas_animal      ON vacunas(animal_id);
CREATE INDEX idx_vacunas_proxima     ON vacunas(proxima_dosis) WHERE proxima_dosis IS NOT NULL;
CREATE INDEX idx_vacunas_alerta      ON vacunas(alerta_enviada) WHERE alerta_enviada = FALSE;

-- Partos
CREATE INDEX idx_partos_madre        ON partos(madre_id);
CREATE INDEX idx_partos_fecha        ON partos(fecha_parto);
CREATE INDEX idx_partos_esperada     ON partos(fecha_parto_esperada);

-- Gastos
CREATE INDEX idx_gastos_usuario      ON gastos(usuario_id);
CREATE INDEX idx_gastos_finca        ON gastos(finca_id);
CREATE INDEX idx_gastos_fecha        ON gastos(fecha);
CREATE INDEX idx_gastos_categoria    ON gastos(categoria);
CREATE INDEX idx_gastos_animal       ON gastos(animal_id);

-- Comunidad
CREATE INDEX idx_posts_region        ON comunidad_posts(region);
CREATE INDEX idx_posts_tipo          ON comunidad_posts(tipo);
CREATE INDEX idx_posts_autor         ON comunidad_posts(autor_id);
CREATE INDEX idx_posts_activo        ON comunidad_posts(activo) WHERE activo = TRUE;

-- Pesos histórico
CREATE INDEX idx_pesos_animal        ON pesos_historico(animal_id);
CREATE INDEX idx_pesos_fecha         ON pesos_historico(fecha);

-- Fincas
CREATE INDEX idx_fincas_usuario      ON fincas(usuario_id);

-- ============================================================
--  FUNCIONES Y TRIGGERS
-- ============================================================

-- Función para actualizar columna actualizado_en automáticamente
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con actualizado_en
CREATE TRIGGER trg_usuarios_updated
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_fincas_updated
  BEFORE UPDATE ON fincas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_animales_updated
  BEFORE UPDATE ON animales
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_vacunas_updated
  BEFORE UPDATE ON vacunas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_partos_updated
  BEFORE UPDATE ON partos
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_gastos_updated
  BEFORE UPDATE ON gastos
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_posts_updated
  BEFORE UPDATE ON comunidad_posts
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- Función: calcular fecha de parto esperada automáticamente (280 días)
CREATE OR REPLACE FUNCTION calcular_fecha_parto_esperada()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fecha_servicio IS NOT NULL AND NEW.fecha_parto_esperada IS NULL THEN
    NEW.fecha_parto_esperada = NEW.fecha_servicio + INTERVAL '280 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parto_fecha_esperada
  BEFORE INSERT OR UPDATE ON partos
  FOR EACH ROW EXECUTE FUNCTION calcular_fecha_parto_esperada();

-- Función: sincronizar peso_actual del animal al registrar un pesaje
CREATE OR REPLACE FUNCTION sync_peso_animal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE animales
  SET peso_actual = NEW.peso, actualizado_en = NOW()
  WHERE id = NEW.animal_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_peso
  AFTER INSERT ON pesos_historico
  FOR EACH ROW EXECUTE FUNCTION sync_peso_animal();

-- Función: sincronizar contador de likes en el post
CREATE OR REPLACE FUNCTION sync_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comunidad_posts SET likes = likes + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comunidad_posts SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_likes
  AFTER INSERT OR DELETE ON comunidad_likes
  FOR EACH ROW EXECUTE FUNCTION sync_likes_count();

-- ============================================================
--  VISTAS ÚTILES
-- ============================================================

-- Vista: animales activos con info de finca
CREATE VIEW v_animales_activos AS
SELECT
  a.id,
  a.numero_arete,
  a.nombre,
  a.raza,
  a.sexo,
  a.tipo,
  a.proposito,
  a.estado,
  a.fecha_nacimiento,
  DATE_PART('year', AGE(a.fecha_nacimiento))::INT AS edad_anios,
  a.peso_actual,
  a.precio_compra,
  f.nombre AS finca_nombre,
  u.nombre AS propietario
FROM animales a
LEFT JOIN fincas f ON f.id = a.finca_id
LEFT JOIN usuarios u ON u.id = a.usuario_id
WHERE a.estado = 'Activo';

-- Vista: vacunas pendientes (próxima dosis en los próximos 30 días o vencidas)
CREATE VIEW v_vacunas_pendientes AS
SELECT
  v.id,
  a.numero_arete,
  a.nombre AS animal_nombre,
  v.tipo_vacuna,
  v.nombre_producto,
  v.proxima_dosis,
  CASE
    WHEN v.proxima_dosis < CURRENT_DATE THEN 'Vencida'
    WHEN v.proxima_dosis <= CURRENT_DATE + 7 THEN 'Esta semana'
    ELSE 'Próxima'
  END AS urgencia,
  f.nombre AS finca_nombre,
  a.usuario_id
FROM vacunas v
JOIN animales a ON a.id = v.animal_id
LEFT JOIN fincas f ON f.id = v.finca_id
WHERE v.proxima_dosis IS NOT NULL
  AND v.proxima_dosis <= CURRENT_DATE + 30;

-- Vista: balance mensual por usuario
CREATE VIEW v_balance_mensual AS
SELECT
  usuario_id,
  finca_id,
  DATE_TRUNC('month', fecha) AS mes,
  SUM(CASE WHEN tipo = 'Ingreso' THEN monto ELSE 0 END) AS total_ingresos,
  SUM(CASE WHEN tipo = 'Gasto'   THEN monto ELSE 0 END) AS total_gastos,
  SUM(CASE WHEN tipo = 'Ingreso' THEN monto ELSE -monto END) AS balance
FROM gastos
GROUP BY usuario_id, finca_id, DATE_TRUNC('month', fecha);

-- Vista: partos próximos (próximos 30 días)
CREATE VIEW v_partos_proximos AS
SELECT
  p.id,
  a.numero_arete AS madre_arete,
  a.nombre AS madre_nombre,
  p.fecha_parto_esperada,
  p.tipo_reproduccion,
  f.nombre AS finca_nombre,
  a.usuario_id,
  (p.fecha_parto_esperada - CURRENT_DATE) AS dias_restantes
FROM partos p
JOIN animales a ON a.id = p.madre_id
LEFT JOIN fincas f ON f.id = p.finca_id
WHERE p.fecha_parto IS NULL
  AND p.fecha_parto_esperada IS NOT NULL
  AND p.fecha_parto_esperada <= CURRENT_DATE + 30
ORDER BY p.fecha_parto_esperada;

-- ============================================================
--  FIN DEL SCHEMA
-- ============================================================