all: build

setup: # Setup everything
	cd ui && npm i
	cd core && make setup

setup-mcp: # Setup MCP environment
	cd core && make setup-mcp

build: build-ui build-server ## Package everything

build-mcp: build-ui ## Build MCP server package
	cd core && make build-mcp

build-ui: ## Package frontend
	cd ui && npm run build

build-server: ## Package server
	cd core && make build

format:
	cd ui && npm run format
	cd core && make format

test: ## Test everything
	cd core && make test

clean: ## Remove virtual env and dependencies
	cd core && make clean

run-ui: ## Run dev server
	cd ui && npm run dev

run-server: ## Run app server
	cd core && make run

run-worker: ## Run app worker
	OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES cd core && make run-worker

run-redis: ## Run redis via docker
	cd core && make run-redis

run-mcp:
	cd core && make run-mcp

docker-build: ## Build Docker image
	docker build --no-cache -t h2oai-floodprediction-app:$(VERSION) .

docker-tag-releasetest: ## Tag image for h2oaireleasetest repo
	docker tag h2oai-floodprediction-app:$(VERSION) h2oaireleasetest/h2oai-flood-prediction:$(VERSION)
	docker tag h2oai-floodprediction-app:$(VERSION) h2oaireleasetest/h2oai-flood-prediction:latest

docker-push-releasetest: ## Push image to h2oaireleasetest repo
	docker push h2oaireleasetest/h2oai-flood-prediction:$(VERSION)
	docker push h2oaireleasetest/h2oai-flood-prediction:latest
