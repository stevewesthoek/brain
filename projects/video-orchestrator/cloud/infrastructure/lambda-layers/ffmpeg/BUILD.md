# Build ffmpeg Lambda Layer

This document describes how to build a Lambda layer containing ffmpeg for use by Lambda functions.

## Status
⏸️ BLOCKED — Layer not yet created. I-4.2 thumbnail extraction depends on this.

## Why This Layer Is Needed

AWS Lambda base image (Python 3.11 runtime) does not include ffmpeg. The I-4.2 thumbnail extraction Lambda (`video-orchestrator-extract-thumbnail`) requires ffmpeg to extract frames from MP4 videos.

By creating a Lambda layer:
- Layer can be reused by any Lambda function needing video processing
- Single maintenance point for ffmpeg version/updates
- Cleaner separation between function code and system dependencies
- No need to bundle large ffmpeg binary (~15MB) in every function ZIP

## Target Specifications

- **Runtime:** Amazon Linux 2 x86_64 (compatible with Python 3.11 Lambda runtime)
- **ffmpeg version:** Latest stable (or pinned version, e.g., 7.x)
- **Enabled features:** libx264, libx265, libopus, libmp3lame, AAC (minimum)
- **Output structure:** Layer ZIP with `python/bin/ffmpeg`
- **Estimated size:** 15-25MB compressed

## Build Approaches

### Option 1: Use Pre-built Binary (Fastest)

1. Download pre-compiled ffmpeg for Amazon Linux 2
2. Extract and verify
3. Package as layer ZIP

```bash
# Download static ffmpeg build (or from source)
# Example: https://johnvansickle.com/ffmpeg/ (includes static builds)
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

# Extract
tar xf ffmpeg-release-amd64-static.tar.xz
cp ffmpeg-*/ffmpeg ./

# Create layer structure
mkdir -p layer/python/bin
cp ffmpeg layer/python/bin/

# Package as ZIP
cd layer
zip -r ../ffmpeg-layer.zip python/
```

### Option 2: Build from Source (More Control)

Build ffmpeg on an Amazon Linux 2 environment (or EC2 instance):

```bash
# Launch EC2 instance: Amazon Linux 2
# or use Docker: amazonlinux:2

# Install build dependencies
sudo yum update -y
sudo yum groupinstall "Development Tools" -y
sudo yum install -y \
  git \
  wget \
  yasm \
  libx264-devel \
  libx265-devel \
  libopus-devel \
  libvpx-devel \
  libvorbis-devel \
  libtheora-devel

# Download ffmpeg source
cd /tmp
git clone https://git.ffmpeg.org/ffmpeg.git ffmpeg
cd ffmpeg

# Configure for static build
./configure \
  --enable-gpl \
  --enable-libx264 \
  --enable-libx265 \
  --enable-libopus \
  --enable-libvpx \
  --enable-libtheora \
  --disable-shared \
  --enable-static

# Build
make -j$(nproc)

# Verify binary
./ffmpeg -version

# Create layer structure
mkdir -p layer/python/bin
cp ffmpeg layer/python/bin/

# Package as ZIP
cd layer
zip -r ../ffmpeg-layer.zip python/
```

### Option 3: Use Docker to Build (Isolated)

```dockerfile
FROM amazonlinux:2

RUN yum update -y && \
    yum groupinstall "Development Tools" -y && \
    yum install -y git wget yasm libx264-devel libx265-devel libopus-devel

WORKDIR /build
RUN git clone https://git.ffmpeg.org/ffmpeg.git && \
    cd ffmpeg && \
    ./configure \
      --enable-gpl \
      --enable-libx264 \
      --enable-libx265 \
      --enable-libopus \
      --disable-shared \
      --enable-static && \
    make -j$(nproc)

CMD ["cp", "ffmpeg/ffmpeg", "/output/ffmpeg"]
```

Build and extract:
```bash
docker build -t ffmpeg-builder .
docker run -v $(pwd)/output:/output ffmpeg-builder
cp output/ffmpeg layer/python/bin/
```

## Verification

Before creating layer, verify binary works:

```bash
# Test ffmpeg in same environment as Lambda would run
ffmpeg -version

# Test frame extraction (should work)
ffmpeg -i /path/to/test/video.mp4 -ss 3 -vframes 1 -vf "scale=1280:720" -y /tmp/test-thumb.png

# Check if binary is truly static
ldd ./ffmpeg  # Should show "not a dynamic executable" if fully static
```

## Create Lambda Layer

Once binary is ready:

```bash
# Prepare layer ZIP structure
mkdir -p layer/python/bin
cp ffmpeg layer/python/bin/
chmod +x layer/python/bin/ffmpeg

# Create layer ZIP
cd layer
zip -r ffmpeg-layer.zip python/
ls -lh ../ffmpeg-layer.zip

# Upload to AWS
aws lambda publish-layer-version \
  --layer-name video-orchestrator-ffmpeg \
  --description "ffmpeg binary for video processing Lambdas" \
  --zip-file fileb://ffmpeg-layer.zip \
  --compatible-runtimes python3.11 \
  --region eu-north-1

# Note layer version ARN for attaching to Lambda functions
```

## Attach Layer to Lambda

Once layer is published, attach to Lambda function:

```bash
LAYER_ARN="arn:aws:lambda:eu-north-1:909439522876:layer:video-orchestrator-ffmpeg:1"
FUNCTION_NAME="video-orchestrator-extract-thumbnail"

aws lambda update-function-configuration \
  --function-name $FUNCTION_NAME \
  --layers $LAYER_ARN \
  --region eu-north-1
```

## Update Lambda Code

Update `lambda-extract-thumbnail.py` to use ffmpeg from layer path:

```python
# ffmpeg is available at /opt/python/bin/ffmpeg in Lambda
import subprocess

cmd = [
    '/opt/python/bin/ffmpeg',  # Use absolute path from layer
    '-i', video_local,
    '-ss', str(frame_time),
    '-vframes', '1',
    '-vf', f'scale={resolution}',
    '-update', '1',
    '-y',
    thumbnail_local
]

result = subprocess.run(cmd, capture_output=True, text=True)
```

Alternatively, add layer path to $PATH:

```python
import os
import subprocess

# Add layer bin to PATH
os.environ['PATH'] = '/opt/python/bin:' + os.environ.get('PATH', '')

cmd = ['ffmpeg', ...]  # Now just 'ffmpeg'
result = subprocess.run(cmd, capture_output=True, text=True)
```

## Layer Contents at Runtime

When layer is attached, Lambda sees:

```
/opt/python/
  ├── bin/
  │   └── ffmpeg
  └── lib/
      └── (any shared libraries)
```

This path is automatically added to environment by Lambda runtime.

## Next Steps

1. Choose build approach (pre-built binary recommended for speed)
2. Build/obtain ffmpeg binary
3. Create layer ZIP
4. Publish layer version to AWS
5. Attach to I-4.2 Lambda function
6. Test `video-orchestrator-extract-thumbnail` Lambda
7. Integrate with Step Functions

## References

- I-4.2 thumbnail Lambda: `../i-4-thumbnail-generation/lambda-extract-thumbnail.py`
- Deployment script: `../i-4-thumbnail-generation/DEPLOYMENT.md`
- Preflight test: `../../../scripts/i4-thumbnail-preflight.sh`
- ffmpeg docs: https://ffmpeg.org/
- Lambda layers: https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-package.html#gettingstarted-package-layers
- Static ffmpeg builds: https://johnvansickle.com/ffmpeg/
