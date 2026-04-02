# Says The Bible Production

Production assets for episode creation and audio generation.

## Structure

- `episodes/` — produced episode scripts
- `script-generator/` — generator system, templates, pause rules, and generated SSML

## Rule

Keep tooling and produced scripts here, separate from strategy and operating docs.
Version scripts, SSML, and intentional reusable production source assets here.
Do not version rendered media and campaign output folders under `output/`; they are large, regenerable pipeline artifacts.
