/**
 * tests/seguridad.test.js
 * Pruebas de seguridad contra la base de datos de desarrollo (backend/.env).
 * Crea usuarios con emails únicos y los borra al terminar.
 *
 *   docker compose up -d postgres
 *   npm test
 */
"use strict";

process.env.NODE_ENV = "test";

// Captura los correos en lugar de enviarlos (el código de recuperación viaja por aquí)
jest.mock("../src/config/mailer", () => ({ sendMail: jest.fn().mockResolvedValue({}) }));

const request = require("supertest");
const app = require("../src/app");
const { pool } = require("../src/config/db");
const { sendMail } = require("../src/config/mailer");

const API = "/api/v1";
const sufijo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const emailA = `a${sufijo}@test.gt`;
const emailB = `b${sufijo}@test.gt`;
const PASS = "Ganado2026seguro";

const auth = (token) => ({ Authorization: `Bearer ${token}` });

let tokenA;
let tokenB;
let fincaB;
let vacaB;

beforeAll(async () => {
  const a = await request(app).post(`${API}/auth/registro`).send({ nombre: "Ganadero A", email: emailA, password: PASS });
  const b = await request(app).post(`${API}/auth/registro`).send({ nombre: "Ganadero B", email: emailB, password: PASS });
  tokenA = a.body.data.token;
  tokenB = b.body.data.token;

  const finca = await request(app).post(`${API}/fincas`).set(auth(tokenB)).send({ nombre: "Finca de B" });
  fincaB = finca.body.data.finca.id;
  const vaca = await request(app).post(`${API}/animales`).set(auth(tokenB))
    .send({ numero_arete: "B-001", raza: "Brahman", sexo: "Hembra", tipo: "Vaca", finca_id: fincaB });
  vacaB = vaca.body.data.animal.id;
});

afterAll(async () => {
  await pool.query("DELETE FROM usuarios WHERE email IN ($1, $2)", [emailA, emailB]);
  await pool.end();
});

describe("Validación", () => {
  test("datos inválidos responden 422 con detalle (no 500)", async () => {
    const res = await request(app).post(`${API}/auth/registro`).send({ nombre: "X", email: "no-es-email", password: "1" });
    expect(res.status).toBe(422);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test.each(["corta1", "solamenteletras", "1234567890"])("rechaza contraseña débil: %s", async (password) => {
    const res = await request(app).post(`${API}/auth/registro`).send({ nombre: "Débil", email: `d${sufijo}@test.gt`, password });
    expect(res.status).toBe(422);
  });

  test("ignora campos no permitidos (no se puede autoasignar plan pro)", async () => {
    await request(app).put(`${API}/auth/me`).set(auth(tokenA)).send({ plan: "pro", activo: false });
    const me = await request(app).get(`${API}/auth/me`).set(auth(tokenA));
    expect(me.body.data.usuario.plan).toBe("free");
  });
});

describe("Aislamiento entre ganaderos", () => {
  test("A no puede ver la vaca de B", async () => {
    const res = await request(app).get(`${API}/animales/${vacaB}`).set(auth(tokenA));
    expect(res.status).toBe(404);
  });

  test("A no puede ver la finca de B", async () => {
    const res = await request(app).get(`${API}/fincas/${fincaB}`).set(auth(tokenA));
    expect(res.status).toBe(404);
  });

  test("A no puede crear un animal en la finca de B", async () => {
    const res = await request(app).post(`${API}/animales`).set(auth(tokenA))
      .send({ numero_arete: "A-001", raza: "Angus", sexo: "Macho", tipo: "Toro", finca_id: fincaB });
    expect(res.status).toBe(404);
  });

  test("A no puede usar la vaca de B como madre", async () => {
    const res = await request(app).post(`${API}/animales`).set(auth(tokenA))
      .send({ numero_arete: "A-002", raza: "Angus", sexo: "Hembra", tipo: "Ternera", madre_id: vacaB });
    expect(res.status).toBe(404);
  });

  test("A no puede registrar vacuna, servicio ni gasto sobre recursos de B", async () => {
    const vacuna = await request(app).post(`${API}/vacunas`).set(auth(tokenA))
      .send({ animal_id: vacaB, tipo_vacuna: "Aftosa", fecha_aplicacion: "2026-10-01" });
    const servicio = await request(app).post(`${API}/partos/servicio`).set(auth(tokenA))
      .send({ madre_id: vacaB, tipo_reproduccion: "Monta natural", fecha_servicio: "2026-10-01" });
    const gasto = await request(app).post(`${API}/gastos`).set(auth(tokenA))
      .send({ categoria: "Otros", monto: 10, fecha: "2026-10-01", finca_id: fincaB });
    expect([vacuna.status, servicio.status, gasto.status]).toEqual([404, 404, 404]);
  });

  test("A no puede mover su propio gasto a la finca de B", async () => {
    const gasto = await request(app).post(`${API}/gastos`).set(auth(tokenA))
      .send({ categoria: "Otros", monto: 10, fecha: "2026-10-01" });
    const res = await request(app).put(`${API}/gastos/${gasto.body.data.gasto.id}`).set(auth(tokenA))
      .send({ finca_id: fincaB });
    expect(res.status).toBe(404);
  });

  test("A no puede modificar ni borrar la vaca de B", async () => {
    const put = await request(app).put(`${API}/animales/${vacaB}`).set(auth(tokenA)).send({ nombre: "Robada" });
    const del = await request(app).delete(`${API}/animales/${vacaB}`).set(auth(tokenA));
    expect([put.status, del.status]).toEqual([404, 404]);
  });
});

describe("Tokens", () => {
  test("sin token → 401", async () => {
    expect((await request(app).get(`${API}/animales`)).status).toBe(401);
  });

  test("token manipulado → 401", async () => {
    const res = await request(app).get(`${API}/auth/me`).set(auth(tokenA.slice(0, -3) + "abc"));
    expect(res.status).toBe(401);
  });

  test('token con algoritmo "none" → 401', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const [, payload] = tokenA.split(".");
    const falso = `${b64({ alg: "none", typ: "JWT" })}.${payload}.`;
    expect((await request(app).get(`${API}/auth/me`).set(auth(falso))).status).toBe(401);
  });

  test("login con email inexistente y con contraseña incorrecta dan el mismo mensaje", async () => {
    const noExiste = await request(app).post(`${API}/auth/login`).send({ email: `nadie${sufijo}@test.gt`, password: PASS });
    const malPass = await request(app).post(`${API}/auth/login`).send({ email: emailA, password: "Incorrecta123" });
    expect(noExiste.status).toBe(401);
    expect(noExiste.body.message).toBe(malPass.body.message);
  });
});

describe("Recuperación de contraseña", () => {
  const ultimoCodigo = () => sendMail.mock.calls.at(-1)[0].text.match(/\d{6}/)[0];

  test("responde igual exista o no el email", async () => {
    const noExiste = await request(app).post(`${API}/auth/recuperar`).send({ email: `nadie${sufijo}@test.gt` });
    const existe = await request(app).post(`${API}/auth/recuperar`).send({ email: emailB });
    expect(noExiste.status).toBe(200);
    expect(existe.body.message).toBe(noExiste.body.message);
  });

  test("el código en la base de datos no está en claro", async () => {
    const codigo = ultimoCodigo();
    const { rows } = await pool.query(
      `SELECT pr.codigo_hash FROM password_resets pr JOIN usuarios u ON u.id = pr.usuario_id
       WHERE u.email = $1 AND pr.usado_en IS NULL`,
      [emailB],
    );
    expect(rows[0].codigo_hash).not.toContain(codigo);
  });

  test("código incorrecto → 400, y se bloquea tras 5 intentos aunque luego llegue el correcto", async () => {
    const codigo = ultimoCodigo();
    const incorrecto = codigo === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post(`${API}/auth/restablecer`)
        .send({ email: emailB, codigo: incorrecto, passwordNueva: "NuevaClave2026" });
      expect(res.status).toBe(400);
    }
    const correcto = await request(app).post(`${API}/auth/restablecer`)
      .send({ email: emailB, codigo, passwordNueva: "NuevaClave2026" });
    expect(correcto.status).toBe(400);
  });

  test("código correcto cambia la contraseña, cierra sesiones y es de un solo uso", async () => {
    await request(app).post(`${API}/auth/recuperar`).send({ email: emailB });
    const codigo = ultimoCodigo();
    const body = { email: emailB, codigo, passwordNueva: "NuevaClave2026" };

    expect((await request(app).post(`${API}/auth/restablecer`).send(body)).status).toBe(200);
    expect((await request(app).post(`${API}/auth/restablecer`).send(body)).status).toBe(400);
    expect((await request(app).get(`${API}/auth/me`).set(auth(tokenB))).status).toBe(401);

    const login = await request(app).post(`${API}/auth/login`).send({ email: emailB, password: "NuevaClave2026" });
    expect(login.status).toBe(200);
  });
});

describe("Cambio de contraseña", () => {
  test("invalida el token anterior y entrega uno nuevo", async () => {
    const res = await request(app).put(`${API}/auth/password`).set(auth(tokenA))
      .send({ passwordActual: PASS, passwordNueva: "OtraClave2026x" });
    expect(res.status).toBe(200);
    expect((await request(app).get(`${API}/auth/me`).set(auth(tokenA))).status).toBe(401);
    expect((await request(app).get(`${API}/auth/me`).set(auth(res.body.data.token))).status).toBe(200);
  });
});

describe("Información expuesta", () => {
  test("/health no revela el entorno", async () => {
    const res = await request(app).get("/health");
    expect(res.body).not.toHaveProperty("env");
  });

  test("cabeceras de seguridad de helmet presentes y sin X-Powered-By", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
