/**
 * tests/fincaActiva.test.js
 * Filtro por finca en listados y resúmenes.
 */
"use strict";

process.env.NODE_ENV = "test";
jest.mock("../src/config/mailer", () => ({ sendMail: jest.fn().mockResolvedValue({}) }));

const request = require("supertest");
const app = require("../src/app");
const { pool } = require("../src/config/db");

const API = "/api/v1";
const email = `finca${Date.now()}${Math.floor(Math.random() * 1000)}@test.gt`;
const anio = new Date().getFullYear();
const hoy = new Date().toISOString().slice(0, 10);

let h;
let finca1;
let finca2;

const ids = (res) => res.body.data.map((x) => x.id).sort();

beforeAll(async () => {
  const reg = await request(app).post(`${API}/auth/registro`).send({ nombre: "Multi Finca", email, password: "Ganado2026seguro" });
  h = { Authorization: `Bearer ${reg.body.data.token}` };
  // Plan pro para poder tener más de una finca
  await pool.query("UPDATE usuarios SET plan = 'pro' WHERE email = $1", [email]);

  finca1 = (await request(app).post(`${API}/fincas`).set(h).send({ nombre: "El Roble" })).body.data.finca.id;
  finca2 = (await request(app).post(`${API}/fincas`).set(h).send({ nombre: "La Ceiba" })).body.data.finca.id;
});

afterAll(async () => {
  await pool.query("DELETE FROM usuarios WHERE email = $1", [email]);
  await pool.end();
});

test("animales, vacunas, partos y gastos se filtran por la finca del animal", async () => {
  const crearVaca = async (arete, fincaId) =>
    (await request(app).post(`${API}/animales`).set(h)
      .send({ numero_arete: arete, raza: "Brahman", sexo: "Hembra", tipo: "Vaca", finca_id: fincaId })).body.data.animal.id;
  const vaca1 = await crearVaca("R-1", finca1);
  const vaca2 = await crearVaca("C-1", finca2);

  // Vacunas y servicios SIN finca_id propio: deben seguir la finca del animal
  const proxima = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const vac1 = await request(app).post(`${API}/vacunas`).set(h)
    .send({ animal_id: vaca1, tipo_vacuna: "Aftosa", fecha_aplicacion: hoy, proxima_dosis: proxima });
  const vac2 = await request(app).post(`${API}/vacunas`).set(h)
    .send({ animal_id: vaca2, tipo_vacuna: "Rabia", fecha_aplicacion: hoy, proxima_dosis: proxima });
  const par1 = await request(app).post(`${API}/partos/servicio`).set(h)
    .send({ madre_id: vaca1, tipo_reproduccion: "Monta natural", fecha_servicio: hoy });

  // Gasto ligado solo al animal (sin finca) y gasto directo en la otra finca
  const gas1 = await request(app).post(`${API}/gastos`).set(h)
    .send({ categoria: "Veterinario", monto: 100, fecha: hoy, animal_id: vaca1 });
  const gas2 = await request(app).post(`${API}/gastos`).set(h)
    .send({ categoria: "Alimentación", monto: 250, fecha: hoy, finca_id: finca2 });

  const f1 = { finca_id: finca1 };
  expect(ids(await request(app).get(`${API}/animales`).set(h).query(f1))).toEqual([vaca1]);
  expect(ids(await request(app).get(`${API}/vacunas`).set(h).query(f1))).toEqual([vac1.body.data.vacuna.id]);
  expect(ids(await request(app).get(`${API}/partos`).set(h).query(f1))).toEqual([par1.body.data.parto.id]);
  expect(ids(await request(app).get(`${API}/gastos`).set(h).query(f1))).toEqual([gas1.body.data.gasto.id]);

  // Sin filtro se ven ambas fincas
  expect(ids(await request(app).get(`${API}/vacunas`).set(h))).toEqual(
    [vac1.body.data.vacuna.id, vac2.body.data.vacuna.id].sort(),
  );
  expect(ids(await request(app).get(`${API}/gastos`).set(h))).toHaveLength(2);
  expect(gas2.status).toBe(201);
});

test("los resúmenes financieros respetan la finca", async () => {
  const mensual = async (q) =>
    (await request(app).get(`${API}/gastos/resumen/mensual`).set(h).query({ anio, ...q })).body.data.totales.total_gastos;
  expect(await mensual({})).toBe(350);
  expect(await mensual({ finca_id: finca1 })).toBe(100);
  expect(await mensual({ finca_id: finca2 })).toBe(250);

  const cat = await request(app).get(`${API}/gastos/resumen/categoria`).set(h).query({ finca_id: finca2 });
  expect(cat.body.data.categorias.map((c) => c.categoria)).toEqual(["Alimentación"]);
});

test("finca_id inválido en el resumen responde 422", async () => {
  const res = await request(app).get(`${API}/gastos/resumen/mensual`).set(h).query({ finca_id: "no-es-uuid" });
  expect(res.status).toBe(422);
});
