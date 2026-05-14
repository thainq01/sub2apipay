#!/bin/bash
set -e

REGISTRY="ghcr.io"
IMAGE_NAME="thainq01/sub2apipay"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}"

# Get version from git tag or use "latest"
VERSION="${1:-latest}"

# Ensure buildx builder exists for cross-platform builds
docker buildx inspect sub2apipay-builder >/dev/null 2>&1 || \
  docker buildx create --name sub2apipay-builder --use

echo "==> Building image for linux/amd64: ${FULL_IMAGE}:${VERSION}"
TAGS="-t ${FULL_IMAGE}:${VERSION}"
if [ "$VERSION" != "latest" ]; then
  TAGS="${TAGS} -t ${FULL_IMAGE}:latest"
fi

echo "==> Logging in to GitHub Container Registry..."
echo "    (Make sure GITHUB_TOKEN is set or you'll be prompted)"
if [ -n "$GITHUB_TOKEN" ]; then
  echo "$GITHUB_TOKEN" | docker login "$REGISTRY" -u thainq01 --password-stdin
else
  docker login "$REGISTRY" -u thainq01
fi

echo "==> Building and pushing..."
docker buildx build --platform linux/amd64 ${TAGS} --push .

echo "==> Done! Image pushed to ${FULL_IMAGE}:${VERSION}"
echo ""
echo "To deploy on your server:"
echo "  IMAGE_TAG=${VERSION} docker compose -f docker-compose.prod.yml pull app"
echo "  IMAGE_TAG=${VERSION} docker compose -f docker-compose.prod.yml up -d"
