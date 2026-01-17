# Makefile for Lists Viewer Project
# Build, test, and deploy automation

.PHONY: help
help: ## Show this help message
	@echo "Lists Viewer - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Variables
DOCKER_REGISTRY ?= docker.io
IMAGE_NAME ?= lists-viewer
IMAGE_TAG ?= latest
FULL_IMAGE := $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Remote server configuration
REMOTE_HOST ?= 
REMOTE_USER ?= root
REMOTE_PORT ?= 22

HELM_RELEASE ?= lists-viewer
HELM_NAMESPACE ?= default
HELM_CHART := ./helm/lists-viewer

# Colors for output
COLOR_RESET = \033[0m
COLOR_INFO = \033[36m
COLOR_SUCCESS = \033[32m
COLOR_WARNING = \033[33m

##@ Development

.PHONY: install
install: ## Install dependencies for client and server
	@echo "$(COLOR_INFO)Installing client dependencies...$(COLOR_RESET)"
	cd client && npm ci
	@echo "$(COLOR_INFO)Installing server dependencies...$(COLOR_RESET)"
	cd server && go mod download
	@echo "$(COLOR_SUCCESS)✓ Dependencies installed$(COLOR_RESET)"

.PHONY: dev-client
dev-client: ## Start client development server
	@echo "$(COLOR_INFO)Starting client dev server...$(COLOR_RESET)"
	cd client && npm run dev

.PHONY: dev-server
dev-server: ## Start server development server
	@echo "$(COLOR_INFO)Starting server...$(COLOR_RESET)"
	cd server && go run cmd/server/main.go

.PHONY: dev
dev: ## Start full development environment with Docker Compose
	@echo "$(COLOR_INFO)Starting development environment...$(COLOR_RESET)"
	docker compose up --build

.PHONY: dev-down
dev-down: ## Stop development environment
	@echo "$(COLOR_INFO)Stopping development environment...$(COLOR_RESET)"
	docker compose down

##@ Testing

.PHONY: test-client
test-client: ## Run client unit tests
	@echo "$(COLOR_INFO)Running client tests...$(COLOR_RESET)"
	cd client && npm test

.PHONY: test-client-ui
test-client-ui: ## Run client tests with UI
	@echo "$(COLOR_INFO)Running client tests with UI...$(COLOR_RESET)"
	cd client && npm run test:ui

.PHONY: test-client-coverage
test-client-coverage: ## Run client tests with coverage
	@echo "$(COLOR_INFO)Running client tests with coverage...$(COLOR_RESET)"
	cd client && npm run test:coverage

.PHONY: test-server
test-server: ## Run server tests
	@echo "$(COLOR_INFO)Running server tests...$(COLOR_RESET)"
	cd server && go test -v ./...

.PHONY: test-e2e
test-e2e: ## Run E2E tests
	@echo "$(COLOR_INFO)Running E2E tests...$(COLOR_RESET)"
	cd e2e && npx playwright test

.PHONY: test-e2e-ui
test-e2e-ui: ## Run E2E tests with UI
	@echo "$(COLOR_INFO)Running E2E tests with UI...$(COLOR_RESET)"
	cd e2e && npx playwright test --ui

.PHONY: test
test: test-client test-server ## Run all tests (client + server)

.PHONY: test-all
test-all: test test-e2e ## Run all tests including E2E

##@ Build

.PHONY: build-client
build-client: ## Build client for production
	@echo "$(COLOR_INFO)Building client...$(COLOR_RESET)"
	cd client && npm run build
	@echo "$(COLOR_SUCCESS)✓ Client built successfully$(COLOR_RESET)"

.PHONY: build-server
build-server: ## Build server binary
	@echo "$(COLOR_INFO)Building server...$(COLOR_RESET)"
	cd server && CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o server ./cmd/server
	@echo "$(COLOR_SUCCESS)✓ Server built successfully$(COLOR_RESET)"

.PHONY: build
build: build-client build-server ## Build both client and server

.PHONY: clean
clean: ## Clean build artifacts
	@echo "$(COLOR_INFO)Cleaning build artifacts...$(COLOR_RESET)"
	rm -rf client/dist
	rm -rf client/node_modules
	rm -f server/server
	@echo "$(COLOR_SUCCESS)✓ Build artifacts cleaned$(COLOR_RESET)"

##@ Docker

.PHONY: docker-build
docker-build: ## Build Docker image
	@echo "$(COLOR_INFO)Building Docker image: $(FULL_IMAGE)...$(COLOR_RESET)"
	docker build -t $(FULL_IMAGE) .
	@echo "$(COLOR_SUCCESS)✓ Docker image built: $(FULL_IMAGE)$(COLOR_RESET)"

.PHONY: docker-save
docker-save: ## Save Docker image to tar file
	@echo "$(COLOR_INFO)Saving Docker image to tar file...$(COLOR_RESET)"
	mkdir -p ./build
	docker save $(FULL_IMAGE) -o ./build/$(IMAGE_NAME)-$(IMAGE_TAG).tar
	@echo "$(COLOR_SUCCESS)✓ Docker image saved to ./build/$(IMAGE_NAME)-$(IMAGE_TAG).tar$(COLOR_RESET)"

.PHONY: docker-push
docker-push: ## Push Docker image to registry
	@echo "$(COLOR_INFO)Pushing Docker image: $(FULL_IMAGE)...$(COLOR_RESET)"
	docker push $(FULL_IMAGE)
	@echo "$(COLOR_SUCCESS)✓ Docker image pushed: $(FULL_IMAGE)$(COLOR_RESET)"

.PHONY: docker-run
docker-run: ## Run Docker container locally
	@echo "$(COLOR_INFO)Running Docker container...$(COLOR_RESET)"
	docker run -p 8080:8080 --env-file .env $(FULL_IMAGE)

.PHONY: docker-clean
docker-clean: ## Remove Docker images and containers
	@echo "$(COLOR_INFO)Cleaning Docker images and containers...$(COLOR_RESET)"
	docker compose down -v
	docker rmi $(FULL_IMAGE) 2>/dev/null || true
	rm -rf ./build
	@echo "$(COLOR_SUCCESS)✓ Docker cleanup complete$(COLOR_RESET)"

##@ Kubernetes/Helm

.PHONY: helm-lint
helm-lint: ## Lint Helm charts
	@echo "$(COLOR_INFO)Linting Helm charts...$(COLOR_RESET)"
	helm lint $(HELM_CHART)
	@echo "$(COLOR_SUCCESS)✓ Helm charts validated$(COLOR_RESET)"

.PHONY: helm-template
helm-template: ## Render Helm templates (dry-run)
	@echo "$(COLOR_INFO)Rendering Helm templates...$(COLOR_RESET)"
	helm template $(HELM_RELEASE) $(HELM_CHART) --namespace $(HELM_NAMESPACE)

.PHONY: helm-install
helm-install: ## Install application with Helm
	@echo "$(COLOR_INFO)Installing $(HELM_RELEASE) to $(HELM_NAMESPACE)...$(COLOR_RESET)"
	helm install $(HELM_RELEASE) $(HELM_CHART) --namespace $(HELM_NAMESPACE) --create-namespace
	@echo "$(COLOR_SUCCESS)✓ Application installed$(COLOR_RESET)"

.PHONY: helm-upgrade
helm-upgrade: ## Upgrade application with Helm
	@echo "$(COLOR_INFO)Upgrading $(HELM_RELEASE) in $(HELM_NAMESPACE)...$(COLOR_RESET)"
	helm upgrade $(HELM_RELEASE) $(HELM_CHART) --namespace $(HELM_NAMESPACE) --install
	@echo "$(COLOR_SUCCESS)✓ Application upgraded$(COLOR_RESET)"

.PHONY: helm-uninstall
helm-uninstall: ## Uninstall application with Helm
	@echo "$(COLOR_INFO)Uninstalling $(HELM_RELEASE) from $(HELM_NAMESPACE)...$(COLOR_RESET)"
	helm uninstall $(HELM_RELEASE) --namespace $(HELM_NAMESPACE)
	@echo "$(COLOR_SUCCESS)✓ Application uninstalled$(COLOR_RESET)"

.PHONY: helm-status
helm-status: ## Show Helm release status
	@helm status $(HELM_RELEASE) --namespace $(HELM_NAMESPACE)

##@ Deployment

.PHONY: check-remote
check-remote: ## Check if remote server variables are set
	@if [ -z "$(REMOTE_HOST)" ]; then \
		echo "$(COLOR_WARNING)Error: REMOTE_HOST is not set$(COLOR_RESET)"; \
		echo "Usage: make deploy-dev REMOTE_HOST=your-server.com"; \
		exit 1; \
	fi

.PHONY: deploy-image
deploy-image: docker-build docker-save check-remote ## Build, save, and deploy image to remote server
	@echo "$(COLOR_INFO)Copying image to remote server $(REMOTE_HOST)...$(COLOR_RESET)"
	ssh -p $(REMOTE_PORT) $(REMOTE_USER)@$(REMOTE_HOST) "mkdir -p /tmp/images"
	scp -P $(REMOTE_PORT) ./build/$(IMAGE_NAME)-$(IMAGE_TAG).tar $(REMOTE_USER)@$(REMOTE_HOST):/tmp/images/
	@echo "$(COLOR_INFO)Importing image to containerd on remote server...$(COLOR_RESET)"
	ssh -p $(REMOTE_PORT) $(REMOTE_USER)@$(REMOTE_HOST) "ctr -n k8s.io image import /tmp/images/$(IMAGE_NAME)-$(IMAGE_TAG).tar && rm /tmp/images/$(IMAGE_NAME)-$(IMAGE_TAG).tar"
	@echo "$(COLOR_SUCCESS)✓ Image deployed to remote server$(COLOR_RESET)"

.PHONY: deploy-dev
deploy-dev: deploy-image ## Deploy to development environment
	@echo "$(COLOR_INFO)Deploying to development on $(REMOTE_HOST)...$(COLOR_RESET)"
	ssh -p $(REMOTE_PORT) $(REMOTE_USER)@$(REMOTE_HOST) "\
		helm upgrade $(HELM_RELEASE) $(HELM_CHART) \
		--install \
		--namespace dev \
		--create-namespace \
		--values $(HELM_CHART)/values-dev.yaml \
		--set image.repository=$(DOCKER_REGISTRY)/$(IMAGE_NAME) \
		--set image.tag=$(IMAGE_TAG) \
		--set image.pullPolicy=Never"
	@echo "$(COLOR_SUCCESS)✓ Deployed to development$(COLOR_RESET)"

.PHONY: deploy-prod
deploy-prod: deploy-image ## Deploy to production environment
	@echo "$(COLOR_WARNING)Deploying to PRODUCTION on $(REMOTE_HOST)...$(COLOR_RESET)"
	@echo "$(COLOR_WARNING)Press Ctrl+C to cancel, or Enter to continue...$(COLOR_RESET)"
	@read confirm
	ssh -p $(REMOTE_PORT) $(REMOTE_USER)@$(REMOTE_HOST) "\
		helm upgrade $(HELM_RELEASE) $(HELM_CHART) \
		--install \
		--namespace prod \
		--create-namespace \
		--values $(HELM_CHART)/values-prod.yaml \
		--set image.repository=$(DOCKER_REGISTRY)/$(IMAGE_NAME) \
		--set image.tag=$(IMAGE_TAG) \
		--set image.pullPolicy=Never"
	@echo "$(COLOR_SUCCESS)✓ Deployed to production$(COLOR_RESET)"

.PHONY: deploy-local-dev
deploy-local-dev: docker-build docker-push ## Deploy to local development (with registry push)
	@echo "$(COLOR_INFO)Deploying to local development...$(COLOR_RESET)"
	helm upgrade $(HELM_RELEASE) $(HELM_CHART) \
		--install \
		--namespace dev \
		--create-namespace \
		--values $(HELM_CHART)/values-dev.yaml \
		--set image.repository=$(DOCKER_REGISTRY)/$(IMAGE_NAME) \
		--set image.tag=$(IMAGE_TAG)
	@echo "$(COLOR_SUCCESS)✓ Deployed to local development$(COLOR_RESET)"

.PHONY: deploy-local-prod
deploy-local-prod: docker-build docker-push ## Deploy to local production (with registry push)
	@echo "$(COLOR_WARNING)Deploying to local PRODUCTION...$(COLOR_RESET)"
	@echo "$(COLOR_WARNING)Press Ctrl+C to cancel, or Enter to continue...$(COLOR_RESET)"
	@read confirm
	helm upgrade $(HELM_RELEASE) $(HELM_CHART) \
		--install \
		--namespace prod \
		--create-namespace \
		--values $(HELM_CHART)/values-prod.yaml \
		--set image.repository=$(DOCKER_REGISTRY)/$(IMAGE_NAME) \
		--set image.tag=$(IMAGE_TAG)
	@echo "$(COLOR_SUCCESS)✓ Deployed to local production$(COLOR_RESET)"

.PHONY: rollback
rollback: ## Rollback Helm release to previous version
	@echo "$(COLOR_INFO)Rolling back $(HELM_RELEASE)...$(COLOR_RESET)"
	helm rollback $(HELM_RELEASE) --namespace $(HELM_NAMESPACE)
	@echo "$(COLOR_SUCCESS)✓ Rollback complete$(COLOR_RESET)"

##@ Utilities

.PHONY: lint
lint: ## Run linters for client and server
	@echo "$(COLOR_INFO)Running linters...$(COLOR_RESET)"
	cd client && npm run lint
	cd server && go fmt ./...
	cd server && go vet ./...
	@echo "$(COLOR_SUCCESS)✓ Linting complete$(COLOR_RESET)"

.PHONY: format
format: ## Format code (client and server)
	@echo "$(COLOR_INFO)Formatting code...$(COLOR_RESET)"
	cd client && npm run lint -- --fix || true
	cd server && go fmt ./...
	@echo "$(COLOR_SUCCESS)✓ Code formatted$(COLOR_RESET)"

.PHONY: type-check
type-check: ## Run TypeScript type checking
	@echo "$(COLOR_INFO)Running type check...$(COLOR_RESET)"
	cd client && npm run type-check
	@echo "$(COLOR_SUCCESS)✓ Type check passed$(COLOR_RESET)"

.PHONY: logs
logs: ## Show application logs (Docker Compose)
	docker compose logs -f app

.PHONY: logs-helm
logs-helm: ## Show application logs (Kubernetes)
	kubectl logs -f -l app.kubernetes.io/name=lists-viewer --namespace $(HELM_NAMESPACE)

.PHONY: shell
shell: ## Open shell in running container
	docker compose exec app sh

.PHONY: db-shell
db-shell: ## Open MongoDB shell
	docker compose exec mongodb mongosh -u root -p rootpassword --authenticationDatabase admin lists_viewer

##@ CI/CD

.PHONY: ci-build
ci-build: install lint type-check build ## CI: Install, lint, type-check, and build

.PHONY: ci-test
ci-test: test-client test-server ## CI: Run all unit tests

.PHONY: ci-e2e
ci-e2e: test-e2e ## CI: Run E2E tests

.PHONY: ci
ci: ci-build ci-test ## CI: Full pipeline (build + test)

.PHONY: cd-deploy
cd-deploy: deploy-image ## CD: Build, save, deploy image to remote, and deploy to dev
	@echo "$(COLOR_INFO)Running CD pipeline...$(COLOR_RESET)"
	ssh -p $(REMOTE_PORT) $(REMOTE_USER)@$(REMOTE_HOST) "\
		helm upgrade $(HELM_RELEASE) $(HELM_CHART) \
		--install \
		--namespace dev \
		--create-namespace \
		--values $(HELM_CHART)/values-dev.yaml \
		--set image.repository=$(DOCKER_REGISTRY)/$(IMAGE_NAME) \
		--set image.tag=$(IMAGE_TAG) \
		--set image.pullPolicy=Never"
	@echo "$(COLOR_SUCCESS)✓ CD pipeline complete$(COLOR_RESET)"

##@ Release

.PHONY: release-patch
release-patch: ## Create patch release (0.0.x)
	@echo "$(COLOR_INFO)Creating patch release...$(COLOR_RESET)"
	npm version patch --no-git-tag-version --prefix client
	@echo "$(COLOR_SUCCESS)✓ Patch version bumped$(COLOR_RESET)"

.PHONY: release-minor
release-minor: ## Create minor release (0.x.0)
	@echo "$(COLOR_INFO)Creating minor release...$(COLOR_RESET)"
	npm version minor --no-git-tag-version --prefix client
	@echo "$(COLOR_SUCCESS)✓ Minor version bumped$(COLOR_RESET)"

.PHONY: release-major
release-major: ## Create major release (x.0.0)
	@echo "$(COLOR_INFO)Creating major release...$(COLOR_RESET)"
	npm version major --no-git-tag-version --prefix client
	@echo "$(COLOR_SUCCESS)✓ Major version bumped$(COLOR_RESET)"

# Default target
.DEFAULT_GOAL := help
