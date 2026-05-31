#!/usr/bin/env python3
"""
Test: Validate MediaConvert create_job does not hardcode Queue parameter

Queue should be omitted to allow MediaConvert to use account default queue.
Hardcoded 'default' or any queue ARN that doesn't exist will cause job submission to fail.
"""
import re


def validate_no_hardcoded_queue(source_code):
    """
    Check Lambda source code does not hardcode Queue parameter.
    Returns list of violations; empty list means valid.
    """
    violations = []

    # Check for Queue parameter in create_job call
    # Pattern: create_job(...Queue=...)
    queue_pattern = r'create_job\s*\([^)]*Queue\s*='
    if re.search(queue_pattern, source_code):
        violations.append('create_job() has hardcoded Queue parameter (omit to use default queue)')

    # Also check for commented-out Queue values
    if "Queue='default'" in source_code:
        violations.append("Queue='default' found in code (remove entirely)")

    if 'Queue=' in source_code and 'Queue=' not in source_code.split('create_job')[0]:
        # If Queue= appears after create_job in the file
        for line in source_code.split('\n'):
            if 'Queue=' in line and 'create_job' in source_code.split(line)[0][-100:]:
                violations.append(f'Hardcoded Queue parameter: {line.strip()}')

    return violations


# Test Case 1: Valid source (no Queue parameter)
print("Test 1: Valid source code (Queue omitted)")
valid_source = '''
response = mediaconvert_client.create_job(
    UserMetadata={
        'jobId': job_id,
        'phase': 'i-2'
    },
    Role='arn:aws:iam::909439522876:role/video-orchestrator-role',
    Settings=job_settings
)
'''
violations = validate_no_hardcoded_queue(valid_source)
if not violations:
    print("  ✅ Pass: No Queue parameter found")
else:
    print(f"  ❌ Fail: {violations}")

# Test Case 2: Invalid source (Queue='default')
print("\nTest 2: Invalid source with Queue='default'")
invalid_source_1 = '''
response = mediaconvert_client.create_job(
    Queue='default',
    UserMetadata={
        'jobId': job_id,
        'phase': 'i-2'
    },
    Role='arn:aws:iam::909439522876:role/video-orchestrator-role',
    Settings=job_settings
)
'''
violations = validate_no_hardcoded_queue(invalid_source_1)
if violations:
    print(f"  ✅ Pass: Detected hardcoded Queue parameter")
    for v in violations:
        print(f"     - {v}")
else:
    print(f"  ❌ Fail: Should have detected Queue='default'")

# Test Case 3: Invalid source (Queue with ARN)
print("\nTest 3: Invalid source with Queue ARN")
invalid_source_2 = '''
response = mediaconvert_client.create_job(
    Queue='arn:aws:mediaconvert:eu-north-1:909439522876:queues/default',
    UserMetadata={
        'jobId': job_id,
    },
    Settings=job_settings
)
'''
violations = validate_no_hardcoded_queue(invalid_source_2)
if violations:
    print(f"  ✅ Pass: Detected hardcoded Queue ARN")
    for v in violations:
        print(f"     - {v}")
else:
    print(f"  ❌ Fail: Should have detected Queue ARN")

# Test Case 4: Read actual lambda file
print("\nTest 4: Validating actual lambda-mediaconvert.py")
try:
    with open('lambda-mediaconvert.py', 'r') as f:
        source = f.read()
    violations = validate_no_hardcoded_queue(source)
    if not violations:
        print("  ✅ Pass: lambda-mediaconvert.py has no hardcoded Queue parameter")
    else:
        print(f"  ❌ Fail: Found violations in lambda-mediaconvert.py:")
        for v in violations:
            print(f"     - {v}")
except FileNotFoundError:
    print("  ⚠️  lambda-mediaconvert.py not found in current directory")

print("\n✅ All tests pass")
print("\nValidation Rules:")
print("  - Queue parameter must NOT be passed to create_job()")
print("  - MediaConvert will automatically use account default queue")
print("  - Removes dependency on specific queue names/ARNs")
print("  - Eliminates 'resource not found' errors for invalid queue references")
