"""Run the small reproducible attack matrix and write results/summaries.csv."""
from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SIM = ROOT / ("sim.exe" if os.name == "nt" else "sim")
RUNS = ROOT / "results" / "runs"
SCENARIOS = ROOT / "scenarios" / "generated"
SUMMARY_CSV = ROOT / "results" / "summaries.csv"
SUMMARY_MD = ROOT / "results" / "summary.md"

ATTACKS = ("51", "selfish", "withholding", "sybil")
CONSENSUS = ("pow", "pos")
FIELDS = (
    "name", "attack", "consensus", "nodes", "defense", "seed", "attack_share",
    "attack_success", "detection_time_ms", "alerts", "false_alerts",
    "max_reorg_depth", "orphan_rate", "honest_orphan_rate", "attacker_profit",
    "victim_loss", "pool_loss", "selfish_revenue_ratio", "victim_lag",
    "withheld_ratio", "canonical_blocks", "blocks_mined", "runtime_ms",
    "defense_prevented",
)


def config_text(name: str, attack: str, consensus: str, nodes: int,
                defense: bool, seed: int, duration: int = 300,
                share: float = 0.60) -> str:
    latency = 120 + int(nodes * 1.2)
    jitter = max(20, int(latency * 0.3))
    gossip = min(12, max(4, int(nodes ** 0.5) + 2))
    lines = [
        f"name={name}",
        f"seed={seed}",
        f"consensus={consensus}",
        f"nodes={nodes}",
        f"duration_blocks={duration}",
        "difficulty=2",
        "block_interval_ms=10000",
        f"latency_ms={latency}",
        f"jitter_ms={jitter}",
        f"gossip_degree={gossip}",
        "loss=0.0",
        "window_blocks=10",
        "observer=0",
        "log_events=0",
        f"attack={attack}",
        f"attacker_share={share}",
        "attack_start_height=20",
        "confirm_depth=6",
        "gamma=1.0",
        "pool_share=0.40",
        "saboteur_share=0.30",
        f"sybil_count={max(4, nodes // 2)}",
        f"eclipse_victims={max(2, nodes // 10)}",
        "block_reward=50.0",
        "victim_value=1000.0",
        "pool_fee=0.02",
        "detector=rule",
        f"defense={1 if defense else 0}",
        "max_reorg_depth=6",
        "pool_audit=1",
        "peer_diversity=1",
        "tie_random=1",
        "defense_confirm_depth=9",
        "freeze_on_alert=1",
        "selfish_penalty=1",
        f"outdir=results/runs/{name}",
    ]
    return "\n".join(lines) + "\n"


def scenario_list(quick: bool) -> list[dict]:
    seeds = (1,) if quick else (1, 2, 3)
    sizes = (50,) if quick else (50, 100)
    scenarios = []
    for consensus in CONSENSUS:
        for nodes in sizes:
            for seed in seeds:
                name = f"baseline-{consensus}-n{nodes}-s{seed}"
                scenarios.append(dict(name=name, attack="none", consensus=consensus,
                                      nodes=nodes, defense=False, seed=seed,
                                      share=0.60, duration=300))
    for attack in ATTACKS:
        for consensus in CONSENSUS:
            for nodes in sizes:
                for defense in (False, True):
                    for seed in seeds:
                        suffix = "def" if defense else "raw"
                        name = f"{attack}-{consensus}-n{nodes}-s{seed}-{suffix}"
                        majority = attack == "51"
                        scenarios.append(dict(
                            name=name, attack=attack, consensus=consensus,
                            nodes=nodes, defense=defense, seed=seed,
                            share=0.80 if majority else 0.60,
                            duration=600 if majority else 300,
                        ))
    return scenarios


def run_one(item: dict) -> dict:
    (RUNS / item["name"]).mkdir(parents=True, exist_ok=True)
    cfg_path = SCENARIOS / f"{item['name']}.cfg"
    cfg_path.write_text(
        config_text(item["name"], item["attack"], item["consensus"],
                    item["nodes"], item["defense"], item["seed"],
                    duration=item["duration"], share=item["share"]),
        encoding="utf-8",
    )
    proc = subprocess.run(
        [str(SIM), str(cfg_path)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"{item['name']} failed:\n{proc.stderr or proc.stdout}"
        )
    summary_path = RUNS / item["name"] / "summary.json"
    if not summary_path.exists():
        raise RuntimeError(f"{item['name']}: missing {summary_path}")
    return json.loads(summary_path.read_text(encoding="utf-8"))


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def aggregate(rows: list[dict]) -> list[dict]:
    groups: dict[tuple, list[dict]] = {}
    for row in rows:
        key = (row["attack"], row["consensus"], int(row["nodes"]), int(row["defense"]))
        groups.setdefault(key, []).append(row)
    result = []
    for (attack, consensus, nodes, defense), group in sorted(groups.items()):
        detections = [
            int(r["detection_time_ms"]) for r in group
            if int(r["detection_time_ms"]) >= 0
        ]
        result.append({
            "attack": attack,
            "consensus": consensus,
            "nodes": nodes,
            "defense": defense,
            "runs": len(group),
            "success_rate": mean([float(r["attack_success"]) for r in group]),
            "detection_s": mean(detections) / 1000.0 if detections else -1.0,
            "orphan_rate": mean([float(r["orphan_rate"]) for r in group]),
            "victim_loss": mean([float(r["victim_loss"]) for r in group]),
            "attacker_profit": mean([float(r["attacker_profit"]) for r in group]),
            "pool_loss": mean([float(r["pool_loss"]) for r in group]),
            "victim_lag": mean([float(r["victim_lag"]) for r in group]),
            "selfish_ratio": mean([float(r["selfish_revenue_ratio"]) for r in group]),
            "withheld_ratio": mean([float(r["withheld_ratio"]) for r in group]),
        })
    return result


def write_markdown(groups: list[dict]) -> None:
    lines = [
        "# Aggregate results",
        "",
        "| Attack | Consensus | Nodes | Defense | Runs | Success | Detection | Orphans | Victim loss | Attacker profit |",
        "|---|---|---:|---|---:|---:|---:|---:|---:|---:|",
    ]
    for g in groups:
        detection = "—" if g["detection_s"] < 0 else f"{g['detection_s']:.1f}s"
        lines.append(
            f"| {g['attack']} | {g['consensus'].upper()} | {g['nodes']} | "
            f"{'on' if g['defense'] else 'off'} | {g['runs']} | "
            f"{g['success_rate'] * 100:.0f}% | {detection} | "
            f"{g['orphan_rate'] * 100:.1f}% | {g['victim_loss']:.0f} | "
            f"{g['attacker_profit']:.0f} |"
        )
    SUMMARY_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quick", action="store_true",
                        help="one seed and one network size")
    parser.add_argument("--clean", action="store_true",
                        help="remove previous runs before starting")
    args = parser.parse_args()

    if not SIM.exists():
        print(f"error: {SIM.name} not found. Run 'make sim' first.", file=sys.stderr)
        return 1
    if args.clean:
        shutil.rmtree(RUNS, ignore_errors=True)
        SUMMARY_CSV.unlink(missing_ok=True)
        SUMMARY_MD.unlink(missing_ok=True)
    RUNS.mkdir(parents=True, exist_ok=True)
    SCENARIOS.mkdir(parents=True, exist_ok=True)

    scenarios = scenario_list(args.quick)
    rows = []
    for index, item in enumerate(scenarios, 1):
        print(f"[{index:>3}/{len(scenarios)}] {item['name']}", flush=True)
        summary = run_one(item)
        rows.append({field: summary.get(field, "") for field in FIELDS})

    rows.sort(key=lambda r: (r["attack"], r["consensus"], int(r["nodes"]),
                             int(r["defense"]), int(r["seed"])))
    with SUMMARY_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    groups = aggregate(rows)
    write_markdown(groups)

    print()
    print(f"{'Attack':<14}{'Cons':<6}{'Nodes':>6}{'Def':>5}{'Runs':>6}{'Success':>9}{'Detect':>9}")
    for g in groups:
        detection = "—" if g["detection_s"] < 0 else f"{g['detection_s']:.1f}s"
        print(
            f"{g['attack']:<14}{g['consensus'].upper():<6}{g['nodes']:>6}"
            f"{'on' if g['defense'] else 'off':>5}{g['runs']:>6}"
            f"{g['success_rate'] * 100:>8.0f}%{detection:>9}"
        )
    print()
    print(f"wrote {SUMMARY_CSV.relative_to(ROOT)}")
    print(f"wrote {SUMMARY_MD.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
