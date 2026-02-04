# Web Design Component Map (shadcn/ui + Tailwind)

Use this to translate section requirements into concrete components.

## Global layout
- App shell: sidebar + topbar (Sheet, NavigationMenu, DropdownMenu, Avatar)
- Grid: 12-col desktop, 6-col tablet, 4-col mobile
- Containers: max-w-6xl or max-w-7xl; consistent section padding

## Landing / marketing sections
- Navbar: NavigationMenu + Button + Sheet (mobile)
- Hero: Card + Button + Badge + Input (optional)
- Trust / logos: Badge + Separator
- Feature grid: Card + Icon + Badge
- Social proof: Card + Avatar + Quote
- Pricing: Tabs + Card + Badge + Button
- FAQ: Accordion
- CTA: Card + Button
- Footer: Separator + Link list

## Funnel pages
- Step headers: Badge + Progress
- Form sections: Input, Select, Checkbox, Switch, Textarea
- Proof blocks: Card + Avatar
- Inline upsells: Alert + Badge
- Final CTA: Button (primary), Button (secondary)

## SaaS dashboards
- KPI row: Card + Badge + Progress
- Charts: Table (fallback), custom chart component slot
- Filters: Select + DropdownMenu + Date picker (if available)
- Activity feed: List + Avatar + Tooltip
- Empty states: Card + Button + muted copy

## UI patterns
- Modals: Dialog
- Notifications: Toast
- Actions: DropdownMenu + Button group
- Help: Tooltip + Popover
- Tables: Table + Pagination

## Motion guidance
- Staggered reveal on section entrance
- Subtle hover raise on cards
- Marquee or infinite scroll for testimonials when asked
- Always add reduced-motion fallback
