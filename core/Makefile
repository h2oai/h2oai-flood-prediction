all: build

setup-mcp:
	python3.11 -m venv venv-mcp
	./venv-mcp/bin/python3.11 -m pip install --upgrade pip
	./venv-mcp/bin/python3.11 -m pip install -r requirements-mcp.txt
	./venv-mcp/bin/python3.11 -m pip install -e .

setup: setup-mcp
	python3.11 -m venv venv
	./venv/bin/python3.11 -m pip install --upgrade pip wheel build twine tomli pyright pytest pytest-cov black[colorama]
	./venv/bin/python3.11 -m pip install -e .

.PHONY: build
build: clean-build ## Package everything
	mkdir -p src/flood_prediction/www
	cp -r ../ui/dist/*  src/flood_prediction/www
	./venv/bin/python3.11 -m build --wheel
# 	rm -rf src/flood_prediction/www

.PHONY: test
test:
	./venv/bin/python -u -m pytest --color=yes -s -v --full-trace --rootdir=. tests

format:
	./venv/bin/black src tests
	./venv/bin/isort src tests

check:
	./venv/bin/pyright

clean-build: ## Clean build debris
	rm -rf build
	rm -rf dist
	rm -rf **/*.egg-info

clean: clean-build
	rm -rf venv
	rm -rf venv-mcp

run: ## Run backend
	./venv/bin/uvicorn flood_prediction.server:app --reload --reload-dir src/flood_prediction/ --host 0.0.0.0 --port 8000 --reload-dir src

run-worker: ## Run worker
	OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES ./venv/bin/rq worker

run-redis: ## Run redis
	sudo docker run -p 6379:6379 redis

run-mcp:
	./venv-mcp/bin/python3.11 -m flood_prediction.agents.mcp_unified_flood_server

build-mcp: clean-build ## Build MCP package with separate venv
	mkdir -p src/flood_prediction/www
	cp -r ../ui/dist/*  src/flood_prediction/www
	./venv-mcp/bin/python3.11 -m pip install -e .
	./venv-mcp/bin/python3.11 -m build --wheel