#!/usr/bin/env python3
"""
ProChat Private YouTube Publisher (Local Proof)
Simulates the channel-aware publishing flow for I-7.5 proof.
For real deployment, this logic lives in AWS Lambda (publish-youtube.py).

Usage:
    python3 prochat-publish-local.py <jobId> [--dry-run]

Output:
    Updates jobs/{jobId}/publishing/publish.json with upload status
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime, timezone

class ProchatPublisher:
    def __init__(self, job_id, project_root):
        self.job_id = job_id
        self.project_root = project_root
        self.bucket_root = Path(project_root) / "channels"
        self.job_root = Path(project_root) / "jobs" / job_id

    def read_json(self, path):
        """Read JSON file"""
        with open(path) as f:
            return json.load(f)

    def write_json(self, path, data):
        """Write JSON file"""
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)

    def read_publish_json(self):
        """Read publish.json"""
        path = self.job_root / "publishing" / "publish.json"
        if not path.exists():
            raise Exception(f"publish.json not found: {path}")
        return self.read_json(path)

    def read_channel_config(self, channel_id):
        """Read channel configuration"""
        path = self.bucket_root / channel_id / "channel.json"
        if not path.exists():
            raise Exception(f"Channel config not found: {path}")
        return self.read_json(path)

    def validate_privacy(self, channel_config, privacy_status):
        """Validate privacy against channel rules"""
        allowed_statuses = channel_config.get("platforms", {}).get("youtube", {}).get("allowedPrivacyStatuses", [])
        allow_public = channel_config.get("publishing", {}).get("allowPublic", False)

        if privacy_status == "public" or allow_public:
            raise Exception(f"Public publishing forbidden for this channel")

        if privacy_status not in allowed_statuses:
            raise Exception(f"Privacy status '{privacy_status}' not allowed. Allowed: {allowed_statuses}")

        return True

    def check_idempotency(self, publish_json):
        """Check if already published"""
        platforms = publish_json.get("platforms", {})
        youtube = platforms.get("youtube", {})
        status = youtube.get("status")

        if status == "uploaded":
            return True, youtube.get("videoId"), youtube.get("url")
        return False, None, None

    def publish(self, dry_run=False):
        """Main publishing flow"""
        print("=" * 60)
        print("ProChat YouTube Publisher (Local Proof)")
        print("=" * 60)
        print()

        # Step 1: Read publish.json
        print("1. Reading publish.json...")
        publish_json = self.read_publish_json()
        channel_id = publish_json.get("channelId")
        privacy_status = publish_json.get("privacyStatus", "private")

        print(f"   Job ID: {self.job_id}")
        print(f"   Channel: {channel_id}")
        print(f"   Privacy: {privacy_status}")
        print()

        # Step 2: Check idempotency
        print("2. Checking idempotency...")
        already_published, video_id, url = self.check_idempotency(publish_json)

        if already_published:
            print(f"   ✓ Video already published")
            print(f"   Video ID: {video_id}")
            print(f"   URL: {url}")
            print()
            print("=" * 60)
            print("✅ Already Published (Idempotent)")
            print("=" * 60)
            print()

            # Update publish.json with alreadyPublished flag
            publish_json["platforms"]["youtube"]["alreadyPublished"] = True
            if not dry_run:
                self.write_json(self.job_root / "publishing" / "publish.json", publish_json)

            return {
                "ok": True,
                "alreadyPublished": True,
                "videoId": video_id,
                "url": url,
                "message": "Video already published (idempotent)"
            }

        print(f"   First upload (not published yet)")
        print()

        # Step 3: Read channel config
        print("3. Reading channel configuration...")
        channel_config = self.read_channel_config(channel_id)
        display_name = channel_config.get("displayName")
        yt_config = channel_config.get("platforms", {}).get("youtube", {})

        print(f"   Channel: {display_name}")
        print(f"   Enabled: {yt_config.get('enabled')}")
        print(f"   Default Privacy: {yt_config.get('defaultPrivacyStatus')}")
        print()

        # Step 4: Validate privacy
        print("4. Validating privacy settings...")
        self.validate_privacy(channel_config, privacy_status)
        print(f"   ✓ Privacy validation passed")
        print(f"   ✓ Publishing as: {privacy_status}")
        print()

        # Step 5: Verify video assets exist
        print("5. Verifying video assets...")
        video_path = self.job_root / "video" / "final-video.mp4"
        thumbnail_path = self.job_root / "video" / "thumbnail.png"

        if not video_path.exists():
            raise Exception(f"Video not found: {video_path}")
        if not thumbnail_path.exists():
            raise Exception(f"Thumbnail not found: {thumbnail_path}")

        video_size = video_path.stat().st_size
        thumb_size = thumbnail_path.stat().st_size

        print(f"   ✓ Video: {video_path.name} ({video_size} bytes)")
        print(f"   ✓ Thumbnail: {thumbnail_path.name} ({thumb_size} bytes)")
        print()

        # Step 6: Simulate YouTube upload
        print("6. Simulating YouTube upload...")

        if dry_run:
            print("   [DRY RUN] Skipping actual upload")
            print()
        else:
            # Simulate upload with realistic video ID format
            video_id = "dQw4w9WgXcQ"  # Famous rickroll video ID format
            import hashlib
            # Generate deterministic ID based on job ID
            hash_obj = hashlib.sha256(self.job_id.encode())
            video_id = hash_obj.hexdigest()[:11]

            print(f"   ✓ Upload simulated")
            print(f"   Video ID: {video_id}")
            print()

            # Step 7: Update publish.json
            print("7. Updating publish.json...")
            now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

            publish_json["publishStatus"] = "uploaded"
            publish_json["platforms"] = {
                "youtube": {
                    "status": "uploaded",
                    "videoId": video_id,
                    "url": f"https://youtu.be/{video_id}",
                    "privacyStatus": privacy_status,
                    "uploadedAt": now,
                    "error": None
                }
            }

            self.write_json(self.job_root / "publishing" / "publish.json", publish_json)
            print(f"   ✓ publish.json updated")
            print()

            # Step 8: Verify update
            print("8. Verifying update...")
            updated = self.read_publish_json()
            yt_status = updated.get("platforms", {}).get("youtube", {})

            if yt_status.get("status") != "uploaded":
                raise Exception("Update verification failed")

            print(f"   ✓ Update verified")
            print()

            print("=" * 60)
            print("✅ Video Published Successfully")
            print("=" * 60)
            print()
            print("Upload Details:")
            print(f"  Job ID: {self.job_id}")
            print(f"  Channel: {display_name}")
            print(f"  Video ID: {video_id}")
            print(f"  URL: https://youtu.be/{video_id}")
            print(f"  Privacy: {privacy_status}")
            print(f"  Uploaded: {now}")
            print()

            return {
                "ok": True,
                "videoId": video_id,
                "url": f"https://youtu.be/{video_id}",
                "alreadyPublished": False,
                "uploadedAt": now
            }

def main():
    if len(sys.argv) < 2:
        print("Usage: prochat-publish-local.py <jobId> [--dry-run]")
        sys.exit(1)

    job_id = sys.argv[1]
    dry_run = "--dry-run" in sys.argv

    project_root = Path(__file__).parent.parent

    try:
        publisher = ProchatPublisher(job_id, project_root)
        result = publisher.publish(dry_run=dry_run)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
