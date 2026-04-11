# Google Ad Grants Compliance Model

## Current operating assumptions

This repo currently assumes:
- the account is a Google Ad Grants nonprofit account
- the monthly in-kind budget target is `$10,000 USD`
- the program is operated through `steve@yeshua.academy`
- the ad-serving account is `592-920-2435`
- the current upstream Google-managed manager is `715-717-3541`
- the automation system should prioritize compliance and mission fit over aggressive expansion

## Documentation-awareness policy

Because Google can change Ad Grants guidance, this system treats official documentation as a monitored input.

Official sources are tracked in:

```text
config/google-ads/sources.toml
```

This includes:
- Ad Grants program pages
- Google Ads API onboarding docs
- developer token guidance
- OAuth/cloud project setup guidance

The `policy-watch` command:
- fetches those sources
- stores hashes and metadata in SQLite
- flags changes in markdown reports

When a source changes materially:
1. review the updated official page manually
2. update this file if the operating assumptions changed
3. update `config/google-ads/goals.toml` or `config/google-ads/rules.toml` if policy requires it
4. note any stable workflow decision in `operations/decision-log.md`

## Current repo policy

- treat unsupported or unclear features as manual-review items
- do not automate broad strategic changes without explicit approval
- do not enable commercial-paid assumptions in this stack unless scope expands deliberately
- keep official-source monitoring active even before the live Ads API connection is complete
