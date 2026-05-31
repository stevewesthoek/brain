"""
Lambda: Write Canonical Metadata
Writes final status.json and assets.json after workflow completion.
"""
import json
import boto3
from datetime import datetime

s3_client = boto3.client('s3')

BUCKET = 'prochat-video-dev-909439522876-eu-north-1-an'


def lambda_handler(event, context):
    """
    Write canonical metadata (status.json + assets.json) after workflow completion.
    Receives the full Step Functions state.
    """
    print(f'[WriteMetadata] Event keys: {list(event.keys())}')

    job_id = event.get('jobId')
    if not job_id:
        raise ValueError('jobId is required in event')

    try:
        # Extract fields from state
        media_convert_job_id = event.get('mediaConvertJobId', '')

        # thumbnailJob might be nested at different levels depending on state flow
        thumbnail_job = event.get('thumbnailJob', {})
        thumbnail_media_convert_job_id = thumbnail_job.get('thumbnailJobId', '')
        thumbnail_key = thumbnail_job.get('normalizedThumbnailKey', f'jobs/{job_id}/exports/thumbnail-001.jpg')

        # verifyOutput contains the final video path
        verify_output = event.get('verifyOutput', {})
        final_video_key = verify_output.get('mediaconvertOutput', f'jobs/{job_id}/exports/generated-001-final.mp4')

        # statusUpdate contains timing info from earlier state
        status_update = event.get('statusUpdate', {})
        status_data = status_update.get('statusData', {})
        assembly_started_at = status_data.get('assemblyStartedAt', '')
        assembly_completed_at = status_data.get('assemblyCompletedAt', '')

        print(f'[WriteMetadata] jobId={job_id}, mediaConvertJobId={media_convert_job_id}')
        print(f'[WriteMetadata] thumbnailKey={thumbnail_key}, finalVideoKey={final_video_key}')

        # ===== Write status.json =====
        status_json = {
            'jobId': job_id,
            'status': 'complete',
            'currentStep': 'thumbnail_generated',
            'completedSteps': [
                'script_created',
                'script_approved',
                'narration_available',
                'generated_video_available',
                'video_assembled',
                'thumbnail_generated'
            ],
            'failedStep': None,
            'lastError': None,
            'startedAt': assembly_started_at,
            'completedAt': assembly_completed_at,
            'mediaConvertJobId': media_convert_job_id,
            'thumbnailMediaConvertJobId': thumbnail_media_convert_job_id,
            'thumbnailKey': thumbnail_key,
            'finalVideoKey': final_video_key,
            'updatedAt': datetime.utcnow().isoformat() + 'Z'
        }

        status_key = f'jobs/{job_id}/metadata/status.json'
        print(f'[WriteMetadata] Writing status.json to {status_key}')
        s3_client.put_object(
            Bucket=BUCKET,
            Key=status_key,
            Body=json.dumps(status_json, indent=2),
            ContentType='application/json'
        )
        print(f'[WriteMetadata] status.json written successfully')

        # ===== Write assets.json =====
        assets = {}

        # Script is optional
        try:
            s3_client.head_object(Bucket=BUCKET, Key=f'jobs/{job_id}/scripts/script.md')
            assets['script'] = {
                'path': f'jobs/{job_id}/scripts/script.md',
                'type': 'script-markdown',
                'status': 'available'
            }
            print(f'[WriteMetadata] Found script asset')
        except Exception as e:
            print(f'[WriteMetadata] Script asset not found (optional): {str(e)}')

        # Narration is optional
        try:
            narration_head = s3_client.head_object(Bucket=BUCKET, Key=f'jobs/{job_id}/audio/narration.mp3')
            assets['narration'] = {
                'path': f'jobs/{job_id}/audio/narration.mp3',
                'type': 'audio-narration',
                'size': narration_head.get('ContentLength', 0),
                'status': 'available'
            }
            print(f'[WriteMetadata] Found narration asset')
        except Exception as e:
            print(f'[WriteMetadata] Narration asset not found (optional): {str(e)}')

        # Generated video is optional
        try:
            generated_head = s3_client.head_object(Bucket=BUCKET, Key=f'jobs/{job_id}/video-generated/generated-001.mp4')
            assets['generatedVideo'] = {
                'path': f'jobs/{job_id}/video-generated/generated-001.mp4',
                'type': 'video-generated',
                'size': generated_head.get('ContentLength', 0),
                'status': 'available'
            }
            print(f'[WriteMetadata] Found generatedVideo asset')
        except Exception as e:
            print(f'[WriteMetadata] Generated video asset not found (optional): {str(e)}')

        # Final video MUST exist
        try:
            final_video_head = s3_client.head_object(Bucket=BUCKET, Key=final_video_key)
            assets['finalVideo'] = {
                'path': final_video_key,
                'type': 'video-assembled',
                'size': final_video_head.get('ContentLength', 0),
                'status': 'available'
            }
            print(f'[WriteMetadata] Found finalVideo asset')
        except Exception as e:
            error_msg = f'Final video not found at {final_video_key}: {str(e)}'
            print(f'[WriteMetadata] ERROR: {error_msg}')
            raise Exception(error_msg)

        # Thumbnail MUST exist
        try:
            thumbnail_head = s3_client.head_object(Bucket=BUCKET, Key=thumbnail_key)
            assets['thumbnail'] = {
                'path': thumbnail_key,
                'type': 'thumbnail-preview',
                'size': thumbnail_head.get('ContentLength', 0),
                'status': 'available'
            }
            print(f'[WriteMetadata] Found thumbnail asset')
        except Exception as e:
            error_msg = f'Thumbnail not found at {thumbnail_key}: {str(e)}'
            print(f'[WriteMetadata] ERROR: {error_msg}')
            raise Exception(error_msg)

        assets_json = {
            'jobId': job_id,
            'pipelineVersion': 'I-4.2',
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'assets': assets
        }

        assets_key = f'jobs/{job_id}/metadata/assets.json'
        print(f'[WriteMetadata] Writing assets.json to {assets_key} with {len(assets)} assets')
        s3_client.put_object(
            Bucket=BUCKET,
            Key=assets_key,
            Body=json.dumps(assets_json, indent=2),
            ContentType='application/json'
        )
        print(f'[WriteMetadata] assets.json written successfully')

        result = {
            'jobId': job_id,
            'statusWritten': True,
            'assetsWritten': True,
            'assetCount': len(assets),
            'finalVideoKey': final_video_key,
            'thumbnailKey': thumbnail_key
        }
        print(f'[WriteMetadata] Success: {result}')
        return result

    except Exception as e:
        error_msg = f'Failed to write canonical metadata: {str(e)}'
        print(f'[WriteMetadata] Exception: {error_msg}')
        raise Exception(error_msg)
