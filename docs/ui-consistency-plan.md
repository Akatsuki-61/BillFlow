# Desktop UI consistency plan

Audited all nine routes in the running macOS Electron app on 4 October 2026, including the shared shell and page controls. The working tree was clean before changes.

## Direction and shared rules

Retain BillFlow's warm canvas, white sidebar, purple accent, and Newsreader page titles. Make working controls and numerical summaries predictable rather than redesigning the app's identity.

- Layout: shared page wrapper, 32 px desktop inset (24 px at smaller widths), 24 px section spacing, 1280 px maximum content width. Settings form body and cards expand horizontally to fill available window width.
- Type: 34 px page titles, 14 px descriptions, 13 px controls, 32 px sans-serif tabular metric values. Use one serif face for titles rather than mixing it with monospace money values.
- Controls: 40 px standard buttons/fields, 32 px compact and icon buttons; 10 px corners. Purple primary actions; white secondary actions; quiet text actions; explicit danger treatment.
- Segments: one 40 px group with 32 px options, white selected surface, consistent selected semantics and keyboard focus.
- Surfaces: 16 px corners, white fill, one light border and small shadow. Metrics share padding and a minimum height that can grow for long/mixed-currency values.
- Motion: controls remain stationary on hover; focus, selection, color, and shadow provide feedback. Respect reduced motion.
- Desktop: retain the 40 px native title-bar drag strip; sidebar and title-bar divider share a width token. Scroll only the workspace and keep dialogs within available height.

## Page changes

| Page | Finding | Implementation |
| --- | --- | --- |
| Dashboard | Wrapped header controls, lavender metrics, serif values, inaccessible tile switches | Shared header/actions, metric cards, segments and switches; stationary controls |
| Invoices | White header action vs black empty action, monospace overdue value, oversized table corners | Shared primary buttons, metrics, filters and empty state |
| Clients | Different add button treatments, grey filled cards, oversized blank panel | Shared buttons, card surfaces, form fields and empty state |
| Catalog | Grey list panel, oversized blank height, inconsistent chips; prototype count says 139 with zero items | White surface, compact empty state, shared metrics and truthful item count |
| Expenses | Oversized clickable div tile, mismatched export button, fake totals and page links in empty ledger | Primary Log Expense header action, shared summary cards, accessible switches and data-derived pagination |
| Outsourcing | Separate palette/insets, small controls, decorative circles and prototype metrics | Shared header, cards, button/form styles and blank-state summaries |
| Tasks | Different metric proportions, tall empty board, controls crowded at smaller desktop widths | Shared summary cards, board/list segments, wrapping filters and shorter board columns |
| Analytics | Separate palette, dark KPI, small controls and headings, prototype values beside empty chart | Shared header, metrics, segments and card surfaces; empty-data indicators |
| Settings | Narrower outer alignment/title, separate segments, heavy card shadows | Shared outer header, full-width responsive form tiles, shared fields/buttons/segments/surfaces |

## Verification

Run lint, TypeScript, existing tests and production renderer/Electron build. Revisit all nine routes in Electron, exercise segments, switches and creation dialogs, and inspect normal and minimum desktop dimensions. Native Windows chrome cannot be visually verified on this macOS host; preserve the existing overlay configuration.

### Results

- Implemented shared page headers, buttons, fields, segments, metric cards, switches, and empty states across all nine routes. Retained BillFlow's existing visual identity and Electron shell.
- Reviewed the macOS Electron app at approximately 1440 × 900 and the 1100 × 700 minimum. Checked Tasks board/list, Settings sections, creation dialogs, and dashboard switches without creating persistent records.
- Verified keyboard activation of switches, dialog focus on open, forward/backward Tab wrapping, Escape dismissal, and restoration of focus to the opening control. Long forms scroll within their dialog.
- TypeScript, eight existing tests, and the production renderer/Electron build pass. No installer packaging or Windows-native visual check was run.
- Lint remains blocked by six pre-existing `react-hooks/set-state-in-effect` errors in Clients, Invoices, Settings, and DataProvider; compared their rules against HEAD. Existing warnings remain. The shared UI components introduce no lint errors or warnings.
- Replaced hardcoded demonstration totals/counts with empty-data or session-derived indicators. This UI pass does not add persistence to the existing session-only modules.
