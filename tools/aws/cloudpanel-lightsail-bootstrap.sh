#!/bin/bash
set -euxo pipefail

exec > >(tee -a /var/log/cloudpanel-bootstrap.log) 2>&1

ADMIN_IP_CIDR="${ADMIN_IP_CIDR:-}"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
DEBIAN_FRONTEND=noninteractive apt-get -y install curl wget sudo ufw

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp

if [[ -n "${ADMIN_IP_CIDR}" ]]; then
  ufw allow from "${ADMIN_IP_CIDR}" to any port 22 proto tcp
  ufw allow from "${ADMIN_IP_CIDR}" to any port 8443 proto tcp
else
  ufw allow 22/tcp
  ufw allow 8443/tcp
fi

ufw --force enable

curl -sS https://installer.cloudpanel.io/ce/v2/install.sh -o /root/install.sh
echo "19cfa702e7936a79e47812ff57d9859175ea902c62a68b2c15ccd1ebaf36caeb /root/install.sh" | sha256sum -c
CLOUD=aws DB_ENGINE=MARIADB_11.4 bash /root/install.sh
