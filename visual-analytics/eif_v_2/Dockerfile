FROM python:3.10-slim

WORKDIR /app

# 🔥 Install full build toolchain
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Upgrade pip
RUN pip install --upgrade pip

# 🔥 CRITICAL: Use compatible versions
RUN pip install numpy==1.26.4 Cython==0.29.36 wheel setuptools

# 🔥 Force C++ mode
ENV CXX=g++
ENV CFLAGS="-std=c++11"
ENV CXXFLAGS="-std=c++11"

# 🔥 Install EIF separately (important)
RUN pip install --no-build-isolation eif==2.0.2

# Install remaining dependencies (WITHOUT eif)
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    scikit-learn \
    pandas \
    joblib \
    pydantic

# Copy app
COPY app ./app
COPY models ./models

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]