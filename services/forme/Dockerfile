FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libxrender1 libsm6 libxext6 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home forme
COPY solid_engine.py ./
ENV HOST=0.0.0.0 PORT=8787 FORME_RESULTS_DIR=/tmp/forme-solids PYTHONDONTWRITEBYTECODE=1
USER forme
EXPOSE 8787
CMD ["python", "-m", "uvicorn", "solid_engine:app", "--host", "0.0.0.0", "--port", "8787", "--workers", "1"]
