# Design System — Mila Ventures Weekly Update Tracker

## Product Context
- **What this is:** Internal weekly update tracker for a VC team
- **Who it's for:** 5-15 team members (investors, analysts, operations)
- **Space/industry:** Venture capital / internal ops
- **Project type:** Internal web app (dashboard + forms + search)

## Aesthetic Direction
- **Direction:** Warm Minimal — modern and precise, but friendly
- **Decoration level:** Intentional — subtle card borders, soft shadows, no decorative elements
- **Mood:** Clean, calm, human. Like a well-organized team space, not a sprint board.
- **Reference sites:** Linear (precision), Notion (readability), Stripe (typography quality)

## Typography
- **Display/Hero:** Satoshi — bold geometric sans, modern, more character than system fonts
- **Body/UI:** General Sans — clean, reads fast, modern geometric
- **Data/Tables:** General Sans with font-variant-numeric: tabular-nums
- **Code:** JetBrains Mono
- **Loading:** Google Fonts or Fontshare CDN
- **Scale:** 13px small, 14px body, 16px large, 20px h3, 24px h2, 32px h1, 40px hero

## Color
- **Approach:** Restrained — one accent + warm neutrals
- **Primary accent:** #2563EB (blue-600, confident, trustworthy)
- **Accent light:** #DBEAFE (blue-100, hover states, avatar backgrounds)
- **Background:** #FAFAF9 (warm off-white)
- **Surface/Cards:** #FFFFFF
- **Primary text:** #1C1917 (warm black)
- **Muted text:** #78716C (warm gray)
- **Border:** #E7E5E4 (warm gray border)
- **Semantic:** success #16A34A, warning #D97706, error #DC2626, info #2563EB
- **Dark mode:** Invert surfaces (#1C1917 bg, #292524 cards), reduce accent saturation 10%

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — internal tools should breathe
- **Scale:** 2(2px) 4(4px) 8(8px) 12(12px) 16(16px) 24(24px) 32(32px) 48(48px) 64(64px)

## Layout
- **Approach:** Grid-disciplined
- **Grid:** Single-column content, two-column where functional (form + sidebar)
- **Max content width:** 1200px
- **Border radius:** sm:6px, md:8px, lg:12px, full:9999px
- **Card dashboard:** 2-column grid on desktop, 1-column on mobile

## Motion
- **Approach:** Minimal-functional
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(100ms) short(150ms) medium(200ms)
- **Usage:** State changes (expand/collapse), toast entrance (slide-up 200ms), button hover. No page transitions.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-06 | Created initial design system | /design-consultation with competitive research |
| 2026-04-06 | Satoshi + General Sans over Instrument Serif | User wanted serious, modern feel. Serif felt too editorial. |
| 2026-04-06 | Kept warm neutrals with geometric fonts | Intentional contrast — modern precision + friendly warmth. Prevents clinical feel. |
