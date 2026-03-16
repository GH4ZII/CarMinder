from datetime import datetime
from typing import Any, Dict, List, Optional

from exceptions import NotFoundError
from repositories import (
    car_repository,
    incident_repository,
    maintenance_repository,
    obd_repository,
)
from schemas.car_score import CarCareScoreResponse
from services.scoring_service import compute_car_care_score
from services.service_interval_service import get_car_service_status


def _format_date(dt_str: Optional[str]) -> str:
    if not dt_str:
        return "—"
    try:
        # Accept both date and datetime strings
        if "T" in dt_str:
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(dt_str)
        return dt.strftime("%Y-%b-%d")
    except Exception:
        return dt_str


def _format_km(km: Optional[int]) -> str:
    if km is None:
        return "—"
    return f"{km:,} km".replace(",", " ")


def _format_currency_from_cents(cents: Optional[int]) -> str:
    if cents is None:
        return "—"
    return f"{cents / 100:.2f} kr"


def _escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _build_html(
    car: Dict[str, Any],
    care_score: Optional[CarCareScoreResponse],
    service_status: Optional[Dict[str, Any]],
    maintenance_events: List[Dict[str, Any]],
    incidents: List[Dict[str, Any]],
    obd_reading: Optional[Dict[str, Any]],
) -> str:
    car_title = f"{car.get('merke', '')} {car.get('modell', '')}".strip()
    generated_at = datetime.utcnow().isoformat()

    maintenance_rows = "".join(
        f"""
        <tr>
          <td>{_escape_html(e.get('event_type', ''))}</td>
          <td>{_format_date(e.get('event_date'))}</td>
          <td>{_format_km(e.get('mileage'))}</td>
          <td>{_format_currency_from_cents(e.get('cost_cents'))}</td>
          <td>{_escape_html(e.get('vendor') or '')}</td>
          <td>{_escape_html(e.get('notes') or '')}</td>
        </tr>
        """
        for e in maintenance_events
    )

    incident_rows = "".join(
        f"""
        <tr>
          <td>{_format_date(i.get('incident_date'))}</td>
          <td>{_escape_html(str(i.get('severity', '')).upper())}</td>
          <td>{_escape_html(i.get('description') or '')}</td>
          <td>{_escape_html(i.get('damage_description') or '')}</td>
          <td>{_escape_html(i.get('repair_status') or '')}</td>
          <td>{_format_currency_from_cents(i.get('repair_cost_cents'))}</td>
          <td>{_format_km(i.get('mileage')) if i.get('mileage') is not None else '—'}</td>
          <td>{"Yes" if i.get("insurance_claim") else "No"}</td>
        </tr>
        """
        for i in incidents
    )

    if obd_reading:
        metrics = obd_reading
        obd_metrics = f"""
        <p><strong>Captured:</strong> {_format_date(metrics.get('captured_at'))} ({_escape_html(metrics.get('source', ''))})</p>
        <ul>
          <li><strong>RPM:</strong> {metrics.get('rpm') if metrics.get('rpm') is not None else '—'}</li>
          <li><strong>Coolant:</strong> {metrics.get('coolant_temp_c') if metrics.get('coolant_temp_c') is not None else '—'} °C</li>
          <li><strong>Speed:</strong> {metrics.get('speed_kph') if metrics.get('speed_kph') is not None else '—'} km/h</li>
          <li><strong>Engine load:</strong> {metrics.get('engine_load_pct') if metrics.get('engine_load_pct') is not None else '—'} %</li>
          <li><strong>Battery voltage:</strong> {metrics.get('battery_voltage') if metrics.get('battery_voltage') is not None else '—'} V</li>
        </ul>
        <p><strong>Error codes ({len(metrics.get('dtcs') or [])}):</strong></p>
        {
            "<ul>"
            + "".join(
                f"<li><strong>{_escape_html(d.get('code', ''))}:</strong> {_escape_html(d.get('description', ''))}</li>"
                for d in (metrics.get("dtcs") or [])
            )
            + "</ul>"
            if metrics.get("dtcs")
            else "<p>No stored trouble codes.</p>"
        }
        """
    else:
        obd_metrics = "<p>No OBD snapshot available.</p>"

    if care_score:
        cats = care_score.categories
        score_section = f"""
        <h2>Car Care Score</h2>
        <p><strong>Overall score:</strong> {care_score.overall_score} ({_escape_html(care_score.grade)})</p>
        <p><strong>Summary:</strong> {_escape_html(care_score.summary)}</p>
        <p><strong>Computed at:</strong> {_format_date(care_score.computed_at.isoformat())}</p>
        <h3>Categories</h3>
        <ul>
          <li><strong>{_escape_html(cats.maintenance_regularity.label)}:</strong> {cats.maintenance_regularity.score} / 100</li>
          <li><strong>{_escape_html(cats.eu_inspection.label)}:</strong> {cats.eu_inspection.score} / 100</li>
          <li><strong>{_escape_html(cats.incident_history.label)}:</strong> {cats.incident_history.score} / 100</li>
          <li><strong>{_escape_html(cats.mileage_tracking.label)}:</strong> {cats.mileage_tracking.score} / 100</li>
          <li><strong>{_escape_html(cats.documentation_quality.label)}:</strong> {cats.documentation_quality.score} / 100</li>
        </ul>
        """
    else:
        score_section = "<h2>Car Care Score</h2><p>No score available.</p>"

    services_rows = ""
    if service_status:
        services: List[Dict[str, Any]] = service_status.get("services", [])
        for s in services:
            last_d = s.get("last_date")
            due_d = s.get("due_date")
            services_rows += f"""
            <tr>
              <td>{_escape_html(s.get('event_type', ''))}</td>
              <td>{_format_date(last_d.isoformat() if hasattr(last_d, 'isoformat') else last_d) if last_d else "—"}</td>
              <td>{_format_km(s.get('last_mileage')) if s.get('last_mileage') is not None else "—"}</td>
              <td>{_format_date(due_d.isoformat() if hasattr(due_d, 'isoformat') else due_d) if due_d else "—"}</td>
              <td>{_format_km(s.get('due_mileage')) if s.get('due_mileage') is not None else "—"}</td>
              <td>{_escape_html(str(s.get('urgency', '')))}</td>
            </tr>
            """

    html = f"""
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Car report - {_escape_html(car_title)}</title>
        <style>
          body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #111827; }}
          h1 {{ font-size: 24px; margin-bottom: 4px; }}
          h2 {{ font-size: 18px; margin-top: 24px; margin-bottom: 8px; }}
          h3 {{ font-size: 15px; margin-top: 16px; margin-bottom: 6px; }}
          p {{ font-size: 13px; line-height: 1.5; margin: 4px 0; }}
          .meta {{ font-size: 12px; color: #6b7280; }}
          table {{ width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }}
          th, td {{ border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; vertical-align: top; }}
          th {{ background: #f3f4f6; font-weight: 600; }}
          ul {{ padding-left: 18px; }}
          .section-separator {{ margin-top: 24px; border-top: 1px solid #e5e7eb; }}
        </style>
      </head>
      <body>
        <h1>Car report</h1>
        <p class="meta">Generated at {_format_date(generated_at)}</p>

        <h2>Vehicle</h2>
        <p><strong>Registration:</strong> {_escape_html(car.get('registreringsnummer', ''))}</p>
        <p><strong>Make / model:</strong> {_escape_html(car.get('merke', ''))} {_escape_html(car.get('modell', ''))}</p>
        <p><strong>Year:</strong> {_escape_html(str(car.get('arsmodell', '')))}</p>
        <p><strong>Color:</strong> {_escape_html(car.get('farge', ''))}</p>
        <p><strong>Odometer:</strong> {_format_km(car.get('kilometer'))}</p>
        <p><strong>VIN:</strong> {_escape_html(car.get('chassisnummer', ''))}</p>
        <p><strong>Fuel / transmission:</strong> {_escape_html(car.get('drivstoff', ''))} / {_escape_html(car.get('girkasse', ''))}</p>
        <p><strong>EU inspection due:</strong> {_format_date(car.get('eukontrollfrist'))}</p>

        <div class="section-separator"></div>
        {score_section}

        <div class="section-separator"></div>
        <h2>Service status</h2>
        {"<p>No service status available.</p>" if not service_status else f"""
        <p><strong>Current mileage:</strong> {_format_km(service_status.get('current_mileage'))}</p>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Last date</th>
              <th>Last mileage</th>
              <th>Due date</th>
              <th>Due mileage</th>
              <th>Urgency</th>
            </tr>
          </thead>
          <tbody>
            {services_rows}
          </tbody>
        </table>
        """}

        <div class="section-separator"></div>
        <h2>Maintenance timeline</h2>
        {"<p>No maintenance events recorded.</p>" if not maintenance_events else f"""
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
            {maintenance_rows}
          </tbody>
        </table>
        """}

        <div class="section-separator"></div>
        <h2>Incidents</h2>
        {"<p>No incidents reported.</p>" if not incidents else f"""
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
            {incident_rows}
          </tbody>
        </table>
        """}

        <div class="section-separator"></div>
        <h2>OBD-II diagnostics</h2>
        {obd_metrics}
      </body>
    </html>
    """
    return html


def generate_car_report_html(uid: str, car_id: str) -> str:
    """
    Build a full HTML report for a car, mirroring the app's CarReportData.
    This HTML can then be converted to PDF by the router layer.
    """
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")

    maintenance_events = maintenance_repository.list_events_for_car(car_id)
    incidents = incident_repository.list_incidents_for_car(car_id)
    obd_latest = obd_repository.get_latest_reading(car_id)

    # Use existing services to compute care score and service status
    care_score: Optional[CarCareScoreResponse]
    try:
        care_score = compute_car_care_score(uid, car_id)
    except NotFoundError:
        care_score = None

    try:
        service_status_model = get_car_service_status(uid, car_id)
        service_status: Optional[Dict[str, Any]] = service_status_model.model_dump()
    except NotFoundError:
        service_status = None

    return _build_html(
        car=car,
        care_score=care_score,
        service_status=service_status,
        maintenance_events=maintenance_events,
        incidents=incidents,
        obd_reading=obd_latest,
    )

