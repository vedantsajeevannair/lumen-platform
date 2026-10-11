"""Is this the kind of photograph a civic complaint is made of?

The checks before this one each recognise one kind of wrong upload -- an
interior, a dominant COCO object, a page, a flat graphic. Listing kinds does not
end: the gate as it stood admitted 76 of 100 photographs of paper, and on 128
everyday COCO photographs it let through bears, donuts, hot dogs, flower vases,
baseball games, a bedroom and a jungle, which the garbage detector then labelled
"Garbage Pile" at up to 0.88 and routed to Sanitation.

So this learns the question instead of enumerating answers. Its input is the
two readings the gate already takes -- Places365's 365 scene probabilities and
ImageNet's 1000 object probabilities -- and its output is the probability that
the photograph is of a street, road or public place. It is a logistic
regression: one dot product, no new dependency, and the weights are a 22 KB
file that sits in the repository beside this one.

Trained on 1500 civic complaint photographs and 86 COCO street scenes as
"civic", against 198 irrelevant COCO photographs and 50 photographs of paper.
Street scenes count as civic on purpose: a road with nothing wrong with it is
the right kind of place, and refusing it as "unrelated" would teach the model
that streets are irrelevant. Evaluated on images it never saw, at the 0.30 bar:

    held-out complaint photographs   1100 of 1104 admitted
    irrelevant COCO photographs        91 of  103 refused
    photographs of unseen paper pages  50 of   50 refused

Of the four complaint photographs it refused, two are not complaints at all --
a "404" door sign and a French bulldog in a green jersey, mislabelled in the
public dataset -- and two are litter on grass. Several of the twelve COCO
photographs it admitted are civic in fact: a television dumped in a pond, a
street sign, a plaza.

The bar is low on purpose. A refused genuine complaint is a resident who walked
away; an admitted irrelevant photograph still has to get past the damage
detectors, and with nothing detected the resident is told so.

Degrades open: with either reading or the weights missing, `score()` returns
None and the caller skips this check.
"""
from __future__ import annotations

import functools
from pathlib import Path

import numpy as np

_WEIGHTS = Path(__file__).resolve().parent / "relevance_lr.npz"

MIN_RELEVANCE = 0.30


@functools.lru_cache(maxsize=1)
def _load():
    if not _WEIGHTS.exists():
        return None
    try:
        m = np.load(_WEIGHTS)
        return {k: m[k].astype(np.float64) for k in ("w", "b", "mu", "sd")}
    except Exception:
        return None


def score(scene_probs, object_probs) -> float | None:
    """Probability the photograph is of a civic place, or None if unavailable.

    `scene_probs` are Places365's 365 probabilities and `object_probs`
    ImageNet's 1000, in each model's own class order -- the order the weights
    were trained in.
    """
    m = _load()
    if m is None or scene_probs is None or object_probs is None:
        return None
    x = np.concatenate([np.asarray(scene_probs, np.float64), np.asarray(object_probs, np.float64)])
    if x.shape[0] != m["w"].shape[0]:
        return None
    z = (np.log(x + 1e-4) - m["mu"]) / m["sd"]
    return float(1.0 / (1.0 + np.exp(-(z @ m["w"] + float(m["b"])))))
