"""
apps/guios/services/repository_health.py
─────────────────────────────────────────────────────────────────────────────
Servicio determinista de telemetría viva para repositorios FLOSS (GitHub / GitLab).
Extrae señales objetivas de salud técnica sin intervención de IA:
- Licencia OSI detectada (SPDX)
- Recencia de actividad (pushed_at, días sin commits, estado archived)
- Último release publicado
- Adopción y masa crítica (estrellas, forks, issues abiertos, contribuidores)
- Índice compuesto transparente de Vitalidad Técnica (0 a 100)
"""

from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
import logging
import os
import re
from typing import Any
from urllib.parse import quote, urlparse

import httpx
from django.conf import settings

from apps.guios.models import Evaluation

logger = logging.getLogger(__name__)

GITHUB_HOSTS = {"github.com", "www.github.com"}
GITLAB_HOSTS = {"gitlab.com", "www.gitlab.com"}

OSI_COMMON_SPDX = {
    "MIT",
    "Apache-2.0",
    "GPL-2.0",
    "GPL-2.0-only",
    "GPL-2.0-or-later",
    "GPL-3.0",
    "GPL-3.0-only",
    "GPL-3.0-or-later",
    "LGPL-2.1",
    "LGPL-3.0",
    "AGPL-3.0",
    "AGPL-3.0-only",
    "AGPL-3.0-or-later",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "MPL-2.0",
    "ISC",
    "EPL-2.0",
    "PostgreSQL",
    "Unlicense",
    "Zlib",
}


def parse_repository_target(raw_url: str | None) -> tuple[str, str] | None:
    """
    Identifica el proveedor ('github' | 'gitlab') y la ruta del repositorio
    ('owner/repo' o 'group/subgroup/repo') a partir de una URL pública.
    """
    if not raw_url or not str(raw_url).strip():
        return None

    candidate = str(raw_url).strip()
    if "://" not in candidate:
        candidate = f"https://{candidate}"

    parsed = urlparse(candidate)
    host = (parsed.hostname or "").lower()
    segments = [seg for seg in parsed.path.strip("/").split("/") if seg]

    if host in GITHUB_HOSTS and len(segments) >= 2:
        owner = segments[0]
        repo = re.sub(r"\.git$", "", segments[1], flags=re.IGNORECASE)
        if owner and repo:
            return ("github", f"{owner}/{repo}")

    if host in GITLAB_HOSTS and len(segments) >= 2:
        # GitLab permite subgrupos antes de /-/, tree, blob, issues, etc.
        clean_parts: list[str] = []
        for part in segments:
            if part == "-" or part in {"tree", "blob", "issues", "merge_requests", "releases"}:
                break
            clean_parts.append(part)
        if len(clean_parts) >= 2:
            clean_parts[-1] = re.sub(r"\.git$", "", clean_parts[-1], flags=re.IGNORECASE)
            return ("gitlab", "/".join(clean_parts))

    return None


def _parse_iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _extract_last_page_from_link(link_header: str | None) -> int | None:
    if not link_header:
        return None
    match = re.search(r'[?&]page=(\d+)[^>]*>;\s*rel="last"', link_header)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def compute_vitality_score(
    *,
    archived: bool,
    days_since_last_push: int | None,
    has_osi_license: bool,
    has_release: bool,
    stars: int,
    contributors_count: int | None,
) -> tuple[int, str, str, list[dict[str, str]]]:
    """
    Calcula un índice transparente de Vitalidad Técnica (0..100) y alertas objetivas.
    Retorna: (score, grade, activity_status, alerts)
    """
    alerts: list[dict[str, str]] = []

    if archived:
        activity_status = "archived"
        alerts.append({
            "level": "danger",
            "message": "Repositorio marcado como archivado (solo lectura, sin mantenimiento activo).",
        })
    elif days_since_last_push is None:
        activity_status = "unknown"
    elif days_since_last_push <= 90:
        activity_status = "active"
    elif days_since_last_push <= 365:
        activity_status = "moderate"
        alerts.append({
            "level": "warning",
            "message": f"Actividad moderada: último cambio hace {days_since_last_push} días.",
        })
    else:
        activity_status = "stale"
        alerts.append({
            "level": "danger",
            "message": f"Posible estancamiento: sin commits registrados en los últimos {days_since_last_push} días.",
        })

    if not has_osi_license:
        alerts.append({
            "level": "warning",
            "message": "No se detectó una licencia OSI estándar explícita en los metadatos del repositorio.",
        })

    if not has_release:
        alerts.append({
            "level": "info",
            "message": "El repositorio no publica releases formales etiquetados en su plataforma.",
        })

    if contributors_count is not None and contributors_count < 3 and not archived:
        alerts.append({
            "level": "warning",
            "message": f"Bus factor reducido: solo {contributors_count} contribuidor(es) detectado(s).",
        })

    # Desglose ponderado (100 pts máximo)
    if archived:
        activity_pts = 0
    elif days_since_last_push is None:
        activity_pts = 15
    elif days_since_last_push <= 30:
        activity_pts = 35
    elif days_since_last_push <= 90:
        activity_pts = 30
    elif days_since_last_push <= 180:
        activity_pts = 20
    elif days_since_last_push <= 365:
        activity_pts = 12
    else:
        activity_pts = 3

    license_pts = 20 if has_osi_license else 0
    release_pts = 15 if has_release else 0

    if stars >= 5000:
        adoption_pts = 15
    elif stars >= 1000:
        adoption_pts = 12
    elif stars >= 200:
        adoption_pts = 9
    elif stars >= 30:
        adoption_pts = 6
    else:
        adoption_pts = 2

    if contributors_count is None:
        community_pts = 7
    elif contributors_count >= 50:
        community_pts = 15
    elif contributors_count >= 15:
        community_pts = 12
    elif contributors_count >= 5:
        community_pts = 8
    elif contributors_count >= 2:
        community_pts = 5
    else:
        community_pts = 2

    score = max(0, min(100, activity_pts + license_pts + release_pts + adoption_pts + community_pts))
    if archived:
        score = min(score, 35)

    if score >= 80:
        grade = "Óptimo"
    elif score >= 60:
        grade = "Estable"
    elif score >= 40:
        grade = "Atención"
    else:
        grade = "Riesgo"

    return score, grade, activity_status, alerts


class RepositoryHealthClient:
    """Cliente HTTP ligero para consultar APIs públicas de GitHub y GitLab."""

    TIMEOUT_SECONDS = 6.0

    def __init__(self, timeout: float | None = None):
        self.timeout = timeout or self.TIMEOUT_SECONDS
        self.github_token = getattr(settings, "GITHUB_TOKEN", None) or os.getenv("GITHUB_TOKEN", "")

    def fetch(self, repo_url: str | None) -> dict[str, Any]:
        now_iso = datetime.now(dt_timezone.utc).isoformat()
        if not repo_url or not str(repo_url).strip():
            return {
                "status": "missing",
                "message": "No se proporcionó una URL de repositorio para inspeccionar.",
                "fetched_at": now_iso,
            }

        target = parse_repository_target(repo_url)
        if not target:
            return {
                "status": "unsupported",
                "provider": "web",
                "repo_url": str(repo_url).strip(),
                "message": "La URL ingresada corresponde a un sitio web general; proporcione un repositorio de GitHub o GitLab para extraer telemetría de código.",
                "fetched_at": now_iso,
            }

        provider, full_name = target
        try:
            if provider == "github":
                return self._fetch_github(full_name, now_iso)
            return self._fetch_gitlab(full_name, now_iso)
        except httpx.TimeoutException:
            return {
                "status": "error",
                "provider": provider,
                "repo_full_name": full_name,
                "repo_url": str(repo_url).strip(),
                "error_message": "Tiempo de espera agotado al consultar la API del repositorio.",
                "fetched_at": now_iso,
            }
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "Respuesta HTTP inesperada consultando pulso de repositorio (%s): status=%s",
                full_name,
                exc.response.status_code if exc.response is not None else "unknown",
            )
            return {
                "status": "error",
                "provider": provider,
                "repo_full_name": full_name,
                "repo_url": str(repo_url).strip(),
                "error_message": f"La API de {provider.title()} devolvió un error temporal. Intente nuevamente más tarde.",
                "fetched_at": now_iso,
            }
        except Exception as exc:
            logger.warning("Error consultando pulso de repositorio (%s): %s", full_name, exc)
            return {
                "status": "error",
                "provider": provider,
                "repo_full_name": full_name,
                "repo_url": str(repo_url).strip(),
                "error_message": f"No se pudo conectar con la API de {provider.title()} en este momento.",
                "fetched_at": now_iso,
            }

    def _fetch_github(self, full_name: str, now_iso: str) -> dict[str, Any]:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "GUIOS-Audit-Engine/1.0",
        }
        if self.github_token:
            headers["Authorization"] = f"Bearer {self.github_token}"

        base = f"https://api.github.com/repos/{full_name}"
        with httpx.Client(timeout=self.timeout, headers=headers, follow_redirects=True) as client:
            repo_res = client.get(base)
            if repo_res.status_code == 404:
                return {
                    "status": "error",
                    "provider": "github",
                    "repo_full_name": full_name,
                    "repo_url": f"https://github.com/{full_name}",
                    "error_message": "Repositorio no encontrado o privado en GitHub.",
                    "fetched_at": now_iso,
                }
            if repo_res.status_code in (403, 429):
                return {
                    "status": "error",
                    "provider": "github",
                    "repo_full_name": full_name,
                    "repo_url": f"https://github.com/{full_name}",
                    "error_message": "Límite temporal de peticiones de la API de GitHub alcanzado. Intente nuevamente en unos minutos.",
                    "fetched_at": now_iso,
                }
            repo_res.raise_for_status()
            data = repo_res.json()

            latest_release = None
            rel_res = client.get(f"{base}/releases/latest")
            if rel_res.status_code == 200:
                rel_json = rel_res.json()
                latest_release = {
                    "tag_name": rel_json.get("tag_name") or "",
                    "name": rel_json.get("name") or rel_json.get("tag_name") or "",
                    "published_at": rel_json.get("published_at") or "",
                }

            contributors_count: int | None = None
            top_contributors: list[dict[str, Any]] = []
            contrib_res = client.get(f"{base}/contributors", params={"per_page": 5, "anon": "false"})
            if contrib_res.status_code == 200:
                c_list = contrib_res.json()
                if isinstance(c_list, list):
                    top_contributors = [
                        {
                            "login": c.get("login") or "contributor",
                            "contributions": int(c.get("contributions") or 0),
                            "avatar_url": c.get("avatar_url") or "",
                        }
                        for c in c_list[:5]
                    ]
                    last_page = _extract_last_page_from_link(contrib_res.headers.get("Link"))
                    if last_page is not None:
                        # Con per_page=5, last_page * 5 estima el piso; pedir per_page=1 da conteo exacto
                        count_res = client.get(f"{base}/contributors", params={"per_page": 1, "anon": "false"})
                        exact = _extract_last_page_from_link(count_res.headers.get("Link")) if count_res.status_code == 200 else None
                        contributors_count = exact or (last_page * 5)
                    else:
                        contributors_count = len(c_list)

        license_obj = data.get("license") or {}
        spdx = (license_obj.get("spdx_id") or "").strip()
        license_name = (license_obj.get("name") or "").strip()
        has_osi = bool(spdx and spdx != "NOASSERTION") and (spdx in OSI_COMMON_SPDX or "GPL" in spdx or "BSD" in spdx)

        pushed_dt = _parse_iso_dt(data.get("pushed_at"))
        days_since = max(0, (datetime.now(dt_timezone.utc) - pushed_dt).days) if pushed_dt else None
        archived = bool(data.get("archived"))
        stars = int(data.get("stargazers_count") or 0)

        score, grade, activity_status, alerts = compute_vitality_score(
            archived=archived,
            days_since_last_push=days_since,
            has_osi_license=has_osi,
            has_release=bool(latest_release),
            stars=stars,
            contributors_count=contributors_count,
        )

        return {
            "status": "ok",
            "provider": "github",
            "repo_full_name": data.get("full_name") or full_name,
            "repo_url": data.get("html_url") or f"https://github.com/{full_name}",
            "description": (data.get("description") or "").strip(),
            "homepage": (data.get("homepage") or "").strip(),
            "primary_language": (data.get("language") or "").strip(),
            "topics": list((data.get("topics") or [])[:6]),
            "license_spdx": spdx if spdx and spdx != "NOASSERTION" else "",
            "license_name": license_name if license_name and license_name != "Other" else spdx,
            "has_osi_license": has_osi,
            "stars": stars,
            "forks": int(data.get("forks_count") or 0),
            "watchers": int(data.get("subscribers_count") or data.get("watchers_count") or 0),
            "open_issues": int(data.get("open_issues_count") or 0),
            "default_branch": data.get("default_branch") or "main",
            "archived": archived,
            "created_at": data.get("created_at") or "",
            "pushed_at": data.get("pushed_at") or "",
            "days_since_last_push": days_since,
            "latest_release": latest_release,
            "contributors_count": contributors_count,
            "top_contributors": top_contributors,
            "activity_status": activity_status,
            "health_score": score,
            "health_grade": grade,
            "alerts": alerts,
            "fetched_at": now_iso,
        }

    def _fetch_gitlab(self, full_name: str, now_iso: str) -> dict[str, Any]:
        encoded = quote(full_name, safe="")
        base = f"https://gitlab.com/api/v4/projects/{encoded}"
        headers = {"User-Agent": "GUIOS-Audit-Engine/1.0"}

        with httpx.Client(timeout=self.timeout, headers=headers, follow_redirects=True) as client:
            proj_res = client.get(base, params={"license": "true"})
            if proj_res.status_code == 404:
                return {
                    "status": "error",
                    "provider": "gitlab",
                    "repo_full_name": full_name,
                    "repo_url": f"https://gitlab.com/{full_name}",
                    "error_message": "Proyecto no encontrado o privado en GitLab.",
                    "fetched_at": now_iso,
                }
            proj_res.raise_for_status()
            data = proj_res.json()

            latest_release = None
            rel_res = client.get(f"{base}/releases", params={"per_page": 1})
            if rel_res.status_code == 200:
                releases = rel_res.json()
                if isinstance(releases, list) and releases:
                    r0 = releases[0]
                    latest_release = {
                        "tag_name": r0.get("tag_name") or "",
                        "name": r0.get("name") or r0.get("tag_name") or "",
                        "published_at": r0.get("released_at") or r0.get("created_at") or "",
                    }

        lic = data.get("license") or {}
        spdx = (lic.get("key") or "").upper()
        license_name = lic.get("name") or spdx
        has_osi = bool(spdx)

        pushed_raw = data.get("last_activity_at") or ""
        pushed_dt = _parse_iso_dt(pushed_raw)
        days_since = max(0, (datetime.now(dt_timezone.utc) - pushed_dt).days) if pushed_dt else None
        archived = bool(data.get("archived"))
        stars = int(data.get("star_count") or 0)

        score, grade, activity_status, alerts = compute_vitality_score(
            archived=archived,
            days_since_last_push=days_since,
            has_osi_license=has_osi,
            has_release=bool(latest_release),
            stars=stars,
            contributors_count=None,
        )

        return {
            "status": "ok",
            "provider": "gitlab",
            "repo_full_name": data.get("path_with_namespace") or full_name,
            "repo_url": data.get("web_url") or f"https://gitlab.com/{full_name}",
            "description": (data.get("description") or "").strip(),
            "homepage": "",
            "primary_language": "",
            "topics": list((data.get("topics") or [])[:6]),
            "license_spdx": spdx,
            "license_name": license_name,
            "has_osi_license": has_osi,
            "stars": stars,
            "forks": int(data.get("forks_count") or 0),
            "watchers": 0,
            "open_issues": int(data.get("open_issues_count") or 0),
            "default_branch": data.get("default_branch") or "main",
            "archived": archived,
            "created_at": data.get("created_at") or "",
            "pushed_at": pushed_raw,
            "days_since_last_push": days_since,
            "latest_release": latest_release,
            "contributors_count": None,
            "top_contributors": [],
            "activity_status": activity_status,
            "health_score": score,
            "health_grade": grade,
            "alerts": alerts,
            "fetched_at": now_iso,
        }


def sync_evaluation_repo_health(
    evaluation: Evaluation,
    *,
    repo_url: str | None = None,
    force: bool = True,
) -> dict[str, Any]:
    """
    Consulta y persiste la telemetría del repositorio en `evaluation.repo_health_metrics`.
    Si se pasa `repo_url` mientras la evaluación sigue en progreso, actualiza `software_repo_url`.
    """
    target_url = repo_url.strip() if isinstance(repo_url, str) and repo_url.strip() else evaluation.software_repo_url
    update_fields: list[str] = []

    if (
        isinstance(repo_url, str)
        and repo_url.strip()
        and repo_url.strip() != (evaluation.software_repo_url or "").strip()
        and evaluation.status == Evaluation.STATUS_IN_PROGRESS
    ):
        evaluation.software_repo_url = repo_url.strip()
        update_fields.append("software_repo_url")

    existing = evaluation.repo_health_metrics
    if not force and isinstance(existing, dict) and existing.get("status") == "ok":
        return existing

    client = RepositoryHealthClient()
    metrics = client.fetch(target_url)
    evaluation.repo_health_metrics = metrics
    update_fields.append("repo_health_metrics")
    evaluation.save(update_fields=update_fields)
    return metrics
