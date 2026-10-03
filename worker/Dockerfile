# The worker runs in Microsoft's Playwright image so headless Chromium and its
# system libraries are there. Keep the tag in step with playwright in
# requirements.txt.
FROM mcr.microsoft.com/playwright/python:v1.56.0-noble

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY worker ./worker

ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "worker.main"]
