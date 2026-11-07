FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-impress fontconfig && rm -rf /var/lib/apt/lists/*
COPY assets/fonts /usr/local/share/fonts/ibm-plex
RUN fc-cache -f
WORKDIR /work
ENTRYPOINT ["libreoffice", "-env:UserInstallation=file:///tmp/lo-profile", "--headless", "--convert-to", "pdf", "--outdir", "/work"]
