# Kubernetes Deployment Guide for Raspberry Pi 4

This guide explains how to build and deploy the Lists Viewer application to a Kubernetes cluster running on Raspberry Pi 4 (ARM64 architecture).

## Prerequisites

- Docker with buildx support
- Kubernetes cluster with containerd runtime
- SSH access to your Kubernetes nodes
- kubectl configured for your cluster

## Building the Image

### Option 1: Quick ARM64 Build (Recommended for RPi 4)

Build only the ARM64 image for faster deployment:

```bash
./build-arm64.sh v1.0.0
```

This will create: `k8s-images/lists-viewer-arm64.tar`

### Option 2: Multi-Architecture Build

Build for both ARM64 and AMD64:

```bash
./build-k8s-image.sh v1.0.0
```

This creates:
- `k8s-images/lists-viewer-multi.tar` (OCI format, both architectures)
- `k8s-images/lists-viewer-arm64.tar` (Docker format, ARM64 only)
- `k8s-images/lists-viewer-amd64.tar` (Docker format, AMD64 only)

## Deploying to Kubernetes

### Step 1: Copy Image to Raspberry Pi

Copy the ARM64 image to your Raspberry Pi node:

```bash
scp k8s-images/lists-viewer-arm64.tar pi@raspberry-pi:/tmp/
```

If you have multiple nodes, copy to each one:

```bash
for node in pi-node1 pi-node2 pi-node3; do
    scp k8s-images/lists-viewer-arm64.tar pi@$node:/tmp/
done
```

### Step 2: Import to Containerd

SSH into each Kubernetes node and import the image:

```bash
ssh pi@raspberry-pi
sudo ctr -n k8s.io images import /tmp/lists-viewer-arm64.tar
```

Or use the provided script:

```bash
scp k8s-import-image.sh pi@raspberry-pi:/tmp/
ssh pi@raspberry-pi "chmod +x /tmp/k8s-import-image.sh && /tmp/k8s-import-image.sh /tmp/lists-viewer-arm64.tar"
```

### Step 3: Verify Image Import

Check that the image is available:

```bash
sudo crictl images | grep lists-viewer
```

You should see output like:

```
docker.io/library/lists-viewer    latest    abc123...   150MB
docker.io/library/lists-viewer    v1.0.0    abc123...   150MB
```

### Step 4: Deploy to Kubernetes

**Important**: You must run these commands **on the Kubernetes cluster** or from a machine with `kubectl` configured to access your cluster.

#### Option A: Deploy from Kubernetes Master Node

SSH into your Kubernetes master node and run:

```bash
# Copy the Helm chart to the cluster
scp -r helm/lists-viewer pi@k8s-master:/tmp/

# SSH into master node
ssh pi@k8s-master

# Deploy using Helm
cd /tmp
helm upgrade --install lists-viewer ./lists-viewer \
    --namespace lists-viewer \
    --create-namespace \
    --values ./lists-viewer/values.yaml \
    --set image.repository=lists-viewer \
    --set image.tag=v1.0.0 \
    --set image.pullPolicy=Never
```

#### Option B: Deploy with kubectl from Local Machine

If you have `kubectl` configured locally to access your cluster:

```bash
# First, ensure ~/.kube/config is set up for your cluster
kubectl cluster-info

# Then deploy
helm upgrade --install lists-viewer ./helm/lists-viewer \
    --namespace lists-viewer \
    --create-namespace \
    --values ./helm/lists-viewer/values.yaml \
    --set image.repository=lists-viewer \
    --set image.tag=v1.0.0 \
    --set image.pullPolicy=Never
```

#### Option C: Apply Manifests Directly

Generate manifests locally and apply on the cluster:

```bash
# Generate manifests locally
helm template lists-viewer ./helm/lists-viewer \
    --namespace lists-viewer \
    --values ./helm/lists-viewer/values.yaml \
    --set image.repository=lists-viewer \
    --set image.tag=v1.0.0 \
    --set image.pullPolicy=Never \
    > lists-viewer-manifests.yaml

# Copy to cluster
scp lists-viewer-manifests.yaml pi@k8s-master:/tmp/

# Apply on cluster
ssh pi@k8s-master "kubectl apply -f /tmp/lists-viewer-manifests.yaml"
```

**Important**: Use `pullPolicy: Never` to ensure Kubernetes uses the local image and doesn't try to pull from a registry.

### Step 5: Verify Deployment

**Run these commands on the cluster or with kubectl configured:**

Check pod status:

```bash
kubectl get pods -n lists-viewer
```

Check logs:

```bash
kubectl logs -n lists-viewer deployment/lists-viewer-app
```

Check services:

```bash
kubectl get svc -n lists-viewer
```

Access the application (from cluster):

```bash
# Port forward (if running from local machine with kubectl)
kubectl port-forward -n lists-viewer svc/lists-viewer-app 8080:8080

# Or check the service IP/NodePort (from cluster)
kubectl get svc -n lists-viewer lists-viewer-app
```

Then visit: http://localhost:8080 (if port-forwarding) or http://<node-ip>:<nodeport>

## Image Tagging Strategy

- `latest` - Most recent build
- `v1.0.0` - Specific version
- `v1.0.0-arm64` - Architecture-specific tag

## Troubleshooting

### Image Not Found

If pods show `ImagePullBackOff`:

1. Verify image is imported on the node where pod is scheduled:
   ```bash
   kubectl describe pod <pod-name> -n lists-viewer | grep Node:
   ssh pi@<node-name> "sudo crictl images | grep lists-viewer"
   ```

2. Ensure `imagePullPolicy: Never` is set in deployment

3. Check node affinity/taints if using mixed architecture cluster

### Image Import Fails

If `ctr import` fails:

```bash
# Check containerd is running
sudo systemctl status containerd

# Check tar file integrity
tar -tzf /tmp/lists-viewer-arm64.tar | head

# Try importing with verbose output
sudo ctr -n k8s.io images import --all-platforms /tmp/lists-viewer-arm64.tar
```

### Build Fails

If the build fails:

```bash
# Clean builder cache
docker buildx prune -af

# Recreate builder
docker buildx rm multiarch-builder
docker buildx create --name multiarch-builder --use

# Try building again
./build-arm64.sh v1.0.0
```

## Updating the Application

To update to a new version:

1. Build new image with new tag:
   ```bash
   ./build-arm64.sh v1.1.0
   ```

2. Copy and import to all nodes:
   ```bash
   for node in pi-node1 pi-node2 pi-node3; do
       scp k8s-images/lists-viewer-arm64.tar pi@$node:/tmp/
       ssh pi@$node "sudo ctr -n k8s.io images import /tmp/lists-viewer-arm64.tar"
   done
   ```

3. Update deployment:
   ```bash
   kubectl set image deployment/lists-viewer-app \
       lists-viewer-app=lists-viewer:v1.1.0 \
       -n lists-viewer
   ```

4. Or use Helm:
   ```bash
   helm upgrade lists-viewer ./helm/lists-viewer \
       --namespace lists-viewer \
       --set image.tag=v1.1.0 \
       --reuse-values
   ```

## Performance Considerations

- ARM64 builds take longer than AMD64 (expect 2-5 minutes)
- Image size is approximately 150MB
- Use `--build-arg BUILDKIT_INLINE_CACHE=1` for faster subsequent builds
- Consider using a local registry for multi-node clusters

## Using a Local Registry (Optional)

For easier multi-node deployments, set up a local registry:

```bash
# Run registry on one node
docker run -d -p 5000:5000 --restart=always --name registry registry:2

# Tag and push image
docker tag lists-viewer:v1.0.0 localhost:5000/lists-viewer:v1.0.0
docker push localhost:5000/lists-viewer:v1.0.0

# Update deployment to pull from registry
kubectl set image deployment/lists-viewer-app \
    lists-viewer-app=<registry-ip>:5000/lists-viewer:v1.0.0 \
    -n lists-viewer
```

## Additional Resources

- [Kubernetes on Raspberry Pi](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
- [Containerd Image Management](https://github.com/containerd/containerd/blob/main/docs/cri/crictl.md)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)
