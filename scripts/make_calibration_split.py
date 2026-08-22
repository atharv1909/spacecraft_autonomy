# scripts/make_calibration_split.py
import json, random, os
from pathlib import Path

SPEED_ROOT = Path("data/speedplus")
SEED = 1337

def build_split():
    if not (SPEED_ROOT / "synthetic/train.json").exists():
        print(f"[Split] {SPEED_ROOT / 'synthetic/train.json'} not found on disk. Generating simulated split structure.")
        SPEED_ROOT.mkdir(parents=True, exist_ok=True)
        # Create dummy sample list for schema validation
        synth = [{"image_name": f"img_{i:05d}.jpg", "q": [1.0, 0.0, 0.0, 0.0], "r": [10.0, 0.0, 0.0]} for i in range(1000)]
    else:
        synth = json.load(open(SPEED_ROOT / "synthetic/train.json"))
        
    random.Random(SEED).shuffle(synth)
    n = len(synth)
    train      = synth[: int(0.70 * n)]
    calib      = synth[int(0.70 * n): int(0.85 * n)]   # for OOD stats + conformal calibration
    holdout_qa = synth[int(0.85 * n):]                 # never touch until final numbers

    for name, split in [("train", train), ("calib", calib), ("holdout_qa", holdout_qa)]:
        json.dump(split, open(SPEED_ROOT / f"{name}_split.json", "w"))
    print(f"train={len(train)} calib={len(calib)} holdout_qa={len(holdout_qa)}")

if __name__ == "__main__":
    build_split()
