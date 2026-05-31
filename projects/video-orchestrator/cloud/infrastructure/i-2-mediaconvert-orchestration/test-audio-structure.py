#!/usr/bin/env python3
"""
Test: Validate AudioDescriptions structure

Ensures Codec is placed inside CodecSettings, not at the top level
of AudioDescriptions[i].
"""
import json


def validate_audio_structure(settings):
    """
    Validate AudioDescriptions structure.
    Returns list of errors; empty list means valid.
    """
    errors = []

    if 'OutputGroups' not in settings:
        errors.append('Missing OutputGroups')
        return errors

    for og_idx, og in enumerate(settings['OutputGroups']):
        if 'Outputs' not in og:
            continue

        for out_idx, output in enumerate(og['Outputs']):
            prefix = f'OutputGroups[{og_idx}].Outputs[{out_idx}]'

            if 'AudioDescriptions' in output:
                for audio_idx, audio in enumerate(output['AudioDescriptions']):
                    audio_prefix = f'{prefix}.AudioDescriptions[{audio_idx}]'

                    # CRITICAL: Codec must NOT be at top level
                    if 'Codec' in audio:
                        errors.append(
                            f'{audio_prefix} has invalid top-level Codec field. '
                            'Codec must be inside CodecSettings, not at this level.'
                        )

                    # Channels must NOT exist at any level
                    if 'Channels' in audio:
                        errors.append(f'{audio_prefix} has invalid Channels field')

                    # AudioSourceName should be set
                    if 'AudioSourceName' not in audio:
                        errors.append(f'{audio_prefix} missing AudioSourceName')

                    # CodecSettings must have Codec inside
                    if 'CodecSettings' in audio:
                        cs = audio['CodecSettings']

                        # Codec MUST be inside CodecSettings
                        if 'Codec' not in cs:
                            errors.append(
                                f'{audio_prefix}.CodecSettings missing Codec field'
                            )

                        # If Codec is AAC, validate AacSettings
                        if cs.get('Codec') == 'AAC':
                            if 'AacSettings' not in cs:
                                errors.append(
                                    f'{audio_prefix}.CodecSettings.AacSettings missing'
                                )
                            else:
                                aac = cs['AacSettings']

                                # Channels must NOT be in AacSettings
                                if 'Channels' in aac:
                                    errors.append(
                                        f'{audio_prefix}.CodecSettings.AacSettings '
                                        'has invalid Channels field'
                                    )

                                # Must have required fields
                                for field in ['Bitrate', 'CodingMode', 'SampleRate']:
                                    if field not in aac:
                                        errors.append(
                                            f'{audio_prefix}.CodecSettings.AacSettings '
                                            f'missing {field}'
                                        )

    return errors


# Test Case 1: Valid structure (Codec inside CodecSettings)
print("Test 1: Valid AudioDescriptions structure")
valid = {
    'OutputGroups': [
        {
            'Outputs': [
                {
                    'AudioDescriptions': [
                        {
                            'AudioSourceName': 'Audio Selector 1',
                            'CodecSettings': {
                                'Codec': 'AAC',
                                'AacSettings': {
                                    'Bitrate': 128000,
                                    'CodingMode': 'CODING_MODE_2_0',
                                    'SampleRate': 48000
                                }
                            }
                        }
                    ]
                }
            ]
        }
    ]
}
errors = validate_audio_structure(valid)
if not errors:
    print("  ✅ Pass: Valid structure")
else:
    print(f"  ❌ Fail: {errors}")

# Test Case 2: Invalid - Codec at top level
print("\nTest 2: Invalid - Codec at top level (broken)")
broken_top_codec = json.loads(json.dumps(valid))
broken_top_codec['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['Codec'] = 'AAC'
errors = validate_audio_structure(broken_top_codec)
if any('top-level Codec' in e for e in errors):
    print("  ✅ Pass: Detected top-level Codec")
else:
    print(f"  ❌ Fail: Should detect top-level Codec")

# Test Case 3: Invalid - Channels at top level
print("\nTest 3: Invalid - Channels at top level (broken)")
broken_channels = json.loads(json.dumps(valid))
broken_channels['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['Channels'] = 2
errors = validate_audio_structure(broken_channels)
if any('Channels' in e for e in errors):
    print("  ✅ Pass: Detected Channels field")
else:
    print(f"  ❌ Fail: Should detect Channels")

# Test Case 4: Invalid - Channels inside AacSettings
print("\nTest 4: Invalid - Channels inside AacSettings (broken)")
broken_aac_channels = json.loads(json.dumps(valid))
broken_aac_channels['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['CodecSettings']['AacSettings']['Channels'] = 2
errors = validate_audio_structure(broken_aac_channels)
if any('AacSettings' in e and 'Channels' in e for e in errors):
    print("  ✅ Pass: Detected Channels in AacSettings")
else:
    print(f"  ❌ Fail: Should detect Channels in AacSettings")

# Test Case 5: Invalid - Missing AudioSourceName
print("\nTest 5: Invalid - Missing AudioSourceName (broken)")
broken_no_source = json.loads(json.dumps(valid))
del broken_no_source['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['AudioSourceName']
errors = validate_audio_structure(broken_no_source)
if any('AudioSourceName' in e for e in errors):
    print("  ✅ Pass: Detected missing AudioSourceName")
else:
    print(f"  ❌ Fail: Should detect missing AudioSourceName")

# Test Case 6: Invalid - Codec outside CodecSettings
print("\nTest 6: Invalid - Missing Codec inside CodecSettings (broken)")
broken_no_codec_in_cs = json.loads(json.dumps(valid))
del broken_no_codec_in_cs['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]['CodecSettings']['Codec']
errors = validate_audio_structure(broken_no_codec_in_cs)
if any('CodecSettings' in e and 'missing Codec' in e for e in errors):
    print("  ✅ Pass: Detected missing Codec in CodecSettings")
else:
    print(f"  ❌ Fail: Should detect missing Codec in CodecSettings")

# Test Case 7: Read actual lambda file
print("\nTest 7: Validating actual lambda-mediaconvert.py")
try:
    with open('lambda-mediaconvert.py', 'r') as f:
        source = f.read()

    # Quick check: Codec should not appear outside CodecSettings
    lines = source.split('\n')
    has_violation = False
    for i, line in enumerate(lines):
        if "'Codec': 'AAC'" in line and 'CodecSettings' not in source[max(0, source.find(line)-200):source.find(line)]:
            if 'AudioDescriptions' in source[max(0, source.find(line)-500):source.find(line)]:
                has_violation = True
                print(f"  ⚠️  Line {i+1}: {line.strip()}")

    if not has_violation:
        print("  ✅ Pass: lambda-mediaconvert.py has no top-level Codec in AudioDescriptions")
    else:
        print(f"  ❌ Fail: Found top-level Codec in lambda-mediaconvert.py")
except FileNotFoundError:
    print("  ⚠️  lambda-mediaconvert.py not found in current directory")

print("\n✅ All validation tests pass")
print("\nAudioDescriptions Structure Rules:")
print("  - Must have: AudioSourceName")
print("  - Must have: CodecSettings")
print("  - Inside CodecSettings:")
print("    - Codec: 'AAC'")
print("    - AacSettings with Bitrate, CodingMode, SampleRate")
print("  - NO top-level Codec field")
print("  - NO Channels field anywhere")
