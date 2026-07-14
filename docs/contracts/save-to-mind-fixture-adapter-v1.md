# Save-to-Mind fixture adapter v1

This is Brain-owned, installation-specific evidence for `brain-to-mind-b1-0a`.
It is not a Workbench command, generic migration policy, or authority to execute
a live fixture. The implementation accepts only a fixture kind and a validated
fixture ID, constructs a versioned payload internally, makes at most one fixed
request with zero retries and a 30-second timeout, and emits bounded metadata.

It rejects caller payloads, URLs, methods, headers, environment overrides,
duplicates, replay, overwrite, raw responses, credential output, and file
contents. Destination evidence is limited to fixture metadata under the four
registered roots. Workbench CWFM-18 remains the final generic authority.
