/**
 * jobs/alertas.job.js
 * Revisa cada mañana a las 7:00 AM qué vacunas vencen
 * en los próximos 7 días y envía alerta por email al ganadero.
 */
'use strict';

const cron = require('node-cron');
const repo = require('../modules/vacunas/vacunas.repository');
const { sendMail } = require('../config/mailer');
const logger = require('../utils/logger');
const { diasHasta } = require('../utils/calculos');

const procesarAlertas = async () => {
    logger.info('🔔  Job alertas: revisando vacunas pendientes...');

    try {
        const pendientes = await repo.findPendientesParaAlertar();

        if (pendientes.length === 0) {
            logger.info('✅  Job alertas: sin vacunas pendientes hoy.');
            return;
        }

        // Agrupar por usuario para enviar un solo correo por ganadero
        const porUsuario = pendientes.reduce((acc, v) => {
            if (!acc[v.usuario_id]) {
                acc[v.usuario_id] = { email: v.email, nombre: v.usuario_nombre, vacunas: [] };
            }
            acc[v.usuario_id].vacunas.push(v);
            return acc;
        }, {});

        for (const [usuarioId, datos] of Object.entries(porUsuario)) {
            try {
                await enviarCorreoAlerta(datos);

                // Marcar todas sus vacunas como alertadas
                for (const v of datos.vacunas) {
                    await repo.marcarAlertaEnviada(v.id);
                }

                logger.info(`📧  Alerta enviada a ${datos.email} (${datos.vacunas.length} vacuna(s))`);
            } catch (err) {
                logger.error(`❌  Error enviando alerta a usuario ${usuarioId}:`, err.message);
            }
        }

        logger.info(`✅  Job alertas: procesados ${Object.keys(porUsuario).length} usuario(s).`);
    } catch (err) {
        logger.error('❌  Job alertas falló:', err.message);
    }
};

const enviarCorreoAlerta = async ({ email, nombre, vacunas }) => {
    const filas = vacunas.map((v) => {
        const dias = diasHasta(v.proxima_dosis);
        const estado = dias < 0
            ? `<span style="color:#e53e3e">Vencida hace ${Math.abs(dias)} día(s)</span>`
            : dias === 0
                ? `<span style="color:#dd6b20">Vence HOY</span>`
                : `<span style="color:#d69e2e">Vence en ${dias} día(s)</span>`;

        return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${v.numero_arete} ${v.animal_nombre ? `(${v.animal_nombre})` : ''}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${v.tipo_vacuna}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${v.proxima_dosis}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${estado}</td>
      </tr>`;
    }).join('');

    const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#2d7a3a;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="color:white;margin:0">🐄 GanaderíaGT — Alerta de Vacunas</h2>
      </div>
      <div style="padding:20px;background:#f7fafc;border-radius:0 0 8px 8px">
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Tienes <strong>${vacunas.length}</strong> vacuna(s) que requieren atención:</p>
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px">
          <thead>
            <tr style="background:#e2e8f0">
              <th style="padding:10px;text-align:left">Animal</th>
              <th style="padding:10px;text-align:left">Vacuna</th>
              <th style="padding:10px;text-align:left">Fecha</th>
              <th style="padding:10px;text-align:left">Estado</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
        <p style="margin-top:20px;color:#718096;font-size:14px">
          Ingresa a GanaderíaGT para registrar las vacunas aplicadas.
        </p>
      </div>
    </div>`;

    await sendMail({
        to: email,
        subject: `🔔 GanaderíaGT — ${vacunas.length} vacuna(s) pendiente(s)`,
        html,
    });
};

/**
 * Registra el cron job.
 * Se llama desde server.js después de que el servidor levanta.
 * Horario: todos los días a las 7:00 AM (hora del servidor).
 */
const iniciarAlertas = () => {
    cron.schedule('0 7 * * *', procesarAlertas, {
        timezone: 'America/Guatemala',
    });
    logger.info('⏰  Job alertas registrado — corre cada día a las 7:00 AM (Guatemala)');
};

// Exportar procesarAlertas para poder ejecutarlo manualmente en tests
module.exports = { iniciarAlertas, procesarAlertas };