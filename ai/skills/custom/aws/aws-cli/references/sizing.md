# AWS Server Sizing

Use this file after the qualification questions are answered.

These are starting points, not guarantees. Favor headroom for production hosting.

## Inputs that matter most
- number of sites
- number of WordPress sites
- whether WooCommerce or other dynamic apps are involved
- traffic level
- media and backup storage footprint
- growth horizon

## Starting recommendations

### Very small
Profile:
- 1 low-traffic brochure site or 1 tiny internal app
- little media
- low concurrency

Starting point:
- Lightsail: 1 GB or 2 GB bundle
- EC2: `t3.small` or `t3a.small`
- Storage: 40-60 GB

### Small
Profile:
- 2-5 light websites
- some WordPress
- normal business traffic
- modest growth

Starting point:
- Lightsail: 2 GB or 4 GB bundle
- EC2: `t3.medium` or `t3a.medium`
- Storage: 60-100 GB

### Medium hosting node
Profile:
- 5-15 sites
- several WordPress installs
- moderate concurrency
- some heavier plugins or background jobs

Starting point:
- EC2: `t3.large`, `t3a.large`, or `m7i-large`
- Storage: 100-200 GB gp3

### Heavy dynamic / agency host
Profile:
- 10+ sites with mixed workloads
- WooCommerce, LMS, membership, or campaign spikes
- wants CloudPanel

Starting point:
- EC2: `m7i-large`, `m7i.xlarge`, `c7i.large`, or `c7i.xlarge` depending CPU intensity
- Storage: 150-300 GB gp3

### Media-heavy or backup-heavy
Adjustments:
- increase storage first
- separate backups from root disk when practical
- do not size only for CPU/RAM if the server stores uploads, images, or local dumps

## Practical heuristics
- Many small static or cached sites: memory matters, but moderate CPU is usually fine
- WordPress with admin usage and plugins: favor more memory
- WooCommerce and uncached dynamic flows: favor both CPU and memory
- Growth uncertainty: choose EC2 over Lightsail
- CloudPanel multi-site host: do not start too small just to save a little money

## What to lock before provisioning
- chosen service: Lightsail or EC2
- chosen instance family or Lightsail bundle
- root disk size
- snapshot or backup expectation
- public IP strategy
- whether CloudPanel will be installed later
