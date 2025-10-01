---
noteId: "58a60d809e3811f0a6543d7c368dfc2a"
tags: []

---

# h2oai-floodprediction Helm chart

This chart deploys the H2O.ai Flood Prediction application to a Kubernetes cluster.

It includes a Deployment, Service, and optional Ingress. Sensitive API keys are injected via a Kubernetes Secret managed by the chart.

The chart lives at `deployment/helm/h2oai-floodprediction` and ships with a sample values file `deployment/helm/maker-values.yaml`.

## Prerequisites

- A working Kubernetes cluster (K8s 1.23+ recommended)
- kubectl and Helm v3 installed and configured to talk to your cluster
- Cluster has an Ingress Controller if you plan to expose via Ingress (for example, NGINX Ingress)
- A DNS name that points to your Ingress Controller, if using Ingress
- Access to pull the container image from your registry (imagePullSecret or public image)

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

Use `helm upgrade --install` so the command works for both first-time installs and upgrades. Provide your API keys via `--set` (safer: via environment variables) and pass your values file.

```bash
# Recommended: set secrets via env vars to avoid shell history exposure
export NVIDIA_API_KEY="<YOUR_NV_API_KEY>"
export H2OGPTE_API_KEY="<YOUR_H2OGPTE_API_KEY>"

helm upgrade --install flood-pred ./deployment/helm/h2oai-floodprediction \
	--namespace flood-prediction \
	--values ./deployment/helm/maker-values.yaml \
	--set nvidia.apiKey="$NVIDIA_API_KEY" \
	--set h2ogpte.apiKey="$H2OGPTE_API_KEY"
```

That will create a Secret named `flood-pred-secrets` and inject the keys into the Deployment.

### Alternative: pre-create the Secret (no `--set`)

If you prefer not to pass secrets on the Helm CLI, you can pre-create a Secret the chart will reuse. The Secret must be named `<release>-secrets` (for example `flood-pred-secrets`) and contain the keys `nvidiaAPIKey` and `h2ogpteAPIKey`.

```bash
kubectl -n flood-prediction create secret generic flood-pred-secrets \
	--from-literal=nvidiaAPIKey="$NVIDIA_API_KEY" \
	--from-literal=h2ogpteAPIKey="$H2OGPTE_API_KEY"

# Then install without passing API keys
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

- Resources
	- Defaults are modest. Adjust in values: `resources.requests` and add `resources.limits` if needed.

- H2OGPTE
	- URL: `--set h2ogpte.url=https://<your-h2ogpte-endpoint>`
	- Model: `--set h2ogpte.model=<model-name>`

## Verify the deployment

```bash
# Check pods
kubectl -n flood-prediction get pods

# Wait for rollout
kubectl -n flood-prediction rollout status deploy/flood-pred-web

# Inspect service and (optionally) ingress
kubectl -n flood-prediction get svc flood-pred-web
kubectl -n flood-prediction get ingress flood-pred-web

# If using Ingress and DNS:
curl -I http://<your.host.name>/

# If not using Ingress, port-forward locally
kubectl -n flood-prediction port-forward svc/flood-pred-web 8080:80
curl -I http://localhost:8080/

# View logs
kubectl -n flood-prediction logs deploy/flood-pred-web -f
```

The container listens on port `8000` and the Service exposes it as port `80`. Readiness/liveness probes hit `/`.

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
	- `kubectl -n flood-prediction describe pod <pod>` to check image pull errors and events.

- CrashLoopBackOff
	- `kubectl -n flood-prediction logs deploy/flood-pred-web --previous` for the last crash.
	- Verify API keys are present: `kubectl -n flood-prediction get secret flood-pred-secrets -o yaml | grep -E "nvidiaAPIKey|h2ogpteAPIKey"`

- 404/Ingress not working
	- Confirm your IngressClass: `--set ingress.className=nginx` (or your controller’s class).
	- Check DNS points to the Ingress Controller.
	- Inspect Ingress: `kubectl -n flood-prediction describe ingress flood-pred-web`.

- Connection timeouts or large payloads
	- Tune `ingress.annotations` (e.g., proxy timeouts, body size) in your values file.

- Secrets management
	- Passing `--set nvidia.apiKey=...` and `--set h2ogpte.apiKey=...` creates/updates the chart-managed Secret.
	- If you pre-create `<release>-secrets`, you can omit those flags and the chart will reuse existing keys.

## Reference

- Chart directory: `deployment/helm/h2oai-floodprediction`
- Default values: `deployment/helm/h2oai-floodprediction/values.yaml`
- Sample overrides: `deployment/helm/maker-values.yaml`

Key values:

- `image.repository`, `image.tag`, `image.pullPolicy`
- `imagePullSecrets` (list of `{ name: <secretName> }`)
- `service.type` (ClusterIP|NodePort) and `service.nodePort`
- `ingress.enabled`, `ingress.hostName`, `engress.className`, `ingress.annotations`
- `h2ogpte.url`, `h2ogpte.model`, `h2ogpte.apiKey`
- `nvidia.apiKey`

Security tips:

- Prefer environment variables for CLI secrets or pre-create Secrets instead of hardcoding into values files.
- Avoid committing real secrets to Git. Use sealed-secrets or external secret managers for production.

