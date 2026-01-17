#!/bin/bash

# Quick build for ARM64 (Raspberry Pi 4) only
# Much faster than building both architectures

set -e

IMAGE_NAME="lists-viewer"
IMAGE_TAG="${1:-latest}"
OUTPUT_DIR="./k8s-images"
USE_OPTIMIZED="${2:-no}"

echo "=== Building ARM64 Image for Raspberry Pi 4 ==="
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

mkdir -p "${OUTPUT_DIR}"

# Choose Dockerfile
DOCKERFILE="Dockerfile"
if [ "$USE_OPTIMIZED" = "optimized" ]; then
    DOCKERFILE="Dockerfile.optimized"
    echo "Using optimized Dockerfile with cache mounts"
fi

# Build ARM64 image
echo "Building... (this may take 2-5 minutes on first build)"
docker buildx build \
    --platform linux/arm64 \
    --tag ${IMAGE_NAME}:${IMAGE_TAG} \
    --tag ${IMAGE_NAME}:latest \
    --file ${DOCKERFILE} \
    --progress=plain \
    --output type=docker,dest=${OUTPUT_DIR}/${IMAGE_NAME}-arm64.tar \
    .

echo ""
echo "✅ ARM64 image exported to: ${OUTPUT_DIR}/${IMAGE_NAME}-arm64.tar"
ls -lh ${OUTPUT_DIR}/${IMAGE_NAME}-arm64.tar

echo ""
echo "=== Next Steps ==="
echo "1. Copy to your Raspberry Pi 4:"
echo "   scp ${OUTPUT_DIR}/${IMAGE_NAME}-arm64.tar pi@raspberry:/tmp/"
echo ""
echo "2. On the Raspberry Pi, import to containerd:"
echo "   sudo ctr -n k8s.io images import /tmp/${IMAGE_NAME}-arm64.tar"
echo ""
echo "3. Verify:"
echo "   sudo crictl images | grep ${IMAGE_NAME}"
echo ""
echo "Tip: Use './build-arm64.sh ${IMAGE_TAG} optimized' for faster rebuilds with cache mounts"
