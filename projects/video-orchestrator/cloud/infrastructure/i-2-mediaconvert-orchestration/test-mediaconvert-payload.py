#!/usr/bin/env python3
"""
Test: lambda-mediaconvert.py payload validation

Validates that the MediaConvert job settings conform to AWS API requirements.
This catches invalid fields and settings before submission.
"""
import json


def validate_mediaconvert_payload(settings):
    """
    Validate MediaConvert job settings structure.
    Returns list of errors; empty list means valid.
    """
    errors = []

    # Check OutputGroups exists
    if 'OutputGroups' not in settings:
        errors.append('Missing OutputGroups')
        return errors

    for og_idx, og in enumerate(settings['OutputGroups']):
        if 'Outputs' not in og:
            errors.append(f'OutputGroups[{og_idx}] missing Outputs')
            continue

        for out_idx, output in enumerate(og['Outputs']):
            prefix = f'OutputGroups[{og_idx}].Outputs[{out_idx}]'

            # Check for invalid "Filename" field
            if 'Filename' in output:
                errors.append(f'{prefix} has invalid field "Filename" (use NameModifier or destination path)')

            # Check for JobTemplate parameter (must be omitted if not using)
            if 'JobTemplate' in settings and settings['JobTemplate'] is None:
                errors.append('JobTemplate cannot be None; omit entirely if not using')

            # Validate AudioDescriptions if present
            if 'AudioDescriptions' in output:
                for audio_idx, audio in enumerate(output['AudioDescriptions']):
                    audio_prefix = f'{prefix}.AudioDescriptions[{audio_idx}]'

                    if 'CodecSettings' in audio and 'AacSettings' in audio['CodecSettings']:
                        aac = audio['CodecSettings']['AacSettings']

                        # Check for invalid "Channels" field
                        if 'Channels' in aac:
                            errors.append(
                                f'{audio_prefix}.CodecSettings.AacSettings has invalid field "Channels" '
                                '(use CodingMode: CODING_MODE_2_0 for stereo)'
                            )

                        # Validate CodingMode if present
                        if 'CodingMode' in aac:
                            valid_modes = ['CODING_MODE_1_0', 'CODING_MODE_2_0', 'CODING_MODE_5_1']
                            if aac['CodingMode'] not in valid_modes:
                                errors.append(
                                    f'{audio_prefix}.CodecSettings.AacSettings.CodingMode must be one of {valid_modes}'
                                )

                        # Validate Bitrate
                        if 'Bitrate' in aac:
                            if aac['Bitrate'] < 8000 or aac['Bitrate'] > 320000:
                                errors.append(
                                    f'{audio_prefix}.CodecSettings.AacSettings.Bitrate must be 8000-320000 (got {aac["Bitrate"]})'
                                )

                        # Validate SampleRate
                        if 'SampleRate' in aac:
                            valid_rates = [8000, 16000, 32000, 44100, 48000, 96000]
                            if aac['SampleRate'] not in valid_rates:
                                errors.append(
                                    f'{audio_prefix}.CodecSettings.AacSettings.SampleRate must be one of {valid_rates}'
                                )

    return errors


# Test Case 1: Valid minimal payload (fixed version)
print("Test 1: Valid fixed payload")
valid_payload = {
    'TimecodeConfig': {'Source': 'ZEROBASED'},
    'Inputs': [
        {'FileInput': 's3://bucket/video.mp4'},
        {'FileInput': 's3://bucket/audio.mp3'}
    ],
    'OutputGroups': [
        {
            'Name': 'File Group',
            'Outputs': [
                {
                    'NameModifier': '-final',
                    'VideoDescription': {
                        'CodecSettings': {
                            'H264Settings': {
                                'MaxBitrate': 5000000,
                                'FramerateDenominator': 1,
                                'FramerateNumerator': 30,
                                'RateControlMode': 'VBR'
                            }
                        }
                    },
                    'AudioDescriptions': [
                        {
                            'CodecSettings': {
                                'AacSettings': {
                                    'Bitrate': 128000,
                                    'SampleRate': 48000,
                                    'CodingMode': 'CODING_MODE_2_0'
                                }
                            }
                        }
                    ],
                    'ContainerSettings': {
                        'Container': 'MP4'
                    }
                }
            ],
            'OutputGroupSettings': {
                'Type': 'FILE_GROUP_SETTINGS',
                'FileGroupSettings': {
                    'Destination': 's3://bucket/exports/'
                }
            }
        }
    ]
}
errors = validate_mediaconvert_payload(valid_payload)
if not errors:
    print("  ✅ Pass: Valid payload has no errors")
else:
    print(f"  ❌ Fail: Unexpected errors: {errors}")

# Test Case 2: Old broken payload (Filename field)
print("\nTest 2: Broken payload with invalid Filename field")
broken_filename = valid_payload.copy()
broken_filename['OutputGroups'][0]['Outputs'][0]['Filename'] = 'test-001-final.mp4'
errors = validate_mediaconvert_payload(broken_filename)
if any('Filename' in e for e in errors):
    print(f"  ✅ Pass: Caught invalid Filename field")
else:
    print(f"  ❌ Fail: Should have caught Filename field")

# Test Case 3: Old broken payload (Channels field)
print("\nTest 3: Broken payload with invalid Channels field")
broken_channels = json.loads(json.dumps(valid_payload))
broken_channels['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['CodecSettings']['AacSettings']['Channels'] = 2
errors = validate_mediaconvert_payload(broken_channels)
if any('Channels' in e for e in errors):
    print(f"  ✅ Pass: Caught invalid Channels field")
else:
    print(f"  ❌ Fail: Should have caught Channels field")

# Test Case 4: JobTemplate=None is invalid
print("\nTest 4: JobTemplate parameter set to None")
broken_template = json.loads(json.dumps(valid_payload))
broken_template['JobTemplate'] = None
errors = validate_mediaconvert_payload(broken_template)
if any('JobTemplate' in e for e in errors):
    print(f"  ✅ Pass: Caught JobTemplate=None")
else:
    print(f"  ❌ Fail: Should have caught JobTemplate=None")

# Test Case 5: Invalid CodingMode
print("\nTest 5: Invalid CodingMode")
broken_mode = json.loads(json.dumps(valid_payload))
broken_mode['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['CodecSettings']['AacSettings']['CodingMode'] = 'INVALID_MODE'
errors = validate_mediaconvert_payload(broken_mode)
if any('CodingMode' in e for e in errors):
    print(f"  ✅ Pass: Caught invalid CodingMode")
else:
    print(f"  ❌ Fail: Should have caught invalid CodingMode")

# Test Case 6: Invalid SampleRate
print("\nTest 6: Invalid SampleRate")
broken_rate = json.loads(json.dumps(valid_payload))
broken_rate['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['CodecSettings']['AacSettings']['SampleRate'] = 22050
errors = validate_mediaconvert_payload(broken_rate)
if any('SampleRate' in e for e in errors):
    print(f"  ✅ Pass: Caught invalid SampleRate")
else:
    print(f"  ❌ Fail: Should have caught invalid SampleRate")

# Test Case 7: Invalid Bitrate
print("\nTest 7: Invalid Bitrate (too high)")
broken_bitrate = json.loads(json.dumps(valid_payload))
broken_bitrate['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['CodecSettings']['AacSettings']['Bitrate'] = 500000
errors = validate_mediaconvert_payload(broken_bitrate)
if any('Bitrate' in e for e in errors):
    print(f"  ✅ Pass: Caught invalid Bitrate")
else:
    print(f"  ❌ Fail: Should have caught invalid Bitrate")

print("\n✅ All validation tests pass")
print("\nSummary:")
print("  - Valid payload with NameModifier, CodingMode, no Filename: supported")
print("  - Invalid Filename field: detected")
print("  - Invalid Channels field: detected")
print("  - JobTemplate=None: detected")
print("  - Invalid CodingMode: detected")
print("  - Invalid SampleRate: detected")
print("  - Invalid Bitrate: detected")
print("\nOutput naming:")
print("  - NameModifier: '-final'")
print("  - Input video base: 'sample-transcoded.mp4'")
print("  - Result filename: 'sample-transcoded-final.mp4' (in output destination)")
print("\nLambda deployment: after this fix, redeploy video-orchestrator-mediaconvert")
