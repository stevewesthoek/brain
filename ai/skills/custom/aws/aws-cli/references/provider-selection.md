# Lightsail vs EC2

Use this file only when the user is deciding which AWS compute surface to use.

## Choose Lightsail when
- The user wants a simple VPS with bundled pricing
- One server will handle the workload for now
- Networking needs are basic
- The user values speed and simplicity over flexibility
- The expected hosting density is small and predictable

Typical fit:
- single app
- single WordPress site
- a few low-traffic sites
- simple staging server

## Choose EC2 when
- The user wants a programmable provisioning pipeline
- The server will host many sites
- The user wants CloudPanel
- Storage tuning, instance-family choice, security groups, Elastic IPs, or future growth matter
- The workload may outgrow fixed Lightsail bundles
- The user wants a clean path to separate services later

Typical fit:
- CloudPanel host
- agency or multi-site WordPress host
- WooCommerce or dynamic workloads
- mixed workloads on one machine
- environments that need stronger automation or deeper AWS integration

## Rule of thumb for this workspace
- If the user wants a "perfectly sized" machine and asks for qualification, default to EC2 unless they explicitly prioritize Lightsail simplicity.
- If the user wants CloudPanel, EC2 is usually the better default.
