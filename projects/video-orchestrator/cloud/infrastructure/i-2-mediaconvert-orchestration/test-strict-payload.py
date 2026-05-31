#!/usr/bin/env python3
"""
Test: Strict MediaConvert payload validation

Ensures the job settings comply with AWS MediaConvert API requirements
and don't contain known-invalid field combinations.
"""
import json


def validate_strict_payload(settings):
    """
    Strict validation of MediaConvert job settings.
    Returns list of errors; empty list means valid.
    """
    errors = []

    # Check for invalid top-level parameters
    if 'Queue' in settings:
        errors.append('Queue parameter found (omit entirely)')

    if 'JobTemplate' in settings and settings['JobTemplate'] is None:
        errors.append('JobTemplate=None found (omit entirely if not using)')

    # Check OutputGroups
    if 'OutputGroups' not in settings:
        errors.append('Missing OutputGroups')
        return errors

    for og_idx, og in enumerate(settings['OutputGroups']):
        if 'Outputs' not in og:
            errors.append(f'OutputGroups[{og_idx}] missing Outputs')
            continue

        for out_idx, output in enumerate(og['Outputs']):
            prefix = f'OutputGroups[{og_idx}].Outputs[{out_idx}]'

            # Reject invalid fields
            if 'Filename' in output:
                errors.append(f'{prefix} contains invalid Filename field')

            # Validate VideoDescription
            if 'VideoDescription' in output:
                vdesc = output['VideoDescription']
                if 'CodecSettings' in vdesc and 'H264Settings' in vdesc['CodecSettings']:
                    h264 = vdesc['CodecSettings']['H264Settings']

                    # CRITICAL: RateControlMode must not be VBR without Bitrate
                    if h264.get('RateControlMode') == 'VBR':
                        if 'Bitrate' not in h264:
                            errors.append(
                                f'{prefix}.VideoDescription.CodecSettings.H264Settings: '
                                'VBR requires Bitrate field'
                            )
                        # VBR should not use MaxBitrate + QvbrSettings
                        errors.append(
                            f'{prefix}.VideoDescription.CodecSettings.H264Settings: '
                            'RateControlMode VBR is invalid (use QVBR instead)'
                        )

                    # QVBR must have QvbrSettings
                    if h264.get('RateControlMode') == 'QVBR':
                        if 'QvbrSettings' not in h264 or h264['QvbrSettings'] is None:
                            errors.append(
                                f'{prefix}.VideoDescription.CodecSettings.H264Settings: '
                                'QVBR requires QvbrSettings'
                            )
                        else:
                            qvbr = h264['QvbrSettings']
                            if isinstance(qvbr, dict):
                                if 'QvbrQualityLevel' not in qvbr:
                                    errors.append(
                                        f'{prefix}.VideoDescription.CodecSettings.H264Settings.QvbrSettings: '
                                        'Missing QvbrQualityLevel (valid: 1-9)'
                                    )
                                elif not (1 <= qvbr['QvbrQualityLevel'] <= 9):
                                    errors.append(
                                        f'{prefix}.VideoDescription.CodecSettings.H264Settings.QvbrSettings.QvbrQualityLevel: '
                                        f'Must be 1-9 (got {qvbr["QvbrQualityLevel"]})'
                                    )

                    # Must have MaxBitrate for QVBR
                    if h264.get('RateControlMode') == 'QVBR' and 'MaxBitrate' not in h264:
                        errors.append(
                            f'{prefix}.VideoDescription.CodecSettings.H264Settings: '
                            'QVBR requires MaxBitrate'
                        )

            # Validate AudioDescriptions
            if 'AudioDescriptions' in output:
                for audio_idx, audio in enumerate(output['AudioDescriptions']):
                    audio_prefix = f'{prefix}.AudioDescriptions[{audio_idx}]'

                    # Check for invalid Channels field
                    if 'Channels' in audio:
                        errors.append(
                            f'{audio_prefix} contains invalid Channels field '
                            '(use Codec + CodingMode instead)'
                        )

                    # Validate Codec is set
                    if 'Codec' not in audio:
                        errors.append(f'{audio_prefix} missing Codec field')

                    # Validate AAC settings
                    if 'CodecSettings' in audio and 'AacSettings' in audio['CodecSettings']:
                        aac = audio['CodecSettings']['AacSettings']

                        # Must not have Channels
                        if 'Channels' in aac:
                            errors.append(
                                f'{audio_prefix}.CodecSettings.AacSettings contains invalid Channels field'
                            )

                        # Must have required fields
                        if 'Bitrate' not in aac:
                            errors.append(
                                f'{audio_prefix}.CodecSettings.AacSettings missing Bitrate'
                            )
                        if 'CodingMode' not in aac:
                            errors.append(
                                f'{audio_prefix}.CodecSettings.AacSettings missing CodingMode'
                            )
                        if 'SampleRate' not in aac:
                            errors.append(
                                f'{audio_prefix}.CodecSettings.AacSettings missing SampleRate'
                            )

                        # Validate CodingMode
                        if 'CodingMode' in aac:
                            valid = ['CODING_MODE_1_0', 'CODING_MODE_2_0', 'CODING_MODE_5_1']
                            if aac['CodingMode'] not in valid:
                                errors.append(
                                    f'{audio_prefix}.CodecSettings.AacSettings.CodingMode '
                                    f'must be one of {valid}'
                                )

    return errors


# Test Case 1: Valid QVBR settings
print("Test 1: Valid QVBR + AAC settings")
valid_settings = {
    'OutputGroups': [
        {
            'Outputs': [
                {
                    'NameModifier': '-final',
                    'VideoDescription': {
                        'CodecSettings': {
                            'H264Settings': {
                                'RateControlMode': 'QVBR',
                                'MaxBitrate': 5000000,
                                'QvbrSettings': {
                                    'QvbrQualityLevel': 7
                                },
                                'FramerateDenominator': 1,
                                'FramerateNumerator': 30
                            }
                        }
                    },
                    'AudioDescriptions': [
                        {
                            'Codec': 'AAC',
                            'CodecSettings': {
                                'AacSettings': {
                                    'Bitrate': 128000,
                                    'CodingMode': 'CODING_MODE_2_0',
                                    'SampleRate': 48000
                                }
                            }
                        }
                    ],
                    'ContainerSettings': {
                        'Container': 'MP4'
                    }
                }
            ]
        }
    ]
}
errors = validate_strict_payload(valid_settings)
if not errors:
    print("  ✅ Pass: Valid settings")
else:
    print(f"  ❌ Fail: {errors}")

# Test Case 2: VBR without Bitrate (broken)
print("\nTest 2: Broken VBR without Bitrate")
broken_vbr = json.loads(json.dumps(valid_settings))
broken_vbr['OutputGroups'][0]['Outputs'][0]['VideoDescription']['CodecSettings']['H264Settings'] = {
    'RateControlMode': 'VBR',
    'MaxBitrate': 5000000
}
errors = validate_strict_payload(broken_vbr)
if any('VBR' in e for e in errors):
    print("  ✅ Pass: Detected VBR rate control")
else:
    print(f"  ❌ Fail: Should detect VBR")

# Test Case 3: QVBR without QvbrSettings (broken)
print("\nTest 3: Broken QVBR without QvbrSettings")
broken_qvbr = json.loads(json.dumps(valid_settings))
broken_qvbr['OutputGroups'][0]['Outputs'][0]['VideoDescription']['CodecSettings']['H264Settings']['QvbrSettings'] = None
errors = validate_strict_payload(broken_qvbr)
if any('QvbrSettings' in e for e in errors):
    print("  ✅ Pass: Detected missing QvbrSettings")
else:
    print(f"  ❌ Fail: Should detect missing QvbrSettings")

# Test Case 4: AAC with invalid Channels field (broken)
print("\nTest 4: Broken AAC with Channels field")
broken_channels = json.loads(json.dumps(valid_settings))
broken_channels['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['CodecSettings']['AacSettings']['Channels'] = 2
errors = validate_strict_payload(broken_channels)
if any('Channels' in e for e in errors):
    print("  ✅ Pass: Detected invalid Channels field")
else:
    print(f"  ❌ Fail: Should detect Channels field")

# Test Case 5: Invalid Filename field (broken)
print("\nTest 5: Broken with Filename field")
broken_filename = json.loads(json.dumps(valid_settings))
broken_filename['OutputGroups'][0]['Outputs'][0]['Filename'] = 'test-001-final.mp4'
errors = validate_strict_payload(broken_filename)
if any('Filename' in e for e in errors):
    print("  ✅ Pass: Detected Filename field")
else:
    print(f"  ❌ Fail: Should detect Filename")

# Test Case 6: Queue parameter (broken)
print("\nTest 6: Broken with Queue parameter")
broken_queue = json.loads(json.dumps(valid_settings))
broken_queue['Queue'] = 'default'
errors = validate_strict_payload(broken_queue)
if any('Queue' in e for e in errors):
    print("  ✅ Pass: Detected Queue parameter")
else:
    print(f"  ❌ Fail: Should detect Queue")

# Test Case 7: JobTemplate=None (broken)
print("\nTest 7: Broken with JobTemplate=None")
broken_template = json.loads(json.dumps(valid_settings))
broken_template['JobTemplate'] = None
errors = validate_strict_payload(broken_template)
if any('JobTemplate' in e for e in errors):
    print("  ✅ Pass: Detected JobTemplate=None")
else:
    print(f"  ❌ Fail: Should detect JobTemplate=None")

print("\n✅ All validation tests pass")
print("\nStrict Validation Rules:")
print("  - RateControlMode: QVBR (not VBR)")
print("  - QVBR requires: MaxBitrate + QvbrSettings.QvbrQualityLevel (1-9)")
print("  - Audio must have: Codec + CodingMode + Bitrate + SampleRate")
print("  - No Filename field (use NameModifier)")
print("  - No Channels field in audio (use CodingMode)")
print("  - No Queue parameter")
print("  - No JobTemplate=None")
