# syntax=docker/dockerfile:1

# ---------- Stage 1: build webui static files ----------
FROM node:16-bullseye AS webui-builder
WORKDIR /build/webui
COPY webui/package.json webui/package-lock.json ./
RUN npm i --legacy-peer-deps
COPY webui ./
RUN mkdir -p ./public/assets/styles && \
  node dark && node light && node cyber && \
  printf '@import url(/api/setting/getBackground.less);\n.body-bg {\n  background:@vt-bg-image;\n  background-position-x:center;\n  background-position-y:center;\n  background-size:cover;\n}\n\n.login-layout {\n  background:@body-background;\n}\n\n' >> ./public/assets/styles/cyber.less && \
  printf '\n' > ./public/assets/styles/follow.less && \
  npm run build

# ---------- Stage 2: vertex application ----------
FROM lswl/vertex-base:latest
LABEL maintainer="vioeloria"
LABEL build_from="https://github.com/vioeloria/vertex-mod"

ENV TZ=Asia/Shanghai

RUN apk add --no-cache gcc g++ python3 make libc-dev npm

WORKDIR /app/vertex
COPY package.json package-lock.json ./
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm i --save

COPY app ./app
COPY webhook ./webhook
COPY docker ./docker
COPY --from=webui-builder /build/app/static ./app/static

RUN \
  mkdir /vertex && \
  ln -s /vertex/data /app/vertex/app/data && \
  ln -s /vertex/db /app/vertex/app/db && \
  ln -s /vertex/logs /app/vertex/logs && \
  ln -s /vertex/torrents /app/vertex/torrents && \
  mv /app/vertex/app/config /app/vertex/app/config_backup && \
  ln -s /vertex/config /app/vertex/app/config && \
  ln -s /app/localtime /etc/localtime && \
  ln -s /usr/bin/chromium-browser /usr/bin/chromium && \
  chmod +x /usr/bin/chromium && \
  apk del gcc g++ python3 make libc-dev npm && \
  echo 'bind 127.0.0.1' >> /app/redis.conf && \
  echo 'daemonize yes' >> /app/redis.conf

RUN \
  useradd -d /app/vertex -s /bin/sh vt && \
  chown -R vt /vertex && \
  chmod +x /vertex

EXPOSE 3000
CMD bash /app/vertex/docker/start.sh
