#!/bin/bash

# Complete deployment script for Kubernetes cluster
# Run this script ON THE KUBERNETES MASTER NODE

set -e

IMAGE_NAME="lists-viewer"
IMAGE_TAG="${1:-v1.0.0}"
NAMESPACE="lists-viewer"

echo "=== Lists Viewer Kubernetes Deployment ==="
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Namespace: ${NAMESPACE}"
echo ""

# Check if running on cluster
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please run this script on the Kubernetes cluster."
    exit 1
fi

# Check cluster access
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot access Kubernetes cluster. Please check your kubeconfig."
    exit 1
fi

echo "✅ Connected to cluster"
kubectl cluster-info | head -1

# Create namespace if it doesn't exist
if ! kubectl get namespace ${NAMESPACE} &> /dev/null; then
    echo "Creating namespace: ${NAMESPACE}"
    kubectl create namespace ${NAMESPACE}
else
    echo "✅ Namespace ${NAMESPACE} already exists"
fi

# Check if Helm chart is available
if [ -d "./lists-viewer" ]; then
    CHART_PATH="./lists-viewer"
elif [ -d "./helm/lists-viewer" ]; then
    CHART_PATH="./helm/lists-viewer"
else
    echo "❌ Helm chart not found. Please copy helm/lists-viewer directory to this location."
    echo "Expected locations: ./lists-viewer or ./helm/lists-viewer"
    exit 1
fi

echo "✅ Found Helm chart at: ${CHART_PATH}"

# Deploy with Helm
echo ""
echo "Deploying application..."
helm upgrade --install ${IMAGE_NAME} ${CHART_PATH} \
    --namespace ${NAMESPACE} \
    --values ${CHART_PATH}/values.yaml \
    --set image.repository=${IMAGE_NAME} \
    --set image.tag=${IMAGE_TAG} \
    --set image.pullPolicy=Never \
    --wait \
    --timeout 5m

echo ""
echo "=== Deployment Status ==="
kubectl get pods -n ${NAMESPACE}

echo ""
echo "=== Services ==="
kubectl get svc -n ${NAMESPACE}

echo ""
echo "=== Checking pod logs ==="
POD_NAME=$(kubectl get pods -n ${NAMESPACE} -l app=${IMAGE_NAME} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "${POD_NAME}" ]; then
    echo "Pod: ${POD_NAME}"
    kubectl logs -n ${NAMESPACE} ${POD_NAME} --tail=20
else
    echo "⚠️  No pods found yet. They may still be starting."
fi

echo ""
echo "=== Deployment Complete! ==="
echo ""
echo "To view logs:"
echo "  kubectl logs -n ${NAMESPACE} -l app=${IMAGE_NAME} -f"
echo ""
echo "To access the application:"
echo "  kubectl port-forward -n ${NAMESPACE} svc/${IMAGE_NAME}-app 8080:8080"
echo ""
echo "To get service details:"
echo "  kubectl get svc -n ${NAMESPACE} ${IMAGE_NAME}-app"
