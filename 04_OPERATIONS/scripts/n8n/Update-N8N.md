# UPDATE N8N SCRIPT
nano update_n8n.sh

#!/bin/bash

# Stop n8n service
echo "Stopping n8n service..."
docker-compose stop n8n

# Pull the latest n8n image
echo "Pulling latest n8n image..."
docker-compose pull n8n

# Start n8n service in detached mode
echo "Starting n8n service..."
docker-compose up -d

echo "Docker n8n updated."

# Clean up dangling images (unused images)
echo "Removing old Docker images..."
docker images -f "dangling=true" -q | while read -r image_id; do
	if [[ -n "$image_id" ]]; then
echo "Removing image $image_id"
docker rmi "$image_id"
else
	echo "No old Docker images to remove."
fi
done

echo "Cleanup complete."



chmod +x update_n8n.sh
sudo ./update_n8n.sh