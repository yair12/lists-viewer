# Quick Deployment Guide

## Complete Workflow: Local Machine → Raspberry Pi K8s Cluster

### Step 1: Build Image (Local Machine)
```bash
cd /home/echelon/Storage/Projects/lists-viewer
./build-arm64.sh v1.0.0
```

### Step 2: Copy Files to Cluster (Local Machine)
```bash
# Copy image tar
scp k8s-images/lists-viewer-arm64.tar pi@k8s-master:/tmp/

# Copy Helm chart
scp -r helm/lists-viewer pi@k8s-master:/tmp/

# Copy deployment script
scp deploy-k8s.sh pi@k8s-master:/tmp/
```

### Step 3: Import Image on All Nodes (On Each K8s Node)
```bash
# SSH into each node and run:
ssh pi@k8s-node1
sudo ctr -n k8s.io images import /tmp/lists-viewer-arm64.tar
sudo crictl images | grep lists-viewer
exit

# Repeat for all nodes
ssh pi@k8s-node2 "sudo ctr -n k8s.io images import /tmp/lists-viewer-arm64.tar"
ssh pi@k8s-node3 "sudo ctr -n k8s.io images import /tmp/lists-viewer-arm64.tar"
```

### Step 4: Deploy Application (On K8s Master)
```bash
ssh pi@k8s-master
cd /tmp
chmod +x deploy-k8s.sh
./deploy-k8s.sh v1.0.0
```

### Step 5: Verify (On K8s Master)
```bash
kubectl get pods -n lists-viewer
kubectl get svc -n lists-viewer
kubectl logs -n lists-viewer -l app=lists-viewer -f
```

## Alternative: Using kubectl from Local Machine

If you have kubectl configured locally:

```bash
# Set KUBECONFIG to your cluster
export KUBECONFIG=~/.kube/rpi-cluster-config

# Verify connection
kubectl cluster-info

# Deploy
helm upgrade --install lists-viewer ./helm/lists-viewer \
    --namespace lists-viewer --create-namespace \
    --set image.repository=lists-viewer \
    --set image.tag=v1.0.0 \
    --set image.pullPolicy=Never
```

## One-Liner Deploy Script

Copy everything in one command:

```bash
# From local machine
IMAGE_TAG="v1.0.0"
MASTER="pi@k8s-master"
NODES=("pi@k8s-node1" "pi@k8s-node2" "pi@k8s-node3")

# Build
./build-arm64.sh ${IMAGE_TAG}

# Copy to master
scp k8s-images/lists-viewer-arm64.tar ${MASTER}:/tmp/
scp -r helm/lists-viewer ${MASTER}:/tmp/
scp deploy-k8s.sh ${MASTER}:/tmp/

# Import on all nodes
for node in "${NODES[@]}"; do
    scp k8s-images/lists-viewer-arm64.tar ${node}:/tmp/
    ssh ${node} "sudo ctr -n k8s.io images import /tmp/lists-viewer-arm64.tar"
done

# Deploy
ssh ${MASTER} "cd /tmp && chmod +x deploy-k8s.sh && ./deploy-k8s.sh ${IMAGE_TAG}"
```

## Troubleshooting

### Image not found
```bash
# Check image on node
ssh pi@k8s-node1 "sudo crictl images | grep lists-viewer"

# Re-import if needed
ssh pi@k8s-node1 "sudo ctr -n k8s.io images import /tmp/lists-viewer-arm64.tar"
```

### Pods not starting
```bash
kubectl describe pod -n lists-viewer <pod-name>
kubectl logs -n lists-viewer <pod-name>
```

### Update deployment
```bash
# On master
kubectl set image deployment/lists-viewer \
    lists-viewer=lists-viewer:v1.1.0 \
    -n lists-viewer
```
