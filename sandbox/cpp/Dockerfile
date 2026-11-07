FROM gcc:14-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
COPY sandbox/run.py /opt/judge/run.py
USER 65534:65534
WORKDIR /work
ENTRYPOINT ["python3", "-I", "/opt/judge/run.py"]
