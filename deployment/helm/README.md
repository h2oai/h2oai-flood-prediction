---
noteId: "58a60d809e3811f0a6543d7c368dfc2a"
tags: []

---

# h2oai-floodprediction Helm chart

This chart deploys the H2O.ai Flood Prediction application to a Kubernetes cluster.

It includes a main web application Deployment, an optional Jupyter notebook Deployment for interactive demos, Services, and optional Ingress. Sensitive API keys and authentication tokens are injected via a Kubernetes Secret managed by the chart.

The chart lives at `deployment/helm/h2oai-floodprediction` and ships with a sample values file `deployment/helm/maker-values.yaml`.

## Prerequisites

- A working Kubernetes cluster (K8s 1.23+ recommended)
- kubectl and Helm v3 installed and configured to talk to your cluster
- Cluster has an Ingress Controller if you plan to expose via Ingress (for example, NGINX Ingress)
- A DNS name that points to your Ingress Controller, if using Ingress
- Access to pull the container image from your registry (imagePullSecret or public image)
- NVIDIA API key for model inference
- H2OGPTE API key for LLM integration
- Jupyter notebook authentication token (required if notebook is enabled - see Quick start)

Optional but recommended:
- Ability to create a namespace, secrets, and RBAC objects in the target cluster/namespace

## Quick start (replicable commands)

The steps below mirror a simple, working install. Replace placeholder values like `<YOUR_NV_API_KEY>` with your own, and adjust hostnames as needed.

1) Create a namespace (optional if you already have one)

```bash
kubectl create namespace flood-prediction
```

2) Make your registry credentials available (if your image is private)

This repo includes an example secret manifest. Update it with your registry credentials if needed, then apply it:

```bash
kubectl -n flood-prediction apply -f deployment/k8s/registry-secret.yaml
```

3) Review and (optionally) edit values

- `deployment/helm/maker-values.yaml` sets:
	- `imagePullSecrets`: references your registry secret (e.g. `flood-prediction-registry`)
	- `ingress.hostName`: the DNS hostname for the app (e.g. `flood-prediction.h2o.ai`)

Defaults (see `deployment/helm/h2oai-floodprediction/values.yaml`):

- `service.type: ClusterIP` (private cluster networking)
- `ingress.enabled: true` with `className: nginx`
- `h2ogpte.url` and `h2ogpte.model` are pre-populated; change if needed

4) Install or upgrade the chart

Use `helm upgrade --install` so the command works for both first-time installs and upgrades. Provide your API keys and notebook token via `--set` (safer: via environment variables) and pass your values file.

```bash
# Recommended: set secrets via env vars to avoid shell history exposure
export NVIDIA_API_KEY="<YOUR_NV_API_KEY>"
export H2OGPTE_API_KEY="<YOUR_H2OGPTE_API_KEY>"

# Generate a secure token for Jupyter notebook authentication
export JUPYTER_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
# Alternative: export JUPYTER_TOKEN=$(openssl rand -hex 32)

helm upgrade --install flood-pred ./deployment/helm/h2oai-floodprediction \
	--namespace flood-prediction \
	--values ./deployment/helm/maker-values.yaml \
	--set nvidia.apiKey="$NVIDIA_API_KEY" \
	--set h2ogpte.apiKey="$H2OGPTE_API_KEY" \
	--set notebook.token="$JUPYTER_TOKEN"
```

That will create a Secret named `flood-pred-secrets` and inject the keys and token into the Deployments.

**Note:** By default, the Jupyter notebook is enabled. If you don't need it, add `--set notebook.enabled=false` to disable it (and you can omit the `notebook.token` parameter).

### Alternative: pre-create the Secret (no `--set`)

If you prefer not to pass secrets on the Helm CLI, you can pre-create a Secret the chart will reuse. The Secret must be named `<release>-secrets` (for example `flood-pred-secrets`) and contain the keys `nvidiaAPIKey`, `h2ogpteAPIKey`, and (if notebook is enabled) `jupyterToken`.

```bash
# Generate a secure token
export JUPYTER_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

kubectl -n flood-prediction create secret generic flood-pred-secrets \
	--from-literal=nvidiaAPIKey="$NVIDIA_API_KEY" \
	--from-literal=h2ogpteAPIKey="$H2OGPTE_API_KEY" \
	--from-literal=jupyterToken="$JUPYTER_TOKEN"

# Then install without passing secrets via --set
helm upgrade --install flood-pred ./deployment/helm/h2oai-floodprediction \
	--namespace flood-prediction \
	--values ./deployment/helm/maker-values.yaml
```

Note: For production, consider sealed-secrets, external-secrets, or your cloud secret manager.

## Customization

- Image and version
	- Change the image tag: `--set image.tag=v0.2.1`
	- Change the image repository: `--set image.repository=<your_repo/your_image>`

- Ingress (public URL)
	- Enable/disable: `--set ingress.enabled=true|false`
	- Hostname: `--set ingress.hostName=your.domain`
	- Class name: `--set ingress.className=nginx` (must match your controller)
	- Annotations: set as needed in your values file under `ingress.annotations` (timeouts, size limits, etc.)

- No Ingress? Use NodePort
	- Disable Ingress and expose via NodePort:
		```bash
		--set ingress.enabled=false --set service.type=NodePort
		```
	- Optionally pick a fixed port: `--set service.nodePort=30080`
	- For notebook NodePort: `--set notebook.nodePort=30888`

- Jupyter Notebook
	- Enable/disable notebook: `--set notebook.enabled=true|false` (default: true)
	- Set authentication token: `--set notebook.token=<your-secure-token>` (required if enabled)
	- Change notebook image: `--set notebook.image.tag=v0.3.1`
	- Change notebook image repository: `--set notebook.image.repository=<your-repo>/<your-image>`
	- Change notebook image registry: `--set notebook.image.registry=<your-registry>`
	- Use separate registry credentials for notebook:
		```bash
		--set notebook.imagePullSecrets[0].name=my-notebook-registry-secret
		```
	- Disable password changes in Jupyter: `--set notebook.allowPasswordChange=false` (default: false)
	- Adjust notebook resources:
		```bash
		--set notebook.resources.requests.cpu=2 \
		--set notebook.resources.requests.memory=2Gi
		```

- Resources
	- Defaults are modest. Adjust in values: `resources.requests` and add `resources.limits` if needed.
	- Notebook has separate resource configuration via `notebook.resources`

- H2OGPTE
	- URL: `--set h2ogpte.url=https://<your-h2ogpte-endpoint>`
	- Model: `--set h2ogpte.model=<model-name>`

## Verify the deployment

```bash
# Check pods (should see both web and notebook if notebook.enabled=true)
kubectl -n flood-prediction get pods

# Wait for rollout - web application
kubectl -n flood-prediction rollout status deploy/flood-pred-web

# Wait for rollout - notebook (if enabled)
kubectl -n flood-prediction rollout status deploy/flood-pred-notebook

# Inspect services and (optionally) ingress
kubectl -n flood-prediction get svc flood-pred-web
kubectl -n flood-prediction get svc flood-pred-notebook
kubectl -n flood-prediction get ingress flood-pred-web

# If using Ingress and DNS:
curl -I http://<your.host.name>/
curl -I http://<your.host.name>/jupyter

# If not using Ingress, port-forward locally
# Web application:
kubectl -n flood-prediction port-forward svc/flood-pred-web 8080:80
curl -I http://localhost:8080/

# Jupyter notebook (in a separate terminal):
kubectl -n flood-prediction port-forward svc/flood-pred-notebook 8888:80
# Then open http://localhost:8888 in your browser
# Enter your token when prompted

# View logs
# Web application:
kubectl -n flood-prediction logs deploy/flood-pred-web -f

# Jupyter notebook:
kubectl -n flood-prediction logs deploy/flood-pred-notebook -f
```

The web container listens on port `8000` and the Service exposes it as port `80`. The notebook container listens on port `8888` and its Service also exposes it as port `80`. Readiness/liveness probes hit `/` for the web app and `/jupyter` for the notebook.

## Upgrade

Re-run the same `helm upgrade --install` command with your desired overrides (tag, host, resources, etc.). The chart preserves the existing Secret if you do not pass new API key values.

## Uninstall

```bash
helm uninstall flood-pred --namespace flood-prediction
```

This removes chart-managed resources. If you pre-created the Secret or registry Secret, those will remain unless you delete them explicitly.

## Troubleshooting

- ImagePullBackOff
	- Ensure your `imagePullSecrets` entry matches the Secret name in the same namespace.
	- For notebook with separate registry: verify `notebook.imagePullSecrets` is configured correctly.
	- `kubectl -n flood-prediction describe pod <pod>` to check image pull errors and events.

- CrashLoopBackOff
	- Web application: `kubectl -n flood-prediction logs deploy/flood-pred-web --previous` for the last crash.
	- Jupyter notebook: `kubectl -n flood-prediction logs deploy/flood-pred-notebook --previous` for the last crash.
	- Verify API keys and tokens are present:
		```bash
		kubectl -n flood-prediction get secret flood-pred-secrets -o yaml | grep -E "nvidiaAPIKey|h2ogpteAPIKey|jupyterToken"
		```

- 404/Ingress not working
	- Confirm your IngressClass: `--set ingress.className=nginx` (or your controller's class).
	- Check DNS points to the Ingress Controller.
	- Inspect Ingress: `kubectl -n flood-prediction describe ingress flood-pred-web`.
	- Note: The Ingress includes both `/` (web app) and `/jupyter` (notebook) paths if notebook is enabled.

- Jupyter notebook access issues
	- Token rejected: Verify the token is correct:
		```bash
		kubectl get secret flood-pred-secrets -n flood-prediction \
		  -o jsonpath='{.data.jupyterToken}' | base64 -d && echo
		```
	- 403 Forbidden: Check that you're using the correct path `/jupyter` not just `/jupyter/`
	- Can't access at all: Verify notebook is enabled (`notebook.enabled=true`) and pod is running:
		```bash
		kubectl -n flood-prediction get pods -l app.kubernetes.io/component=notebook
		```

- Connection timeouts or large payloads
	- Tune `ingress.annotations` (e.g., proxy timeouts, body size) in your values file.
	- For notebooks with large file uploads, increase `nginx.ingress.kubernetes.io/proxy-body-size`

- Secrets management
	- Passing `--set nvidia.apiKey=...`, `--set h2ogpte.apiKey=...`, and `--set notebook.token=...` creates/updates the chart-managed Secret.
	- If you pre-create `<release>-secrets`, you can omit those flags and the chart will reuse existing keys and token.
	- Missing token error: If notebook is enabled, you MUST provide a token via `--set notebook.token=...` or in a pre-created Secret.

## Reference

- Chart directory: `deployment/helm/h2oai-floodprediction`
- Default values: `deployment/helm/h2oai-floodprediction/values.yaml`
- Sample overrides: `deployment/helm/maker-values.yaml`, `deployment/helm/cloud-dev-values.yaml`

Key values:

**Web Application:**
- `image.repository`, `image.registry`, `image.tag`, `image.pullPolicy`
- `imagePullSecrets` (list of `{ name: <secretName> }`)
- `service.type` (ClusterIP|NodePort) and `service.nodePort`
- `resources.requests.cpu`, `resources.requests.memory`

**Jupyter Notebook:**
- `notebook.enabled` (default: true)
- `notebook.token` (required if notebook.enabled - authentication token)
- `notebook.image.repository`, `notebook.image.registry`, `notebook.image.tag`, `notebook.image.pullPolicy`
- `notebook.imagePullSecrets` (list of `{ name: <secretName> }` - separate from main app)
- `notebook.nodePort` (if using NodePort service type)
- `notebook.allowPasswordChange` (default: false)
- `notebook.resources.requests.cpu`, `notebook.resources.requests.memory`

**Networking:**
- `ingress.enabled`, `ingress.hostName`, `ingress.className`, `ingress.annotations`

**External Services:**
- `h2ogpte.url`, `h2ogpte.model`, `h2ogpte.apiKey`
- `nvidia.apiKey`
- `redis.enabled` (default: true)

**NVIDIA NIM LLM (optional):**
- `nimllm.enabled` (default: false)

Security tips:

- **IMPORTANT**: Always generate secure random tokens for `notebook.token` - never use predictable values
- Prefer environment variables for CLI secrets or pre-create Secrets instead of hardcoding into values files
- Avoid committing real secrets to Git. Use sealed-secrets or external secret managers for production
- Token generation examples:
  - `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`
  - `openssl rand -hex 32`

