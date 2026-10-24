FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY hospital-price-explorer/requirements.txt ./hospital-price-explorer/requirements.txt
RUN pip install --no-cache-dir -r hospital-price-explorer/requirements.txt
COPY hospital-price-explorer/ ./hospital-price-explorer/
COPY three_hospitals_25_procedures.xlsx ./three_hospitals_25_procedures.xlsx
WORKDIR /app/hospital-price-explorer
RUN python build_db.py
CMD ["python", "start_server.py"]
