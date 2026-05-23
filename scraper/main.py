"""
OTA Scraper Microservice
- Method 1: curl_cffi (TLS fingerprint bypass, Chrome impersonation)
- Method 2: Camoufox stealth browser (JS rendering + behaviour analysis bypass)
- Rotating residential proxies via PROXY_LIST or PROXY_URL env var
"""

import os
import itertools
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

app = FastAPI()

API_KEY = os.getenv("SCRAPER_API_KEY")

# Support both a single rotating gateway and a list of proxies
_proxy_url = os.getenv("PROXY_URL", "").strip()          # e.g. http://user:pass@gateway:8080
_proxy_list_raw = os.getenv("PROXY_LIST", "").strip()    # comma-separated
_proxies = [p.strip() for p in _proxy_list_raw.split(",") if p.strip()]
if _proxy_url:
    _proxies = [_proxy_url] + _proxies

_proxy_cycle = itertools.cycle(_proxies) if _proxies else None


BLOCKED_SIGNALS = [
    "just a moment", "cf-browser-verification", "challenge-platform",
    "enable javascript and cookies", "access denied", "please verify you are a human",
    "bot protection", "ddos-guard", "please turn javascript on",
]


def is_blocked(html: str) -> bool:
    low = html.lower()
    return any(s in low for s in BLOCKED_SIGNALS) or len(html) < 2000


def next_proxy() -> dict | None:
    if not _proxy_cycle:
        return None
    p = next(_proxy_cycle)
    return {"http": p, "https": p}


def check_auth(key: str | None):
    if API_KEY and key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


class ScrapeRequest(BaseModel):
    url: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/scrape")
async def scrape(req: ScrapeRequest, x_api_key: str | None = Header(None)):
    check_auth(x_api_key)

    proxy = next_proxy()

    # ─── Method 1: curl_cffi ────────────────────────────────────────────
    # Impersonates Chrome TLS fingerprint, bypasses most custom WAFs (Agoda, etc.)
    try:
        from curl_cffi.requests import AsyncSession

        async with AsyncSession(impersonate="chrome124") as session:
            kwargs: dict = {
                "headers": {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Cache-Control": "no-cache",
                },
                "timeout": 20,
                "allow_redirects": True,
            }
            if proxy:
                kwargs["proxies"] = proxy

            r = await session.get(req.url, **kwargs)
            if r.status_code == 200 and not is_blocked(r.text):
                return {"html": r.text, "method": "curl_cffi", "status": r.status_code}
    except Exception as e:
        pass  # Fall through to Camoufox

    # ─── Method 2: Camoufox stealth browser ─────────────────────────────
    # Full JS rendering + stealth fingerprint; heavier but handles behaviour challenges
    try:
        from camoufox.async_api import AsyncCamoufox

        browser_args: dict = {"headless": True}
        if proxy:
            # Camoufox accepts a single proxy string
            browser_args["proxy"] = {"server": list(proxy.values())[0]}

        async with AsyncCamoufox(**browser_args) as browser:
            page = await browser.new_page()
            try:
                await page.goto(req.url, timeout=30_000, wait_until="domcontentloaded")
                await page.wait_for_load_state("networkidle", timeout=10_000)
            except Exception:
                pass  # Timeout is fine; grab whatever loaded

            html = await page.content()
            await page.close()

            if not is_blocked(html):
                return {"html": html, "method": "camoufox"}
    except Exception:
        pass

    raise HTTPException(status_code=422, detail="All scraping methods failed")
