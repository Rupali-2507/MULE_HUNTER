FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Step A — core deps + torch (CPU build)
RUN pip install --no-cache-dir fastapi==0.115.0 "uvicorn[standard]==0.30.6" pydantic==2.8.2 \
    pandas==2.2.2 numpy==1.26.4 scikit-learn==1.5.1 networkx==3.3 httpx \
    torch==2.3.1 --extra-index-url https://download.pytorch.org/whl/cpu

# Step B — torch-geometric
RUN pip install --no-cache-dir torch-geometric==2.5.3

# Step C — torch-scatter / torch-sparse matched to the exact torch+cpu build
RUN pip install --no-cache-dir torch-scatter torch-sparse \
    -f https://data.pyg.org/whl/torch-2.3.1+cpu.html

COPY . .

EXPOSE 8001

CMD ["uvicorn", "inference_service:app", "--host", "0.0.0.0", "--port", "8001"]