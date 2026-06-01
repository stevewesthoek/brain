# ProChat OS Licensing Strategy

**Status:** legal/productization support document, legal review required before public launch  
**Owner:** Steve Westhoek  
**Product:** ProChat OS  
**Strategy source:** from the `brain` repo root, `../mind/wiki/organisations/prochat/brand/prochat-os-strategy.md`

This is an execution-facing licensing document. It must support the canonical ProChat OS strategy in `mind`; it must not redefine product strategy, category, positioning, or business direction.

## Objective

Allow people to inspect, use, modify, and fork ProChat OS for free in non-commercial contexts, while requiring a paid commercial license for commercial use, resale, managed hosting, SaaS use, internal business use, paid client work, or redistribution inside commercial products.

## Important terminology

This is not an open-source strategy in the OSI-approved sense.

A license that blocks commercial use is source-available, not open source. That is acceptable for ProChat OS, but public language should be precise:

```text
Use: source-available
Avoid: open source
```

## Recommended model

Use a dual-license model:

1. **Community license:** PolyForm Noncommercial 1.0.0 for public software code.
2. **Commercial license:** private paid ProChat Commercial License for any commercial use.
3. **Docs/assets license:** a non-commercial content license or custom documentation license.
4. **Trademark policy:** separate trademark rules for the ProChat and ProChat OS names.

## Why PolyForm Noncommercial

PolyForm Noncommercial is designed for software where source is visible and non-commercial use is allowed, while commercial use requires a separate license.

It fits the stated product goal better than MIT, Apache-2.0, GPL, AGPL, or Creative Commons:

| License | Fit | Reason |
|---|---|---|
| MIT | Bad fit | Allows commercial use, resale, SaaS hosting, and proprietary forks. |
| Apache-2.0 | Bad fit | Allows commercial use; useful patent language, but too permissive for this goal. |
| GPL/AGPL | Partial fit | Allows commercial use; copyleft does not stop paid competitors. |
| Creative Commons NC | Bad fit for software | Creative Commons does not recommend CC licenses for software. |
| PolyForm Noncommercial | Best off-the-shelf fit | Allows non-commercial use and modifications while reserving commercial use. |
| Custom commercial license only | Possible | Strong control, but slower and more expensive to draft well. |

## Recommended public license language

Use this high-level wording in the public README:

```text
ProChat OS is source-available.

You may use, study, modify, and fork ProChat OS for non-commercial purposes under the PolyForm Noncommercial License 1.0.0.

Commercial use requires a separate ProChat Commercial License.

Commercial use includes selling access, offering managed hosting, using ProChat OS in paid client work, embedding it in a commercial product, using it internally for business operations, or operating it as part of a paid service.
```

## Commercial license triggers

Require a paid commercial license when a person or company wants to:

- sell ProChat OS or a derivative
- host ProChat OS for customers
- offer managed ProChat OS instances
- use ProChat OS in paid consulting or agency work
- use ProChat OS to operate a commercial SaaS or agency workflow
- embed ProChat OS in another commercial product
- distribute ProChat OS as part of a paid package
- use the ProChat or ProChat OS trademarks commercially

## Free permitted uses

Permit free non-commercial use for:

- personal learning
- hobby projects
- private experimentation
- academic research where no commercial service is sold
- non-profit/internal experimentation where the output is not sold
- forks that remain non-commercial and preserve notices

## Public repo recommendation

Do not publish the private `brain` or `mind` repos directly.

Create a sanitized public repo:

```text
prochat-os/
  LICENSE.md                 PolyForm Noncommercial 1.0.0 or lawyer-reviewed equivalent
  COMMERCIAL-LICENSE.md      summary and contact instructions, not the private contract
  TRADEMARKS.md              ProChat OS trademark use policy
  README.md                  source-available positioning
  NOTICE.md                  third-party notices
  core/
  cli/
  api/
  adapters/
  docs/
  examples/
```

## Root package recommendation

For public npm packages, use:

```json
{
  "license": "SEE LICENSE IN LICENSE.md"
}
```

Avoid leaving `MIT` in package metadata if commercial use is meant to be restricted.

## Trademark recommendation

Copyright license and trademark permission should stay separate.

Even if someone can fork the code for non-commercial use, they should not be allowed to call their fork `ProChat OS`, use the ProChat logo, or imply endorsement.

Add a trademark policy before public release.

## Fast selling path

The fastest viable commercial path is:

1. Keep private repos private.
2. Extract a sanitized source-available public repo.
3. Add PolyForm Noncommercial for code.
4. Add a clear commercial license contact page.
5. Sell managed single-tenant deployments first.
6. Sell setup/support packages second.
7. Build full multi-tenant SaaS after the security boundary is proven.

## Legal review checklist

Before launch, ask a software/IP lawyer to review:

- whether PolyForm Noncommercial fully matches the desired restrictions
- commercial-use definition clarity
- whether internal business use should count as commercial use
- trademark clearance for ProChat OS
- public Terms of Service for managed hosting
- privacy/data processing terms for hosted customer systems
- dependency notices and third-party attribution
