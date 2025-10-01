---
noteId: "58a5bf609e3811f0a6543d7c368dfc2a"
tags: []

---

# Flood Prediction Web App Kubernetes Manifests

This directory contains the Kubernetes manifests for deploying the **flood-prediction web application** (UI + backend served from the same container image).

## Contents

| File | Purpose |
|------|---------|
| `deployment.yaml` | Runs the web app (single replica, simplified spec) |
| `service.yaml` | Exposes the pod internally on port 80 -> 8000 |
| `ingress.yaml` | NGINX ingress route to the Service |
| `configmap.yaml` | Non-secret environment configuration |
| `secrets.yaml` | API keys / secret env vars (placeholder values) |
| `registry-secret.yaml` | Private container registry pull credentials |

## Prerequisites

- Kubernetes cluster (single node is fine for dev)
- NGINX Ingress Controller installed
- Namespace created:

```bash
kubectl create namespace flood-prediction || true
```

## Image

The deployment references:
```
h2oaireleasetest/h2oai-aml:v0.1.0
```
Update `deployment.yaml` if you push a different tag/digest.

## Creating the Registry Pull Secret (Option A - Declarative)

Generate the secret YAML (recommended so it can be committed if non-sensitive or stored securely):

```bash
kubectl create secret docker-registry flood-prediction-registry \
  --docker-server=REGISTRY_SERVER \
  --docker-username=USERNAME \
  --docker-password=PASSWORD \
  --docker-email=you@example.com \
  -n flood-prediction \
  --dry-run=client -o yaml > deployment/k8s/registry-secret.yaml
```

Then inspect and apply:
```bash
kubectl apply -f deployment/k8s/registry-secret.yaml
```

If you prefer to keep credentials out of the repo, do not commit the generated file—apply it only.

### Example `.dockerconfigjson` (Manual Insert)

If you want to manually edit `registry-secret.yaml` using the provided `stringData` field, replace `PLACEHOLDER_JSON` with raw JSON like below (no base64 needed in `stringData`):

```json
{
  "auths": {
    "registry.example.com": {
      "username": "demo-user",
      "password": "demo-pass",
      "auth": "ZGVtby11c2VyOmRlbW8tcGFzcw=="
    }
  }
}
```

Where the `auth` value is the base64 of `username:password`:
```
echo -n 'demo-user:demo-pass' | base64
ZGVtby11c2VyOmRlbW8tcGFzcw==
```

If instead you choose to place the JSON under `data:` you must base64 encode the entire JSON document.

### Verifying the Secret

```bash
kubectl get secret flood-prediction-registry -n flood-prediction -o yaml | grep -E 'type:|.dockerconfigjson'
```
Type should be `kubernetes.io/dockerconfigjson`.

## Deployment Order

Apply (or re-apply) manifests in this order:

```bash
kubectl apply -n flood-prediction -f deployment/k8s/registry-secret.yaml
kubectl apply -n flood-prediction -f deployment/k8s/configmap.yaml
kubectl apply -n flood-prediction -f deployment/k8s/secrets.yaml
kubectl apply -n flood-prediction -f deployment/k8s/deployment.yaml
kubectl apply -n flood-prediction -f deployment/k8s/service.yaml
kubectl apply -n flood-prediction -f deployment/k8s/ingress.yaml
```

## Verifying Deployment

Because this deployment spec is intentionally minimal (no custom rolling update strategy or revision history retention), verification is straightforward:

```bash
kubectl get deploy/flood-prediction-web -n flood-prediction
kubectl get pods -n flood-prediction -o wide
kubectl get svc,ingress -n flood-prediction
```

Troubleshoot image pulls:
```bash
kubectl describe pod <pod-name> -n flood-prediction | grep -i -A4 'image'
```

## Cleanup (If You Renamed From Previous api Resources)

```bash
kubectl delete deploy/flood-prediction-api -n flood-prediction --ignore-not-found
kubectl delete svc/flood-prediction-api -n flood-prediction --ignore-not-found
kubectl delete ingress/flood-prediction-api -n flood-prediction --ignore-not-found
```

## Updating the Image (Simple Replace)

Since we removed rolling update tuning and revision history retention, updating the image is just a single apply after editing `deployment.yaml`:

1. Edit `deployment.yaml` and change the `image:` tag.
2. Re-apply:
```bash
kubectl apply -f deployment/k8s/deployment.yaml -n flood-prediction
```

Kubernetes will handle the default rolling update with standard settings.

## Notes / Future Enhancements

- Add TLS to `ingress.yaml` when ready (cert-manager + Let’s Encrypt)
- Introduce resource autoscaling (HPA) if load increases
- Externalize secrets (External Secrets Operator, Sealed Secrets, etc.)
- (Optional) Add version label (e.g., `app.kubernetes.io/version: v0.1.0`)

---
Maintained for simplicity; adjust as the project grows.
