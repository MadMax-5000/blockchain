"""Minimal local dashboard for the atelier-2 blockchain attack simulator."""
from __future__ import annotations

import csv
import json
import os
import re
import subprocess
from pathlib import Path

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "results" / "runs"
SCENARIOS = ROOT / "scenarios" / "generated"
SIM = ROOT / ("sim.exe" if os.name == "nt" else "sim")

RESULTS.mkdir(parents=True, exist_ok=True)
SCENARIOS.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Blockchain Attack Lab")
app.mount("/static", StaticFiles(directory=str(ROOT / "dashboard" / "static")), name="static")
templates = Jinja2Templates(directory=str(ROOT / "dashboard" / "templates"))

ATTACKS = {
    "none": "Baseline",
    "51": "51% attack",
    "selfish": "Selfish mining",
    "withholding": "Block withholding",
    "sybil": "Sybil / eclipse",
}
CONSENSUS = {"pow": "PoW", "pos": "PoS"}


def attack_label(value: str) -> str:
    return ATTACKS.get(value, value)


def consensus_label(value: str) -> str:
    return CONSENSUS.get(value, value)


def pct(value) -> str:
    try:
        return f"{float(value) * 100:.1f}%"
    except (TypeError, ValueError):
        return "—"


def ms(value) -> str:
    try:
        value = int(value)
    except (TypeError, ValueError):
        return "—"
    return "—" if value < 0 else f"{value / 1000:.1f}s"


def num(value, digits: int = 1) -> str:
    try:
        return f"{float(value):,.{digits}f}"
    except (TypeError, ValueError):
        return "—"


templates.env.filters["pct"] = pct
templates.env.filters["ms"] = ms
templates.env.filters["num"] = num
templates.env.globals["attack_label"] = attack_label
templates.env.globals["consensus_label"] = consensus_label


def safe_name(name: str) -> str:
    return bool(re.fullmatch(r"[A-Za-z0-9._-]+", name))


def load_runs() -> list[dict]:
    runs = []
    if not RESULTS.exists():
        return runs
    for summary in RESULTS.glob("*/summary.json"):
        try:
            data = json.loads(summary.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        data["slug"] = summary.parent.name
        data["mtime"] = summary.stat().st_mtime
        runs.append(data)
    return sorted(runs, key=lambda item: item["mtime"], reverse=True)


def load_run(name: str) -> dict | None:
    if not safe_name(name):
        return None
    folder = RESULTS / name
    summary = folder / "summary.json"
    if not summary.exists():
        return None
    data = json.loads(summary.read_text(encoding="utf-8"))
    data["slug"] = name
    data["windows"] = read_csv(folder / "windows.csv")
    data["alerts"] = read_csv(folder / "alerts.csv")
    data["has_events"] = (folder / "events.jsonl").exists()
    return data


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def sparkline(values: list[float], width: int = 640, height: int = 120, pad: int = 8) -> str:
    if len(values) < 2:
        return ""
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        hi = lo + 1.0
    points = []
    for index, value in enumerate(values):
        x = pad + index * (width - 2 * pad) / (len(values) - 1)
        y = height - pad - (value - lo) * (height - 2 * pad) / (hi - lo)
        points.append(f"{x:.1f},{y:.1f}")
    return " ".join(points)


def run_stats(runs: list[dict]) -> dict:
    attacks = [run for run in runs if run.get("attack", "none") != "none"]
    # Detection is measured on undefended runs: a mitigation can stop an attack
    # before the detector has enough windows to raise an alert.
    observed = [run for run in attacks if not int(run.get("defense", 0) or 0)]
    detected = [run for run in observed if int(run.get("alerts", 0) or 0) > 0]
    delays = [
        int(run["detection_time_ms"])
        for run in detected
        if int(run.get("detection_time_ms", -1) or -1) >= 0
    ]
    success = [run for run in observed if int(run.get("attack_success", 0) or 0)]
    return {
        "runs": len(runs),
        "attacks": len(attacks),
        "detection_rate": len(detected) / len(observed) if observed else 0.0,
        "success_rate": len(success) / len(observed) if observed else 0.0,
        "avg_detection_ms": sum(delays) / len(delays) if delays else -1,
    }


def chart_data(runs: list[dict]) -> list[dict]:
    rows = []
    for key in ("51", "selfish", "withholding", "sybil"):
        attack_runs = [r for r in runs if r.get("attack") == key and not int(r.get("defense", 0) or 0)]
        defense_runs = [r for r in runs if r.get("attack") == key and int(r.get("defense", 0) or 0)]
        attack_pct = (
            100.0 * sum(1 for r in attack_runs if int(r.get("attack_success", 0) or 0)) / len(attack_runs)
            if attack_runs else 0.0
        )
        defense_pct = (
            100.0 * sum(1 for r in defense_runs if int(r.get("attack_success", 0) or 0)) / len(defense_runs)
            if defense_runs else 0.0
        )
        rows.append({
            "key": key,
            "label": attack_label(key),
            "attack_pct": round(attack_pct, 1),
            "defense_pct": round(defense_pct, 1),
            "attack_runs": len(attack_runs),
            "defense_runs": len(defense_runs),
        })
    return rows


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    runs = load_runs()
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "runs": runs[:8],
            "stats": run_stats(runs),
            "chart": chart_data(runs),
        },
    )


@app.get("/runs", response_class=HTMLResponse)
def runs_page(request: Request):
    return templates.TemplateResponse(request, "runs.html", {"runs": load_runs()})


@app.get("/runs/{name}", response_class=HTMLResponse)
def run_page(request: Request, name: str):
    run = load_run(name)
    if run is None:
        return templates.TemplateResponse(
            request, "error.html", {"message": f"Run « {name} » introuvable."}, status_code=404
        )
    windows = run["windows"]
    recent = windows[-40:]
    run["spark_orphan"] = sparkline([float(w.get("orphan_rate", 0) or 0) for w in recent])
    run["spark_score"] = sparkline([float(w.get("score", 0) or 0) for w in recent])
    run["windows_recent"] = recent
    return templates.TemplateResponse(request, "run.html", {"run": run})


@app.get("/launch", response_class=HTMLResponse)
def launch_page(request: Request):
    return templates.TemplateResponse(
        request,
        "launch.html",
        {
            "error": None,
            "form": {
                "name": "",
                "consensus": "pow",
                "nodes": 50,
                "attack": "51",
                "attacker_share": 0.8,
                "defense": "1",
                "seed": 1,
                "duration_blocks": 600,
            },
        },
    )


@app.post("/launch", response_class=HTMLResponse)
def launch(
    request: Request,
    name: str = Form(""),
    consensus: str = Form("pow"),
    nodes: int = Form(50),
    attack: str = Form("51"),
    attacker_share: float = Form(0.8),
    defense: str = Form("1"),
    seed: int = Form(1),
    duration_blocks: int = Form(600),
):
    form = {
        "name": name,
        "consensus": consensus,
        "nodes": nodes,
        "attack": attack,
        "attacker_share": attacker_share,
        "defense": defense,
        "seed": seed,
        "duration_blocks": duration_blocks,
    }
    error = None
    if consensus not in CONSENSUS:
        error = "Consensus invalide."
    elif attack not in ATTACKS:
        error = "Attaque invalide."
    elif not 5 <= nodes <= 200:
        error = "Le nombre de nœuds doit être entre 5 et 200."
    elif not 0.05 <= attacker_share <= 0.95:
        error = "La part de hash/stake doit être entre 5 % et 95 %."
    elif not 50 <= duration_blocks <= 2000:
        error = "La durée doit être entre 50 et 2000 blocs."
    elif not SIM.exists():
        error = "sim.exe est absent. Compilez avec « make sim »."

    if error:
        return templates.TemplateResponse(
            request, "launch.html", {"error": error, "form": form}, status_code=400
        )

    base = name.strip() or f"{attack}-{consensus}-n{nodes}-s{seed}"
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", base).strip("-").lower() or "run"
    candidate, counter = slug, 2
    while (RESULTS / candidate).exists():
        candidate = f"{slug}-{counter}"
        counter += 1
    slug = candidate

    defended = defense == "1"
    latency = 120 + int(nodes * 1.2)
    jitter = max(20, int(latency * 0.3))
    gossip = min(12, max(4, int(nodes ** 0.5) + 2))
    sybil_count = max(4, nodes // 2)
    victims = max(2, nodes // 10)

    lines = [
        f"name={slug}",
        f"seed={seed}",
        f"consensus={consensus}",
        f"nodes={nodes}",
        f"duration_blocks={duration_blocks}",
        "difficulty=2",
        "block_interval_ms=10000",
        f"latency_ms={latency}",
        f"jitter_ms={jitter}",
        f"gossip_degree={gossip}",
        "window_blocks=10",
        f"attack={attack}",
        f"attacker_share={attacker_share}",
        "attack_start_height=20",
        "confirm_depth=6",
        "gamma=1.0",
        f"pool_share={attacker_share}",
        "saboteur_share=0.3",
        f"sybil_count={sybil_count}",
        f"eclipse_victims={victims}",
        "detector=rule",
        f"defense={1 if defended else 0}",
        "max_reorg_depth=6",
        "pool_audit=1",
        "peer_diversity=1",
        "tie_random=1",
        "defense_confirm_depth=9",
        "freeze_on_alert=1",
        "selfish_penalty=1",
        f"outdir=results/runs/{slug}",
    ]
    config_path = SCENARIOS / f"{slug}.cfg"
    config_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    (RESULTS / slug).mkdir(parents=True, exist_ok=True)

    try:
        proc = subprocess.run(
            [str(SIM), str(config_path)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        error = f"Échec de l'exécution : {exc}"
        return templates.TemplateResponse(
            request, "launch.html", {"error": error, "form": form}, status_code=500
        )

    if proc.returncode != 0:
        error = (proc.stderr or proc.stdout or "Erreur inconnue").strip()
        return templates.TemplateResponse(
            request, "launch.html", {"error": error, "form": form}, status_code=500
        )

    return RedirectResponse(f"/runs/{slug}", status_code=303)
