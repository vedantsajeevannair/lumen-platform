"""Retrain relevance_lr.npz -- the "is this a civic place at all?" check.

    python train_relevance.py --civic DIR [DIR ...] --other DIR [DIR ...]

`--civic` folders hold photographs that belong in a complaint: real complaint
photos, and also ordinary street scenes with nothing wrong in them, because a
road without damage is still the right kind of place. `--other` folders hold
everything that is not: documents and screens, animals, food, rooms, sport,
landscapes. The shipped weights were trained on 1500 civic complaint photos
from data/civic and data/manhole_seg plus 86 COCO street scenes, against 198
irrelevant COCO photographs and 50 phone photographs of paper; relevance.py
records how it scored on images it never saw.

Each photograph becomes Places365's 365 scene probabilities followed by
ImageNet's 1000 object probabilities -- the same two readings the gate takes
at runtime -- and a class-balanced, L2-regularised logistic regression is
fitted on their logarithms. Plain numpy, so the service needs nothing new.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

import scene_classifier
import subject_classifier

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def features(img: np.ndarray) -> np.ndarray | None:
    scene = scene_classifier.classify(img)
    subject = subject_classifier.classify(img)
    if scene is None or subject is None:
        return None
    return np.concatenate([scene["probs"], subject["probs"]]).astype(np.float64)


def load(dirs: list[str]) -> np.ndarray:
    rows = []
    for d in dirs:
        for f in sorted(Path(d).rglob("*")):
            if f.suffix.lower() not in EXTS:
                continue
            img = cv2.imread(str(f))
            x = None if img is None else features(img)
            if x is not None:
                rows.append(x)
    return np.stack(rows)


def fit(X: np.ndarray, y: np.ndarray, lam: float, iters: int = 3000, lr: float = 0.05):
    Z_raw = np.log(X + 1e-4)
    mu, sd = Z_raw.mean(0), Z_raw.std(0) + 1e-6
    Z = (Z_raw - mu) / sd
    # Balance the classes: there are always far more civic photos to hand.
    sw = np.where(y == 1, 0.5 / y.mean(), 0.5 / (1 - y.mean()))
    w, b = np.zeros(Z.shape[1]), 0.0
    for _ in range(iters):
        p = 1 / (1 + np.exp(-(Z @ w + b)))
        g = (p - y) * sw
        w -= lr * (Z.T @ g / len(y) + lam * w)
        b -= lr * g.mean()
    return w, b, mu, sd


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--civic", nargs="+", required=True)
    ap.add_argument("--other", nargs="+", required=True)
    ap.add_argument("--lam", type=float, default=0.03)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "relevance_lr.npz"))
    a = ap.parse_args()

    if not (scene_classifier.available() and subject_classifier.available()):
        raise SystemExit("Places365 and ImageNet weights are both required to train.")
    pos, neg = load(a.civic), load(a.other)
    X = np.vstack([pos, neg])
    y = np.concatenate([np.ones(len(pos)), np.zeros(len(neg))])
    w, b, mu, sd = fit(X, y, a.lam)
    np.savez(a.out, w=w, b=b, mu=mu, sd=sd)
    print(f"{len(pos)} civic, {len(neg)} other -> {a.out}")


if __name__ == "__main__":
    main()
