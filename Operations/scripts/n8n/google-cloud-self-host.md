Setup n8n self hosting Google Cloud

sudo apt update
sudo apt install docker.io
sudo apt-get install ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
sudo apt-get update
sudo systemctl start docker
sudo systemctl enable docker

// check for the latest version
sudo curl -L "https://github.com/docker/compose/releases/download/v2.33.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

sudo chmod +x /usr/local/bin/docker-compose
sudo docker-compose --version

sudo nano docker-compose.yaml
sudo nano .env

sudo docker volume create traefik_data
sudo docker volume create n8n_data



sudo docker-compose up -d


# Reset password
n8n container name = admin-n8n-1
sudo docker exec -u node -it admin-n8n-1 n8n user-management:reset