import * as Print from 'expo-print';
import { CarReportData } from '../../../frontendServices/reportTypes';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatKm(km: number | null | undefined): string {
  if (km == null) return '—';
  return `${km.toLocaleString()} km`;
}

function formatCurrencyFromCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return `${(cents / 100).toFixed(2)} kr`;
}

export async function generateCarReportPdf(report: CarReportData): Promise<string> {
  const { car, careScore, serviceStatus, maintenanceEvents, incidents, obd, generatedAt } = report;

  const carTitle = `${car.merke} ${car.modell}`.trim();

  const maintenanceRows = maintenanceEvents
    .map(
      (e) => `
        <tr>
          <td>${escapeHtml(e.event_type)}</td>
          <td>${formatDate(e.event_date)}</td>
          <td>${formatKm(e.mileage)}</td>
          <td>${formatCurrencyFromCents(e.cost_cents)}</td>
          <td>${escapeHtml(e.vendor ?? '')}</td>
          <td>${escapeHtml(e.notes ?? '')}</td>
        </tr>
      `,
    )
    .join('');

  const incidentRows = incidents
    .map(
      (inc) => `
        <tr>
          <td>${formatDate(inc.incident_date)}</td>
          <td>${escapeHtml(inc.severity.toUpperCase())}</td>
          <td>${escapeHtml(inc.description)}</td>
          <td>${escapeHtml(inc.damage_description ?? '')}</td>
          <td>${escapeHtml(inc.repair_status)}</td>
          <td>${formatCurrencyFromCents(inc.repair_cost_cents)}</td>
          <td>${inc.mileage != null ? formatKm(inc.mileage) : '—'}</td>
          <td>${inc.insurance_claim ? 'Yes' : 'No'}</td>
        </tr>
      `,
    )
    .join('');

  const obdSnapshot = obd.effectiveSnapshot;
  const obdMetrics = obdSnapshot
    ? `
      <p><strong>Captured:</strong> ${formatDate(obdSnapshot.capturedAt)} (${obdSnapshot.source})</p>
      <ul>
        <li><strong>RPM:</strong> ${obdSnapshot.metrics.rpm ?? '—'}</li>
        <li><strong>Coolant:</strong> ${obdSnapshot.metrics.coolantTempC ?? '—'} °C</li>
        <li><strong>Speed:</strong> ${obdSnapshot.metrics.speedKph ?? '—'} km/h</li>
        <li><strong>Engine load:</strong> ${obdSnapshot.metrics.engineLoadPct ?? '—'} %</li>
        <li><strong>Battery voltage:</strong> ${obdSnapshot.metrics.batteryVoltage ?? '—'} V</li>
      </ul>
      <p><strong>Error codes (${obdSnapshot.dtcs.length}):</strong></p>
      ${
        obdSnapshot.dtcs.length
          ? `<ul>${obdSnapshot.dtcs
              .map((d) => `<li><strong>${escapeHtml(d.code)}:</strong> ${escapeHtml(d.description)}</li>`)
              .join('')}</ul>`
          : '<p>No stored trouble codes.</p>'
      }
    `
    : '<p>No OBD snapshot available.</p>';

  const scoreSection = careScore
    ? `
      <h2>Car Care Score</h2>
      <p><strong>Overall score:</strong> ${careScore.overall_score} (${escapeHtml(careScore.grade)})</p>
      <p><strong>Summary:</strong> ${escapeHtml(careScore.summary)}</p>
      <p><strong>Computed at:</strong> ${formatDate(careScore.computed_at)}</p>
      <h3>Categories</h3>
      <ul>
        <li><strong>${escapeHtml(careScore.categories.maintenance_regularity.label)}:</strong> ${
        careScore.categories.maintenance_regularity.score
      } / 100</li>
        <li><strong>${escapeHtml(careScore.categories.eu_inspection.label)}:</strong> ${
        careScore.categories.eu_inspection.score
      } / 100</li>
        <li><strong>${escapeHtml(careScore.categories.incident_history.label)}:</strong> ${
        careScore.categories.incident_history.score
      } / 100</li>
        <li><strong>${escapeHtml(careScore.categories.mileage_tracking.label)}:</strong> ${
        careScore.categories.mileage_tracking.score
      } / 100</li>
        <li><strong>${escapeHtml(careScore.categories.documentation_quality.label)}:</strong> ${
        careScore.categories.documentation_quality.score
      } / 100</li>
      </ul>
      ${
        careScore.recommendations.length
          ? `<h3>Recommendations</h3><ul>${careScore.recommendations
              .map((r) => `<li>${escapeHtml(r)}</li>`)
              .join('')}</ul>`
          : ''
      }
    `
    : '<h2>Car Care Score</h2><p>No score available.</p>';

  const serviceRows = serviceStatus?.services
    .map(
      (s) => `
        <tr>
          <td>${escapeHtml(s.event_type)}</td>
          <td>${formatDate(s.due_date)}</td>
          <td>${s.due_mileage != null ? formatKm(s.due_mileage) : '—'}</td>
          <td>${formatDate(s.last_date)}</td>
          <td>${s.last_mileage != null ? formatKm(s.last_mileage) : '—'}</td>
          <td>${s.urgency}</td>
        </tr>
      `,
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Car report - ${escapeHtml(carTitle)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #111827; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; }
          h3 { font-size: 15px; margin-top: 16px; margin-bottom: 6px; }
          p { font-size: 13px; line-height: 1.5; margin: 4px 0; }
          .meta { font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; font-weight: 600; }
          ul { padding-left: 18px; }
          .section-separator { margin-top: 24px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <h1>Car report</h1>
        <p class="meta">Generated at ${formatDate(generatedAt)}</p>

        <h2>Vehicle</h2>
        <p><strong>Registration:</strong> ${escapeHtml(car.registreringsnummer)}</p>
        <p><strong>Make / model:</strong> ${escapeHtml(car.merke)} ${escapeHtml(car.modell)}</p>
        <p><strong>Year:</strong> ${escapeHtml(car.arsmodell)}</p>
        <p><strong>Color:</strong> ${escapeHtml(car.farge)}</p>
        <p><strong>Odometer:</strong> ${formatKm(car.kilometer)}</p>
        <p><strong>VIN:</strong> ${escapeHtml(car.chassisnummer)}</p>
        <p><strong>Fuel / transmission:</strong> ${escapeHtml(car.drivstoff)} / ${escapeHtml(car.girkasse)}</p>
        <p><strong>EU inspection due:</strong> ${formatDate(car.eukontrollfrist)}</p>

        <div class="section-separator"></div>
        ${scoreSection}

        <div class="section-separator"></div>
        <h2>Service status</h2>
        ${
          serviceStatus
            ? `
            <p><strong>Current mileage:</strong> ${formatKm(serviceStatus.current_mileage)}</p>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Due date</th>
                  <th>Due mileage</th>
                  <th>Last date</th>
                  <th>Last mileage</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                ${serviceRows}
              </tbody>
            </table>
          `
            : '<p>No service status available.</p>'
        }

        <div class="section-separator"></div>
        <h2>Maintenance timeline</h2>
        ${
          maintenanceEvents.length
            ? `
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Mileage</th>
                  <th>Cost</th>
                  <th>Vendor</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${maintenanceRows}
              </tbody>
            </table>
          `
            : '<p>No maintenance events recorded.</p>'
        }

        <div class="section-separator"></div>
        <h2>Incidents</h2>
        ${
          incidents.length
            ? `
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Damage</th>
                  <th>Repair status</th>
                  <th>Repair cost</th>
                  <th>Mileage</th>
                  <th>Insurance claim</th>
                </tr>
              </thead>
              <tbody>
                ${incidentRows}
              </tbody>
            </table>
          `
            : '<p>No incidents reported.</p>'
        }

        <div class="section-separator"></div>
        <h2>OBD-II diagnostics</h2>
        ${obdMetrics}
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

