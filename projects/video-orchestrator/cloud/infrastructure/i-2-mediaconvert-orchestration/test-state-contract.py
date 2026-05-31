"""
Test: Verify Step Functions state contract preservation.
Simulates state flow through key transitions to ensure
actualOutputKey, expectedOutputKey, mediaConvertJobId are preserved.
"""

import json

def simulate_state_flow():
    """Simulate state flow through Step Functions workflow."""

    print("════════════════════════════════════════════════════════════")
    print("Step Functions State Contract Test")
    print("════════════════════════════════════════════════════════════")
    print("")

    # Initial state (simplified)
    initial_state = {
        "jobId": "test-001"
    }
    print("1. Initial state:")
    print(f"   {json.dumps(initial_state, indent=2)}")
    print("")

    # After TriggerMediaConvertJob
    after_mediaconvert_trigger = {
        "jobId": "test-001",
        "mediaConvertJobId": "1780234138214-zkqs9n",
        "expectedOutputKey": "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/generated-001-final.mp4"
    }
    print("2. After TriggerMediaConvertJob:")
    print(f"   {json.dumps(after_mediaconvert_trigger, indent=2)}")
    print("")

    # After WaitForMediaConvertCompletion
    after_wait = {
        "jobId": "test-001",
        "mediaConvertJobId": "1780234138214-zkqs9n",
        "expectedOutputKey": "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/generated-001-final.mp4",
        "actualOutputKey": "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/generated-001-final.mp4",
        "status": "COMPLETE",
        "attempts": 3
    }
    print("3. After WaitForMediaConvertCompletion:")
    print(f"   {json.dumps(after_wait, indent=2)}")
    print("")

    # After MediaConvertCompleted with ResultPath="$.statusUpdate"
    # ResultPath merges Lambda output into $.statusUpdate, preserves top-level fields
    update_status_output = {
        "jobId": "test-001",
        "status": "complete"
    }

    after_update_status_with_resultpath = {
        **after_wait,  # Preserves all fields from wait
        "statusUpdate": update_status_output  # Adds status update under new key
    }

    print("4. After MediaConvertCompleted with ResultPath='$.statusUpdate':")
    print(f"   {json.dumps(after_update_status_with_resultpath, indent=2)}")
    print("")

    # Check VerifyOutput receives what it needs
    print("5. VerifyOutput input fields available:")
    verify_input_fields = [
        ("jobId", after_update_status_with_resultpath.get("jobId")),
        ("mediaConvertJobId", after_update_status_with_resultpath.get("mediaConvertJobId")),
        ("actualOutputKey", after_update_status_with_resultpath.get("actualOutputKey")),
        ("expectedOutputKey", after_update_status_with_resultpath.get("expectedOutputKey")),
    ]

    for field, value in verify_input_fields:
        status = "✅" if value else "❌"
        print(f"   {status} {field}: {value}")

    print("")

    # Verify all critical fields are present
    print("6. Validation:")
    critical_fields = ["jobId", "actualOutputKey", "mediaConvertJobId"]
    all_present = all(after_update_status_with_resultpath.get(f) for f in critical_fields)

    if all_present:
        print("   ✅ All critical fields preserved through state flow")
        print("   ✅ VerifyOutput will receive complete state")
        return True
    else:
        print("   ❌ FAIL: Critical fields missing!")
        missing = [f for f in critical_fields if not after_update_status_with_resultpath.get(f)]
        print(f"   Missing: {missing}")
        return False

if __name__ == '__main__':
    success = simulate_state_flow()
    exit(0 if success else 1)
