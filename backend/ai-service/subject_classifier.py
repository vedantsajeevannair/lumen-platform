"""What is this photograph *of*?

The scene classifier answers "where was this taken" and the COCO check answers
"what objects are in it". Neither recognises a sheet of paper. A photograph of
a page lying on a desk has no COCO object in it at all, and Places365 reads it
as a home theatre, a barn door, a hangar or a sauna -- whatever scene its
colour and layout happen to resemble. Measured on 100 simulated phone
photographs of printed and handwritten pages, the gate as it stood admitted 76.
That is how a resident's photo of a paper was filed as a complaint.

ImageNet does know documents. Its 1000 classes include envelope, menu, web
site, binder, book jacket and screen, and a photographed page lands on them:

    paper photographs     envelope, web site, binder, menu, screen, book jacket
    complaint photographs manhole cover, ashcan, trailer truck, traffic light

The summed probability on those classes -- `document` below -- separated the
two sets almost completely: 99 of 100 paper photographs scored 0.25 or more,
against 1 of 1104 genuine complaint photographs. The one genuine hit was a
grated drain cover, which is also why crossword puzzle and slide rule are left
out of the set: ImageNet calls a drain grating a crossword, and including those
two classes rejected six real manholes to catch no extra paper.

Its own copy of ResNet-18, deliberately not shared with model._get_embedder.
That network produces the stored duplicate-detection embeddings, and anything
that disturbed it would quietly change what every past complaint is compared
against. Forty-odd megabytes of memory is the cheaper price.

Degrades open, like scene_classifier: if torch or the weights are missing,
`classify()` returns None and the caller skips the check.
"""
from __future__ import annotations

import functools

# Things that are a page or a screen. The summed probability on these is the
# `document` reading. Chosen from what ImageNet actually called photographs of
# paper, not from what sounds plausible.
DOCUMENT_CLASSES = {
    "envelope", "web site", "binder", "menu", "screen", "book jacket",
    "cash machine", "rule", "notebook", "laptop", "monitor", "desktop computer",
    "packet", "comic book", "digital clock", "iPod", "modem", "oscilloscope",
    "rubber eraser", "toilet tissue", "paper towel", "pencil box", "scoreboard",
    "television", "hand-held computer", "cellular telephone", "file",
}

MIN_DOCUMENT_MASS = 0.25


@functools.lru_cache(maxsize=1)
def _load():
    """(model, transform, document class indices) or (None, None, None)."""
    try:
        import torch  # noqa: F401
        import torchvision.transforms as T
        from torchvision.models import resnet18, ResNet18_Weights

        weights = ResNet18_Weights.DEFAULT
        net = resnet18(weights=weights).eval()
        names = weights.meta["categories"]
        tf = T.Compose([
            T.ToPILImage(),
            T.Resize(256),
            T.CenterCrop(224),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        doc_idx = [i for i, n in enumerate(names) if n in DOCUMENT_CLASSES]
        return net, tf, (names, doc_idx)
    except Exception:
        # A missing optional dependency must not take the detector down.
        return None, None, None


def available() -> bool:
    return _load()[0] is not None


def classify(img) -> dict | None:
    """ImageNet reading for a BGR image, or None if the model is unavailable."""
    net, tf, meta = _load()
    if net is None:
        return None

    import cv2
    import torch

    names, doc_idx = meta
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    with torch.no_grad():
        probs = torch.softmax(net(tf(rgb).unsqueeze(0))[0], dim=0)

    top_p, top_i = probs.topk(3)
    return {
        "document": round(float(probs[doc_idx].sum()), 4),
        "top": [(names[int(i)], round(float(p), 4)) for p, i in zip(top_p, top_i)],
        # The full distribution, for relevance.score(). Not part of any API
        # response -- model.assess_scene drops it.
        "probs": probs.numpy(),
    }
