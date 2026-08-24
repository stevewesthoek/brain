# MRU0-P3.47 Benchmark Comparison

## Results

| Measure | P3.46 baseline | P3.47 bounded structured fixture |
|---|---:|---:|
| Expected capture recall | 70.8% (17/24) | 100% (6/6) |
| Precision | 85.0% | 100% (6/6) |
| Restricted-item safety | 100% excluded | 100% excluded (1/1) |
| Noise handling | 3 unnecessary items | 100% excluded (1/1) |
| Raw transcript ingestion | rejected | rejected |

The P3.47 result is intentionally labeled as a structured-signal fixture. It is not evidence that raw conversation extraction has reached 100% recall. The comparison demonstrates that explicit secondary signals and privacy classes are normalized correctly while preserving the existing safety boundary.

## Remaining gap

The original P3.46 sample remains the relevant autonomous-extraction baseline. A separately labeled, privacy-safe benchmark with real upstream extraction is still required before controlled discovery can be considered.
