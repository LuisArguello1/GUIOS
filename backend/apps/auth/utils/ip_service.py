import logging
import ipaddress
from functools import lru_cache
from typing import Dict, Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

IPQUERY_BASE_URL = "https://api.ipquery.io"
IPQUERY_TIMEOUT = getattr(settings, 'IPQUERY_TIMEOUT', 4)


def _is_private_ip(ip: str) -> bool:
    """Usa el módulo ipaddress de stdlib — cubre todos los rangos RFC 1918/loopback/link-local."""
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False  # IP malformada → tratamos como pública y dejamos que la API falle


def get_empty_geo_data() -> Dict[str, Any]:
    return {
        "city": "",
        "country": "",
        "country_code": "",
        "isp": "",
        "is_vpn": False,
        "is_mobile": False,
        "risk_score": 0,
    }


def lookup_ip(ip: str) -> Dict[str, Any]:
    if not ip:
        return get_empty_geo_data()

    if _is_private_ip(ip):
        result = get_empty_geo_data()
        result.update({"city": "Red Local", "country": "Intranet"})
        return result

    try:
        response = requests.get(
            f"{IPQUERY_BASE_URL}/{ip}",
            timeout=IPQUERY_TIMEOUT,
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        data = response.json()

        location = data.get("location", {})
        isp_data = data.get("isp", {})
        risk = data.get("risk", {})

        return {
            "city": location.get("city") or "",
            "country": location.get("country") or "",
            "country_code": location.get("country_code") or "",
            "isp": isp_data.get("isp") or isp_data.get("org") or "",
            "is_vpn": bool(risk.get("is_vpn", False)),
            "is_mobile": bool(isp_data.get("is_mobile", False)),
            "risk_score": int(risk.get("risk_score", 0)),
        }

    except requests.exceptions.Timeout:
        logger.warning("IPService timeout", extra={"ip": ip})
    except requests.exceptions.ConnectionError:
        logger.warning("IPService sin conexión", extra={"ip": ip})
    except requests.exceptions.HTTPError as e:
        logger.warning("IPService error HTTP", extra={"ip": ip, "status": e.response.status_code})
    except (ValueError, KeyError, TypeError) as e:
        logger.error("IPService error parseando respuesta", extra={"ip": ip, "error": str(e)})
    except Exception as e:
        logger.error("IPService error inesperado", extra={"ip": ip, "error": str(e)})

    return get_empty_geo_data()