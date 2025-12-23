# Lists Viewer Helm Chart

A Helm chart for deploying the Lists Viewer application to Kubernetes.

## Prerequisites

- Kubernetes 1.20+
- Helm 3.0+
- MongoDB (separately deployed or using external service)

## Installation

### Add the Chart Repository (if applicable)

```bash
helm repo add lists-viewer https://charts.example.com
helm repo update
```

### Install the Chart

```bash
# Development environment
helm install lists-viewer ./lists-viewer \
  -f lists-viewer/values-dev.yaml \
  --namespace lists-viewer --create-namespace

# Production environment
helm install lists-viewer ./lists-viewer \
  -f lists-viewer/values-prod.yaml \
  --namespace lists-viewer-prod --create-namespace
```

## Configuration

Key values that can be overridden:

- `replicaCount` - Number of pod replicas (default: 2)
- `image.repository` - Docker image repository
- `image.tag` - Docker image tag
- `mongodb.uri` - MongoDB connection string
- `resources` - CPU and memory limits
- `autoscaling.enabled` - Enable horizontal pod autoscaling

See `values.yaml` for all available options.

## Environment-Specific Values

- `values.yaml` - Default values
- `values-dev.yaml` - Development overrides
- `values-prod.yaml` - Production overrides

## Upgrading

```bash
helm upgrade lists-viewer ./lists-viewer \
  -f lists-viewer/values-prod.yaml
```

## Uninstalling

```bash
helm uninstall lists-viewer --namespace lists-viewer
```

## MongoDB Configuration

Update the MongoDB URI in the appropriate values file:

```yaml
mongodb:
  uri: "mongodb://username:password@host1,host2,host3/dbname?authSource=admin&replicaSet=rs0"
```

## Service Exposure

### LoadBalancer

```yaml
service:
  type: LoadBalancer
  port: 80
```

### NodePort

```yaml
service:
  type: NodePort
  nodePort: 30080
```

### Ingress

Enable ingress in values file:

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: lists-viewer.example.com
      paths:
        - path: /
          pathType: Prefix
```

## Troubleshooting

### Check pod status
```bash
kubectl get pods -n lists-viewer
kubectl describe pod <pod-name> -n lists-viewer
```

### View logs
```bash
kubectl logs -n lists-viewer <pod-name>
kubectl logs -n lists-viewer <pod-name> --tail=100 -f
```

### Check events
```bash
kubectl get events -n lists-viewer
```

## License

MIT
