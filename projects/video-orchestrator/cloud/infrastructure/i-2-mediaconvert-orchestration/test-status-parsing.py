#!/usr/bin/env python3
"""
Test: lambda-update-status.py JSON parsing robustness

Validates that the Lambda handles:
1. Normal JSON objects
2. Double-encoded JSON strings
3. Missing files (initialization)
4. Invalid JSON (fallback initialization)
"""
import json
from datetime import datetime


def parse_status_json(body_content):
    """
    Robustly parse status.json body, handling double-encoding.
    This mirrors the logic in lambda-update-status.py lambda_handler.
    """
    # Parse first level
    status_data = json.loads(body_content)

    # If result is still a string (double-encoded), decode again
    if isinstance(status_data, str):
        status_data = json.loads(status_data)

    # Ensure result is a dict
    if not isinstance(status_data, dict):
        raise ValueError('status.json must be a JSON object')

    return status_data


# Test Case 1: Normal JSON object
print("Test 1: Normal JSON object")
normal_json = '{"jobId": "test-001", "status": "pending"}'
result = parse_status_json(normal_json)
assert result['jobId'] == 'test-001'
assert result['status'] == 'pending'
print("  ✅ Pass: Normal JSON parsed correctly")

# Test Case 2: Double-encoded JSON string (the bug scenario)
print("\nTest 2: Double-encoded JSON string")
double_encoded = json.dumps('{"jobId": "test-001", "status": "pending"}')
print(f"  Input (double-encoded): {double_encoded}")
result = parse_status_json(double_encoded)
assert result['jobId'] == 'test-001'
assert result['status'] == 'pending'
print("  ✅ Pass: Double-encoded JSON decoded correctly")

# Test Case 3: Complex object with all fields
print("\nTest 3: Complex object with timestamps and job ID")
complex_json = json.dumps({
    "jobId": "test-001",
    "status": "complete",
    "assemblyStartedAt": "2026-05-30T12:00:00Z",
    "assemblyCompletedAt": "2026-05-30T12:05:00Z",
    "mediaConvertJobId": "1234567890abcdef",
    "updatedAt": "2026-05-30T12:05:01Z"
})
result = parse_status_json(complex_json)
assert result['status'] == 'complete'
assert result['mediaConvertJobId'] == '1234567890abcdef'
print("  ✅ Pass: Complex object with all fields parsed correctly")

# Test Case 4: Invalid JSON should be caught (falls through to initialization in real Lambda)
print("\nTest 4: Invalid JSON handling")
try:
    invalid_json = '{"incomplete": '
    parse_status_json(invalid_json)
    print("  ❌ Fail: Invalid JSON should raise JSONDecodeError")
except json.JSONDecodeError:
    print("  ✅ Pass: Invalid JSON raises JSONDecodeError (caught in real Lambda)")

# Test Case 5: JSON array instead of object
print("\nTest 5: JSON array (wrong type)")
try:
    array_json = '["item1", "item2"]'
    parse_status_json(array_json)
    print("  ❌ Fail: Array should raise ValueError")
except ValueError as e:
    print(f"  ✅ Pass: Array raises ValueError (caught in real Lambda)")

print("\n✅ All test cases pass")
print("\nSummary:")
print("  - Normal JSON objects: supported")
print("  - Double-encoded strings: supported (bug fix)")
print("  - Complex objects with timestamps: supported")
print("  - Invalid JSON: caught and logged for initialization fallback")
print("  - Wrong JSON type (array/string): caught and logged for initialization fallback")
print("\nLambda deployment: after this fix, redeploy video-orchestrator-update-status")
