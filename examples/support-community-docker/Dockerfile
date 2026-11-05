FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3

RUN apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=30 update \
    && apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=30 install -y --no-install-recommends \
       ca-certificates curl dbus jq libstdc++6 libgcc-s1 libsecret-1-0 nginx-light \
    && rm -rf /var/lib/apt/lists/*

COPY config.json /opt/demo-config.json
RUN version=$(jq -r .arcVersion /opt/demo-config.json) \
    && digest=$(jq -r .archiveSha256 /opt/demo-config.json) \
    && curl --fail --location --retry 3 --connect-timeout 20 --max-time 300 \
       "https://dl.arcblock.io/arc-${version}-linux-x64.tar.gz" -o /tmp/arc.tar.gz \
    && printf '%s  /tmp/arc.tar.gz\n' "$digest" | sha256sum --check --strict \
    && mkdir /opt/arc \
    && tar -xzf /tmp/arc.tar.gz -C /opt/arc --strip-components=1 \
    && cd /opt/arc && sha256sum --check --strict dist-manifest.sha256 > /dev/null \
    && rm /tmp/arc.tar.gz

ENV PATH="/opt/arc:$PATH" ARC_INSTANCES_DIR=/data/registry
COPY prepare-demo.mjs /opt/prepare-demo.mjs
# Generate third-party template material locally; do not vendor it into Git.
RUN arc blocklet create /opt/demo --name didmail-support-demo --template support-community --json \
    && BUN_BE_BUN=1 /opt/arc/arc-linux-x64 /opt/prepare-demo.mjs \
    && arc blocklet check /opt/demo --profile support-community \
    && arc dsl validate /opt/demo --json

COPY entrypoint.sh /usr/local/bin/support-demo
COPY nginx.conf /opt/demo-proxy.conf
COPY warmup.mjs /opt/warmup.mjs
RUN chmod +x /usr/local/bin/support-demo
WORKDIR /data
EXPOSE 8080
ENTRYPOINT ["dbus-run-session", "--", "/usr/local/bin/support-demo"]
