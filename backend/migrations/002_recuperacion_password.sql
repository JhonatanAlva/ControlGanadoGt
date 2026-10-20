-- ============================================================
--  002 — Recuperación de contraseña por código enviado al correo
-- ============================================================

CREATE TABLE password_resets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash  TEXT NOT NULL,            -- HMAC del código, nunca el código en claro
  expira_en    TIMESTAMPTZ NOT NULL,
  intentos     INTEGER NOT NULL DEFAULT 0,
  usado_en     TIMESTAMPTZ,              -- NULL = vigente
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE password_resets IS 'Códigos de un solo uso para restablecer contraseña';

CREATE INDEX idx_password_resets_usuario ON password_resets(usuario_id, creado_en DESC);
