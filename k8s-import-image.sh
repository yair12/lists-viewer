#!/bin/bash

# Import Docker image to containerd for Kubernetes
# Run this script on the Kubernetes node (Raspberry Pi 4)

set -e

IMAGE_TAR="${1}"

if [ -z "${IMAGE_TAR}" ]; then
    echo "Usage: $0 <image.tar>"
    echo "Example: $0 /tmp/lists-viewer-arm64.tar"
    exit 1
fi

if [ ! -f "${IMAGE_TAR}" ]; then
    echo "Error: Image file not found: ${IMAGE_TAR}"
    exit 1
fi

echo "=== Importing image to containerd ==="
echo "Image: ${IMAGE_TAR}"
echo ""

# Import to containerd with k8s.io namespace
sudo ctr -n k8s.io images import "${IMAGE_TAR}"

echo ""
echo "=== Verifying imported images ==="
sudo crictl images | grep -E "lists-viewer|IMAGE"

echo ""
echo "=== Image successfully imported! ==="
echo "You can now use it in your Kubernetes deployments."
echo ""
echo "Update your deployment to use: lists-viewer:latest"
