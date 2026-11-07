FROM python:3.12-slim
COPY sandbox/run.py /opt/judge/run.py
ENV PYTHONDONTWRITEBYTECODE=1
USER 65534:65534
WORKDIR /work
ENTRYPOINT ["python3", "-I", "/opt/judge/run.py"]
