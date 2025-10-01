FROM node:22-alpine AS ui-build
WORKDIR /app/ui

COPY ui/ .

RUN npm install

RUN npm run build

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	PIP_NO_CACHE_DIR=1 \
	APP_HOME=/app \
	PORT=8000

WORKDIR ${APP_HOME}/core

RUN apt-get update \
	&& apt-get install -y --no-install-recommends build-essential curl netcat-openbsd \
	&& rm -rf /var/lib/apt/lists/*

COPY core/requirements.server.txt core/requirements-mcp.txt ./

RUN python -m venv venv \
	&& ./venv/bin/python -m pip install --upgrade pip \
	&& ./venv/bin/python -m pip install -r requirements.server.txt

RUN python -m venv venv-mcp \
	&& ./venv-mcp/bin/python -m pip install --upgrade pip \
	&& ./venv-mcp/bin/python -m pip install -r requirements-mcp.txt

COPY core/ .
COPY --from=ui-build /app/ui/dist/ ./src/flood_prediction/www/

RUN ./venv/bin/python -m pip install -e .
RUN ./venv-mcp/bin/python -m pip install -e .

EXPOSE 8000

COPY core/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]


# docker build -t h2oai-flood-prediction:v0.2.0 .

# docker run --rm -it \
#   -p 8000:8000 \
#   --env-file "$(pwd)/core/.env" \
#   -v "$(pwd)/core/.env:/app/core/.env:ro" \
#   --name h2oai-flood-prediction \
#   h2oai-flood-prediction:v0.2.0
