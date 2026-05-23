"""
OTA Scraper Microservice
- Method 1: curl_cffi (TLS fingerprint bypass, Chrome impersonation)
- Method 2: Camoufox stealth browser (JS rendering + behaviour analysis bypass)
- Rotating residential proxies via PROXY_LIST or PROXY_URL env var
"""

import os
import itertools
import logging
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


def is_spa_shell(html: str) -> bool:
    """Detect JS-only shell pages (React/Vue SPA before hydration)."""
    from html.parser import HTMLParser

    class TextExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.text = []
            self._skip = False
        def handle_starttag(self, tag, attrs):
            if tag in ("script", "style"):
                self._skip = True
        def handle_endtag(self, tag):
            if tag in ("script", "style"):
                self._skip = False
        def handle_data(self, data):
            if not self._skip:
                self.text.append(data.strip())

    p = TextExtractor()
    p.feed(html)
    visible_text = " ".join(t for t in p.text if t)
    return len(visible_text) < 500  # Very little visible text = SPA shell


@app.post("/scrape")
async def scrape(req: ScrapeRequest, x_api_key: str | None = Header(None)):
    check_auth(x_api_key)

    proxy = next_proxy()
    url = req.url
    is_agoda = "agoda.com" in url

    logger.info(f"Scraping: {url} (agoda={is_agoda})")

    # ─── Method 1: curl_cffi (skip for Agoda SPA — always needs JS render) ──
    if not is_agoda:
        try:
            from curl_cffi.requests import AsyncSession

            async with AsyncSession(impersonate="chrome124") as session:
                kwargs: dict = {
                    "headers": {
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
                        "Cache-Control": "no-cache",
                    },
                    "timeout": 20,
                    "allow_redirects": True,
                }
                if proxy:
                    kwargs["proxies"] = proxy

                r = await session.get(url, **kwargs)
                if r.status_code == 200 and not is_blocked(r.text) and not is_spa_shell(r.text):
                    logger.info("curl_cffi success")
                    return {"html": r.text, "method": "curl_cffi"}
        except Exception as e:
            logger.warning(f"curl_cffi failed: {e}")

    # ─── Method 2: Camoufox stealth browser (JS rendering) ──────────────────
    try:
        from camoufox.async_api import AsyncCamoufox

        browser_args: dict = {
            "headless": True,
            # Required for Docker/containerized environments (no /dev/shm)
            "args": ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        }
        if proxy:
            browser_args["proxy"] = {"server": list(proxy.values())[0]}

        logger.info("Launching Camoufox...")
        async with AsyncCamoufox(**browser_args) as browser:
            page = await browser.new_page()
            try:
                await page.goto(url, timeout=30_000, wait_until="domcontentloaded")
                await page.wait_for_load_state("networkidle", timeout=15_000)
            except Exception as e:
                logger.warning(f"page.goto/wait error (continuing): {e}")

            html = await page.content()
            await page.close()

            logger.info(f"Camoufox got {len(html)} bytes, spa_shell={is_spa_shell(html)}, blocked={is_blocked(html)}")

            if not is_blocked(html) and not is_spa_shell(html):
                logger.info("camoufox success")
                return {"html": html, "method": "camoufox"}
    except Exception as e:
        logger.error(f"Camoufox failed: {e}")

    logger.error("All methods failed")
    raise HTTPException(status_code=422, detail="All scraping methods failed")
