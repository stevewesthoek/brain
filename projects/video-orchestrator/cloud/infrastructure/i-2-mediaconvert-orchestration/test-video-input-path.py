"""
Test: Verify generated video input path construction is correct.
Generated clip must be at:
  jobs/test-001/video-generated/generated-001.mp4
NOT at:
  jobs/test-001/exports/video-generated/generated-001.mp4
"""

def test_generated_video_input_path():
    """Verify path replacement logic."""
    bucket = 's3://prochat-video-dev-909439522876-eu-north-1-an'

    # Start with placeholder input
    video_input = f'{bucket}/jobs/test-001/exports/sample-transcoded.mp4'

    # Simulate lambda-mediaconvert.py path replacement
    if 'sample-transcoded' in video_input:
        video_input_path = video_input.replace(
            'exports/sample-transcoded.mp4',
            'video-generated/generated-001.mp4'
        )

    # Assertions
    expected = f'{bucket}/jobs/test-001/video-generated/generated-001.mp4'
    assert video_input_path == expected, f"Path mismatch:\n  Got: {video_input_path}\n  Expected: {expected}"

    # CRITICAL: Ensure no double-path mistake
    assert '/exports/video-generated/' not in video_input_path, \
        f"FAIL: Path contains incorrect exports nesting: {video_input_path}"

    print(f"✅ Input path: {video_input}")
    print(f"✅ Output path: {video_input_path}")
    print(f"✅ All assertions passed")


if __name__ == '__main__':
    test_generated_video_input_path()
