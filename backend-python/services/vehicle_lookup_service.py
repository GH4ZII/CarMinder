from typing import Optional

import httpx

from config.settings import get_settings
from schemas.car import CarBase

VEHICLE_API_URL = "https://www.vegvesen.no/ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata"


async def lookup_vehicle(registration_number: str) -> Optional[CarBase]:
    api_key = get_settings()["VEHICLE_API_KEY"]
    if not api_key:
        raise ValueError("Missing VEHICLE_API_KEY in environment variables")

    headers = {
        "SVV-Authorization": f"Apikey {api_key}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{VEHICLE_API_URL}?kjennemerke={registration_number.upper()}",
            headers=headers,
        )

        if response.status_code != 200:
            return None

        data = response.json()

        kjoretoy_list = data.get("kjoretoydataListe", [])
        if not kjoretoy_list:
            return None

        kjoretoy_data = kjoretoy_list[0]
        teknisk_data = (
            kjoretoy_data.get("godkjenning", {})
            .get("tekniskGodkjenning", {})
            .get("tekniskeData", {})
        )
        motor_data = teknisk_data.get("motorOgDrivverk", {})
        miljo_data = teknisk_data.get("miljodata", {})
        karosseri = teknisk_data.get("karosseriOgLasteplan", {})
        vekter = teknisk_data.get("vekter", {})
        generelt = teknisk_data.get("generelt", {})

        miljo_gruppe = miljo_data.get("miljoOgdrivstoffGruppe", [{}])
        miljo_first = miljo_gruppe[0] if miljo_gruppe else {}
        forbruk_list = miljo_first.get("forbrukOgUtslipp", [{}])
        forbruk_first = forbruk_list[0] if forbruk_list else {}

        motor_list = motor_data.get("motor", [{}])
        motor_first = motor_list[0] if motor_list else {}
        drivstoff_list = motor_first.get("drivstoff", [{}])
        drivstoff_first = drivstoff_list[0] if drivstoff_list else {}

        merke_list = generelt.get("merke", [{}])
        merke_first = merke_list[0] if merke_list else {}

        handelsbetegnelse = generelt.get("handelsbetegnelse", ["Unknown"])
        modell = handelsbetegnelse[0] if handelsbetegnelse else "Unknown"

        farge_list = karosseri.get("rFarge", [{}])
        farge_first = farge_list[0] if farge_list else {}

        dorer_list = karosseri.get("antallDorer", [0])
        dorer = dorer_list[0] if dorer_list else 0

        hastighet_list = motor_data.get("maksimumHastighet", [0])
        hastighet = hastighet_list[0] if hastighet_list else 0

        forstegangsdato = (
            kjoretoy_data.get("forstegangsregistrering", {}).get(
                "registrertForstegangNorgeDato", ""
            )
        )
        arsmodell = (
            forstegangsdato[:4]
            if forstegangsdato and len(forstegangsdato) >= 4
            else "Unknown"
        )

        return CarBase(
            registreringsnummer=registration_number.upper(),
            merke=merke_first.get("merke", "Unknown"),
            modell=modell,
            arsmodell=arsmodell,
            farge=farge_first.get("kodeBeskrivelse", "Not specified"),
            kilometer=0,
            forstegangregistrert=forstegangsdato or "Unknown",
            chassisnummer=kjoretoy_data.get("kjoretoyId", {}).get(
                "understellsnummer", "Unknown"
            ),
            drivstoff=miljo_first.get("drivstoffKodeMiljodata", {}).get(
                "kodeNavn", "Unknown"
            ),
            girkasse=motor_data.get("girkassetype", {}).get("kodeNavn", "Unknown"),
            motoreffekt=drivstoff_first.get("maksNettoEffekt", 0),
            slagvolum=motor_first.get("slagvolum", 0),
            co2utslipp=forbruk_first.get("co2BlandetKjoring", 0),
            forbruk=forbruk_first.get("forbrukBlandetKjoring", 0.0),
            egenvekt=vekter.get("egenvekt", 0),
            totalvekt=vekter.get("tillattTotalvekt", 0),
            antallseter=teknisk_data.get("persontall", {}).get(
                "sitteplasserTotalt", 0
            ),
            antalldorer=dorer,
            karosseri=karosseri.get("karosseritype", {}).get("kodeNavn", "Unknown"),
            eukontrollfrist=kjoretoy_data.get("periodiskKjoretoyKontroll", {}).get(
                "kontrollfrist", "Unknown"
            ),
            makshastighet=hastighet,
        )
