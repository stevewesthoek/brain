"""
Lambda: Check Approval Status
Verifies that script.status = approved in metadata/approvals.json before proceeding to assembly.
"""
import json
import boto3
from datetime import datetime

s3_client = boto3.client('s3')

BUCKET = 'prochat-video-dev-909439522876-eu-north-1-an'


def lambda_handler(event, context):
    """
    Check if script has been approved.

    Expected input:
    {
      "jobId": "test-001" or "prochat-os-001"
    }

    Returns:
    - approved: boolean
    - approvedBy: string or null
    - approvedAt: ISO timestamp or null
    """
    job_id = event.get('jobId')
    if not job_id:
        raise ValueError('jobId is required')

    approvals_key = f'jobs/{job_id}/metadata/approvals.json'

    try:
        # Read approvals.json from S3
        response = s3_client.get_object(Bucket=BUCKET, Key=approvals_key)
        approvals_data = json.loads(response['Body'].read().decode('utf-8'))

        # Check script approval status
        script_approval = approvals_data.get('approvals', {}).get('script', {})
        approval_status = script_approval.get('status', 'unknown')

        if approval_status != 'approved':
            return {
                'approved': False,
                'status': approval_status,
                'jobId': job_id,
                'message': f'Script approval status: {approval_status}, not approved'
            }

        # Approval is granted
        return {
            'approved': True,
            'status': 'approved',
            'jobId': job_id,
            'approvedBy': script_approval.get('approvedBy'),
            'approvedAt': script_approval.get('approvedAt'),
            'message': 'Script approved, proceeding to assembly'
        }

    except Exception as e:
        raise Exception(f'Failed to check approval status: {str(e)}')
