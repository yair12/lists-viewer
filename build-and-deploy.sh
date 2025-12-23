#!/bin/bash

# Complete build and deploy script for ARM64 Kubernetes cluster
# Run this script from your local machine
# Usage: 
#   ./build-and-deploy.sh <host>              - Rebuild and restart current version
#   ./build-and-deploy.sh <host> <version>    - Build and deploy new version with Helm

set -e

IMAGE_NAME="lists-viewer"
NAMESPACE="lists-viewer"
K8S_HOST="${1}"
VERSION="${2}"

if [ -z "${K8S_HOST}" ]; then
    echo "❌ Usage: $0 <host> [version]"
    echo "Examples:"
    echo "  $0 test.private              # Rebuild current version and restart"
    echo "  $0 test.private v1.0.7       # Build and deploy new version"
    exit 1
fi

# Determine deployment mode
if [ -z "${VERSION}" ]; then
    # No version supplied - fetch current version and do rollout restart
    echo "=== Rebuild and Restart Current Version ==="
    echo "Target: ${K8S_HOST}"
    echo ""
    
    echo "🔍 Fetching current deployed version..."
    CURRENT_VERSION=$(kubectl get deployment/lists-viewer -n ${NAMESPACE} -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)
    
    if [ -z "${CURRENT_VERSION}" ]; then
        echo "❌ Could not determine current version"
        exit 1
    fi
    
    VERSION="${CURRENT_VERSION}"
    echo "✅ Current version: ${VERSION}"
    echo ""
    
    DEPLOY_MODE="restart"
else
    # Version supplied - do helm upgrade
    echo "=== Build and Deploy New Version ==="
    echo "Version: ${VERSION}"
    echo "Target: ${K8S_HOST}"
    echo ""
    
    DEPLOY_MODE="upgrade"
fi

# Step 1: Build ARM64 image
echo "📦 Step 1: Building ARM64 image..."
bash build-arm64.sh ${VERSION}

if [ ! -f "./k8s-images/lists-viewer-arm64.tar" ]; then
    echo "❌ Build failed - image file not found"
    exit 1
fi

echo "✅ Build complete"
echo ""

# Step 2: Copy to K8s master node
echo "📤 Step 2: Copying image to K8s master..."
scp k8s-images/lists-viewer-arm64.tar ${K8S_HOST}:/tmp/

echo "✅ Image copied"
echo ""

# Step 3: Import to containerd
echo "📥 Step 3: Importing image to containerd..."
ssh ${K8S_HOST} "sudo ctr -n k8s.io images import /tmp/lists-viewer-arm64.tar"

echo "✅ Image imported"
echo ""

# Step 4: Verify image
echo "🔍 Step 4: Verifying image..."
ssh ${K8S_HOST} "sudo crictl images | grep lists-viewer"

echo ""

# Step 5: Deploy
if [ "${DEPLOY_MODE}" = "restart" ]; then
    echo "🔄 Step 5: Restarting deployment..."
    kubectl rollout restart deployment/lists-viewer -n ${NAMESPACE}
    echo "✅ Deployment restarted"
else
    echo "⚙️  Step 5: Running Helm upgrade..."
    helm upgrade --install lists-viewer ./helm/lists-viewer \
        --namespace ${NAMESPACE} \
        --create-namespace \
        --set image.repository=${IMAGE_NAME} \
        --set image.tag=${VERSION} \
        --set image.pullPolicy=Never
    echo "✅ Helm upgrade complete"
fi

echo ""

# Step 6: Wait for rollout
echo "⏳ Step 6: Waiting for rollout to complete..."
kubectl rollout status deployment/lists-viewer -n ${NAMESPACE} --timeout=120s

echo ""
echo "✅ Deployment complete!"
echo ""
echo "=== Deployment Status ==="
kubectl get pods -n ${NAMESPACE}
echo ""
kubectl get svc -n ${NAMESPACE}
echo ""
echo "💡 To view logs: kubectl logs -n ${NAMESPACE} -l app=lists-viewer -f"
