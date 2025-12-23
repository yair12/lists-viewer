#!/bin/bash

# Build multi-architecture image for Raspberry Pi 4 (ARM64) and AMD64
# This script builds the image and exports it as a tarball for containerd

set -e

# Configuration
IMAGE_NAME="lists-viewer"
IMAGE_TAG="${1:-latest}"
REGISTRY="${2:-local}"
OUTPUT_DIR="./k8s-images"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Building Multi-Architecture Image for Kubernetes ===${NC}"
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Target architectures: linux/amd64, linux/arm64"
echo ""

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Check if buildx is available
if ! docker buildx version &> /dev/null; then
    echo -e "${RED}Error: docker buildx is not available${NC}"
    echo "Please install docker buildx or use Docker Desktop"
    exit 1
fi

# Create a new builder instance if it doesn't exist
BUILDER_NAME="multiarch-builder"
if ! docker buildx inspect ${BUILDER_NAME} &> /dev/null; then
    echo -e "${YELLOW}Creating new buildx builder: ${BUILDER_NAME}${NC}"
    docker buildx create --name ${BUILDER_NAME} --use --platform linux/amd64,linux/arm64
else
    echo -e "${YELLOW}Using existing builder: ${BUILDER_NAME}${NC}"
    docker buildx use ${BUILDER_NAME}
fi

# Bootstrap the builder
docker buildx inspect --bootstrap

echo -e "${GREEN}Building multi-architecture image...${NC}"

# Build for both architectures using OCI format
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${IMAGE_NAME}:${IMAGE_TAG} \
    --tag ${IMAGE_NAME}:latest \
    --file Dockerfile \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --output type=oci,dest=${OUTPUT_DIR}/${IMAGE_NAME}-multi.tar \
    .

echo -e "${GREEN}Multi-arch image built and exported to: ${OUTPUT_DIR}/${IMAGE_NAME}-multi.tar${NC}"

# Also build ARM64-specific image for easier deployment
echo -e "${GREEN}Building ARM64-specific image for Raspberry Pi 4...${NC}"
docker buildx build \
    --platform linux/arm64 \
    --tag ${IMAGE_NAME}:${IMAGE_TAG} \
    --tag ${IMAGE_NAME}:latest \
    --file Dockerfile \
    --output type=docker,dest=${OUTPUT_DIR}/${IMAGE_NAME}-arm64.tar \
    .

echo -e "${GREEN}ARM64 image exported to: ${OUTPUT_DIR}/${IMAGE_NAME}-arm64.tar${NC}"

# Also build AMD64-specific image
echo -e "${GREEN}Building AMD64-specific image...${NC}"
docker buildx build \
    --platform linux/amd64 \
    --tag ${IMAGE_NAME}:${IMAGE_TAG} \
    --tag ${IMAGE_NAME}:latest \
    --file Dockerfile \
    --output type=docker,dest=${OUTPUT_DIR}/${IMAGE_NAME}-amd64.tar \
    .

echo -e "${GREEN}AMD64 image exported to: ${OUTPUT_DIR}/${IMAGE_NAME}-amd64.tar${NC}"

# Get image sizes
echo ""
echo -e "${GREEN}=== Image Files Created ===${NC}"
ls -lh ${OUTPUT_DIR}/*.tar

echo ""
echo -e "${GREEN}=== Next Steps ===${NC}"
echo "1. Copy the tar file to your Kubernetes nodes:"
echo "   ${YELLOW}scp ${OUTPUT_DIR}/${IMAGE_NAME}-arm64.tar user@rpi4:/tmp/${NC}"
echo ""
echo "2. On the Kubernetes node, import to containerd:"
echo "   ${YELLOW}sudo ctr -n k8s.io images import /tmp/${IMAGE_NAME}-arm64.tar${NC}"
echo ""
echo "3. Verify the image:"
echo "   ${YELLOW}sudo crictl images | grep ${IMAGE_NAME}${NC}"
echo ""
echo "4. Deploy to Kubernetes:"
echo "   ${YELLOW}kubectl apply -f helm/lists-viewer/templates/${NC}"
echo ""
echo -e "${GREEN}Build complete!${NC}"
