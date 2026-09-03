# Hugging Face Space (Docker SDK). Not used for local dev — see the plain
# `pip install -r requirements.txt` instructions in the repo README for that.
FROM python:3.11-slim

WORKDIR /app

# opencv-python needs libGL at runtime even though it's a "headless" workload.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# CPU-only torch/torchvision — plain `pip install -r requirements.txt` would
# pull the CUDA build, which is far larger than this box needs or can use.
# Installed first, then requirements.txt minus those two lines so the second
# install doesn't re-resolve them against the default (CUDA) index.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision \
    && grep -v -iE '^(torch|torchvision)([>=<~! ]|$)' requirements.txt > requirements-notorch.txt \
    && pip install --no-cache-dir -r requirements-notorch.txt

COPY . .

EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
