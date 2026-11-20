from pathlib import Path
from urllib.parse import parse_qs
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8080"
API = "https://script.google.com/macros/s/test-deployment-id/exec"
OUT = Path("/home/oai/share/hp-party-quest-src/hp-party-quest/test-output")
OUT.mkdir(exist_ok=True)

participants = {
    "candidate-token": {
        "participantId": "P-CAND0001",
        "displayName": "Lucía C.",
        "qrToken": "candidate-token",
    }
}

def decode_request(request):
    raw = request.post_data or ""
    form = parse_qs(raw)
    action = form.get("action", [""])[0]
    payload = json.loads(form.get("payload", ["{}"])[0])
    return action, payload

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path="/opt/pw-browsers/chromium-1228/chrome-linux64/chrome")
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)

    def route_api(route, request):
        action, payload = decode_request(request)
        if action == "register":
            body = {"ok": True, "data": {"duplicateRegistration": False, "sessionToken": "session-token-abcdefghijklmnopqrstuvwxyz", "participant": {"participantId": "P-TEST0001", "displayName": "Sebastián E.", "qrToken": "self-token"}}}
        elif action == "session":
            body = {"ok": True, "data": {"participant": {"participantId": "P-TEST0001", "displayName": "Sebastián E.", "qrToken": "self-token"}}}
        elif action == "candidate":
            candidate = participants.get(payload.get("qrToken"), participants["candidate-token"])
            body = {"ok": True, "data": {"candidate": candidate, "challenge": {"challengeId": "CH-COOL-GLASSES", "name": "Anteojos más cool", "description": "Encontrá a la persona con los anteojos más cool.", "status": "OPEN", "allowSelfVote": False}}}
        elif action == "vote":
            body = {"ok": True, "data": {"candidateDisplayName": "Lucía C.", "challengeId": "CH-COOL-GLASSES", "votedAt": "2026-11-20T19:00:00.000Z"}}
        else:
            body = {"ok": False, "message": "Unknown test action"}
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body))

    page.route(API, route_api)
    page.route("**/config.js*", lambda route: route.fulfill(
        status=200,
        content_type="application/javascript",
        body=("window.HPQ_CONFIG = Object.freeze({"
              f"API_URL: '{API}', FRONTEND_URL: '', EVENT_NAME: 'HP Party Quest', "
              "EVENT_TAGLINE: 'Conectate. Explorá. Votá.', ACTIVE_CHALLENGE_ID: 'CH-COOL-GLASSES', "
              "REQUEST_TIMEOUT_MS: 15000});")
    ))
    page.goto(BASE, wait_until="networkidle")
    assert page.locator("#view-register").is_visible(), "Registration view did not load"
    page.fill("#first-name", "Sebastián")
    page.fill("#last-name", "Echavarria")
    page.fill("#email", "sebastian.echavarria@hp.com")
    page.check("#terms")
    page.click("#register-form button[type=submit]")
    page.locator("#view-pass").wait_for(state="visible")
    assert page.locator("#pass-name").inner_text() == "Sebastián E."
    assert page.locator("#qr-code canvas").count() == 1
    page.screenshot(path=str(OUT / "registration-pass.png"), full_page=True)

    page.goto(BASE + "/?candidate=candidate-token", wait_until="networkidle")
    page.locator("#view-candidate").wait_for(state="visible")
    assert page.locator("#candidate-name").inner_text() == "Lucía C."
    assert page.locator("#challenge-name").inner_text() == "Anteojos más cool"
    page.screenshot(path=str(OUT / "candidate-vote.png"), full_page=True)
    page.click("#vote-button")
    page.locator("#view-voted").wait_for(state="visible")
    assert "Lucía C." in page.locator("#voted-copy").inner_text()
    page.screenshot(path=str(OUT / "vote-confirmed.png"), full_page=True)

    print(json.dumps({
        "ok": True,
        "tested": ["registration", "persistent session", "personal QR rendering", "candidate lookup", "vote confirmation"],
        "screenshots": [str(p) for p in sorted(OUT.glob("*.png"))]
    }, ensure_ascii=False, indent=2))
    browser.close()
