# @fume/ui content: API

Every component accepts `className` (merged with `cx`) and passes the rest of its props to its root element. "HTML" means the root element's own attributes. Props marked `?` are optional; defaults are in brackets. Words follow the design system's rules: "creative", never "file"; "In check", "Checked by Anna".

## Card (card.tsx, card.css)
- `Card` (forwardRef div.ui-card): HTML + `size?: "default" | "lg"`, `behind?: boolean` (the card behind a card), `interactive?: boolean`, `selected?: boolean` (data-state checked/unchecked), `disabled?: boolean` (aria-disabled), `asChild?: boolean`.
- `CardHeader` (div): HTML.
- `CardTitle`: HTML + `as?: CardHeadingTag` ["h3"].
- `CardHeadingTag`: type `"h1" … "h6" | "p" | "div"`.
- `CardDescription` (p): HTML.
- `CardAction` (div): HTML.
- `CardContent` (div): HTML.
- `CardFooter` (div): HTML.
- `CardFooterEnd` (div): HTML.
- `CardMeta` (span): HTML.
- `CardTime` (time): HTML + `dateTime?: string`.
- `CardMedia` (div): HTML.
- `CardProps`, `CardTitleProps`: the props types.

## Item (item.tsx, item.css)
- `ItemGroup`: HTML + `as?: "div" | "ul" | "ol"` ["div"].
- `ItemGroupLabel` (div): HTML + `count?: ReactNode`.
- `ItemSeparator` (div, aria-hidden): HTML.
- `Item` (forwardRef HTMLElement): HTML + `variant?: "default" | "muted" | "outline"`, `size?: "default" | "sm"`, `as?: "div" | "li" | "a" | "button"`, `href?`, `target?`, `rel?`, `type?: "button" | "submit" | "reset"`, `disabled?: boolean`, `asChild?: boolean`.
- `ItemMedia` (span): HTML + `variant?: "default" | "icon" | "image" | "creative"`.
- `ItemMediaImage` (img): img HTML.
- `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions` (span): HTML.
- `ItemTime` (time): HTML + `dateTime?: string`.
- `ItemHeader`, `ItemFooter` (div): HTML.
- `ItemGroupProps`, `ItemGroupLabelProps`, `ItemProps`, `ItemMediaProps`: the props types.

## Alert (alert.tsx, alert.css)
- `Alert` (div.ui-alert): HTML + `variant?: AlertVariant` ["default"], `icon?: IconName | false` (the default icon follows the variant), `glass?: boolean`, `onSurface?: boolean`, `onDismiss?: () => void` (adds the x), `dismissLabel?: string` ["Dismiss"]. The role is "alert" for error and "status" otherwise, unless you pass one.
- `AlertVariant`: type `"default" | "info" | "success" | "warning" | "error"`.
- `AlertTitle`, `AlertDescription`, `AlertAction` (div): HTML.
- `AlertProps`: the props type.

## Empty (empty.tsx, empty.css)
- `Empty` (div.ui-empty): HTML + `surface?: boolean`, `size?: "default" | "sm"`.
- `EmptyHeader` (div): HTML.
- `EmptyMedia` (div): HTML + `variant?: "default" | "icon"` ["icon"], `icon?: IconName`, `waiting?: boolean`.
- `EmptyTitle`: HTML + `as?: "h1" … "h6" | "p"` ["h3"].
- `EmptyDescription` (p): HTML.
- `EmptyContent` (div): HTML.
- `EmptyProps`, `EmptyMediaProps`, `EmptyTitleProps`: the props types.

## Data list (data-list.tsx, data-list.css)
- `DataList` (dl): HTML + `variant?: "default" | "stacked" | "grid"`.
- `DataListItem` (div > dt + dd): HTML + `label: ReactNode`, `children?: ReactNode` (the value).
- `DataListData` (span): HTML. Data in the data face.
- `DataListNote` (span): HTML.
- `DataListProps`, `DataListItemProps`: the props types.

## Accordion and collapsible (accordion.tsx, accordion.css, collapsible)
- `Accordion` (forwardRef div): HTML + `type?: "single" | "multiple"` ["single"], `value?: string[]`, `defaultValue?: string[]` [[]], `onValueChange?: (value: string[]) => void`, `collapsible?: boolean` [true], `flush?: boolean`. Arrows, Home and End move between triggers.
- `AccordionItem` (div): HTML + `value: string`, `disabled?: boolean`.
- `AccordionTrigger` (forwardRef button inside an h3): button HTML + `meta?: ReactNode`, `headingLevel?: 2 | 3 | 4 | 5 | 6` [3].
- `AccordionContent` (div, role region): HTML.
- `Collapsible` (div): HTML + `open?: boolean`, `defaultOpen?: boolean` [false], `onOpenChange?: (open: boolean) => void`.
- `CollapsibleTrigger` (forwardRef button, a quiet small pill by default): button HTML + `chevron?: boolean` [true].
- `CollapsibleContent` (div): HTML.
- `AccordionProps`, `AccordionItemProps`, `AccordionTriggerProps`, `CollapsibleProps`, `CollapsibleTriggerProps`: the props types.

## Scroll area (scroll-area.tsx, scroll-area.css)
- `ScrollArea` (forwardRef div): HTML + `orientation?: "vertical" | "horizontal" | "both"` ["vertical"], `viewportLabel?: string` (makes the viewport a focusable region), `viewportProps?: HTMLAttributes<HTMLDivElement>`.
- `ScrollAreaProps`: the props type.

## Creative (creative.tsx, creative.css, aspect-ratio)
- `CreativeFormat`: type `"feed" | "story" | "banner"`.
- `AspectRatio` (div): HTML + `format?: CreativeFormat`, `ratio?: number | string` (sets `--ratio`).
- `CheckState`: type `"checked" | "in-check" | "generating" | "changes"`.
- `CheckMark` (span): HTML + `state: CheckState`, `by?: string` (who checked it; without it "Checked"), `time?: string`, `dateTime?: string`, `wording?: "short" | "long"` ["short"; long reads "Checked by Anna"], `label?: ReactNode` (replaces the words).
- `CreativeGrid` (ul): HTML.
- `CreativeMoreButton` (forwardRef button): button HTML. Glass-clear More circle with aria-haspopup="menu".
- `CreativeTile` (forwardRef li or div): HTML (no onSelect) + `as?: "li" | "div"` ["li"], `src?`, `alt?` [""], `media?: ReactNode`, `format?`, `ratio?`, `label: string`, `caption?: ReactNode`, `check?: ReactNode` (a CheckMark), `selected?: boolean` with `onSelectedChange?: (selected: boolean) => void` (selection mode), `href?: string`, `onOpen?: () => void`, `more?: ReactNode` (the menu), `onMore?: (event) => void`, `moreLabel?: string`, `loading?: boolean` (skeleton, aria-busy).
- `CreativeMedia` (div): HTML + `format?`, `ratio?`, `src?`, `alt?` [""].
- `AspectRatioProps`, `CheckMarkProps`, `CreativeTileProps`: the props types.

## Sidebar (sidebar.tsx, sidebar.css)
- `SidebarProvider` (forwardRef div wrapper): HTML + `defaultOpen?: boolean` [true], `open?`, `onOpenChange?`, `openMobile?`, `onOpenMobileChange?`, `shortcut?: boolean` [true; Cmd or Ctrl+B], `storageKey?: string` (round 9, DWAY-21: remembers the rail in localStorage under this key, inside try/catch; the app uses "fume.sidebar"). It finds drawer mode from the CSS, traps focus in the drawer, and closes it on Escape or a link.
- `useSidebar()`: returns `SidebarContextValue` `{ state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar(from?), sidebarId, sidebarRef }`.
- `Sidebar` (forwardRef aside plus its scrim): HTML + `aria-label?` ["Fume"].
- `SidebarLogo` (forwardRef a): HTML + `logo: ReactNode`, `mark?: ReactNode`, `href?` ["/"], `label?` ["Fume, home"], `asChild?: boolean`.
- `SidebarHeader` (div): HTML + `logo?`, `mark?`, `logoHref?`, `logoLabel?`.
- `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel` (div): HTML.
- `SidebarMenu` (ul): HTML.
- `SidebarMenuItem` (li): HTML.
- `SidebarMark`, `SidebarAvatar` (span): HTML.
- `SidebarMenuButton` (forwardRef button or a): HTML + `asChild?`, `href?`, `isActive?: boolean`, `size?: "default" | "lg"`, `icon?: IconName`, `leading?: ReactNode`, `description?: ReactNode`, `badge?: ReactNode`, `endIcon?: IconName`, `type?`.
- `SidebarInset` (forwardRef main or div): HTML + `as?: "main" | "div"` ["main"].
- `SidebarTrigger` (forwardRef button): button HTML + `aria-label?` ["Show or hide the sidebar"], `tooltip?: false`. Round 9 (DWAY-9): it shows its label in a tooltip with "⌘B" ("Ctrl+B" off a Mac) while the shortcut is on.
- `SidebarContextValue`, `SidebarProviderProps`, `SidebarProps`, `SidebarLogoProps`, `SidebarHeaderProps`, `SidebarMenuButtonProps`, `SidebarInsetProps`, `SidebarTriggerProps`: the types.

## Tab bar (tab-bar.tsx, tab-bar.css) PROPOSED 15 Oct 2026
- `TabBar` (forwardRef nav in div.ui-tab-bar-dock): HTML + `aria-label: string`. A Smoke glass pill fixed at the foot of a phone screen (under 640 px only); children are TabBarItems. The floating action bar and a docked composer rise above it.
- `TabBarItem` (forwardRef a): HTML + `asChild?` (a router Link), `icon: IconName`, `isActive?: boolean` (aria-current="page", the white pill), `count?: number` (the one waiting count; hidden at 0).
- `TabBarProps`, `TabBarItemProps`: the types.

## Back link (back-link.tsx, back-link.css) PROPOSED 15 Oct 2026
- `BackLink` (forwardRef a): HTML + `label: string` (the parent's name, read as "Back to …"), `iconOnly?: boolean`. A rounded square with the arrow and the parent's name small beside it; pass it to `PageHeader` as `back`. It replaced the breadcrumb in the app (Marcus 15 Oct). Give it `href` (the parent) and decide in `onClick` whether to go back in history.
- `BackLinkProps`: the type.

## Breadcrumb (breadcrumb.tsx, breadcrumb.css)
- `Breadcrumb` (nav): HTML + `aria-label?` ["Breadcrumb"].
- `BreadcrumbList` (ol): HTML.
- `BreadcrumbItem` (li): HTML + `fold?: boolean` (hidden when the path folds).
- `BreadcrumbLink` (forwardRef a): HTML + `asChild?: boolean`.
- `BreadcrumbPage` (span, aria-current page): HTML.
- `BreadcrumbSeparator` (li): HTML + `fold?: boolean`, `folded?: boolean` (shown only when folded).
- `BreadcrumbEllipsis` (li): HTML + `children: ReactNode` (menu rows), `label?` ["Show the whole path"].
- `BreadcrumbMenuLink` (forwardRef a.ui-menu-item): HTML + `icon?: IconName`, `asChild?`.
- `BreadcrumbPath` (whole path that folds on a phone): nav HTML + `items: BreadcrumbPathItem[]`, `renderLink?: ({ href, className, role?, children }) => ReactNode`, `foldLabel?`.
- `BreadcrumbPathItem`: `{ label: string; href?: string; icon?: IconName }`.
- `BreadcrumbItemProps`, `BreadcrumbLinkProps`, `BreadcrumbSeparatorProps`, `BreadcrumbEllipsisProps`, `BreadcrumbMenuLinkProps`, `BreadcrumbPathProps`: the props types.

## Page header (page-header.tsx, page-header.css)
- `PageHeader` (forwardRef header): HTML (no title) + `title: ReactNode`, `titleAs?: "h1" | "h2"` ["h1"], `back?: ReactNode` (a BackLink above the title), `breadcrumb?: ReactNode` (deprecated in the app), `description?: ReactNode`, `meta?: ReactNode[]`, `secondaryActions?: PageHeaderAction[]` (fold into More on a phone), `primaryAction?: PageHeaderPrimaryAction`, `menu?: ReactNode` (more rows for More), `moreLabel?` [`More for ${title}`], `actions?: ReactNode`, `tabs?: ReactNode`.
- Round 9 (DLAY-13, DLAY-16; PROPOSED 19 Oct 2026): `actions` and the primary action sit at the end of the title's line. On a desk inside the app's shell the app bar carries the way back, so the header's `back` row is not shown there ([data-bar-back] on the inset); keep passing `back` (a phone and a page outside the shell show it).
- `PageFooter` (forwardRef div, round 9, DLAY-13): the sticky step footer at the foot of the content column: `start?: ReactNode` (a line on the left: "Step 2 of 4", "3 left"), `children` (the actions, right-aligned, the one Ink action last). It sticks to the bottom of the scroller with the page's ground behind it and a soft edge above, marks itself `[data-ui-foot]` (toasts rise above it), and on a phone stacks its buttons full width, main action last. Put it last inside `Page`.
  ```tsx
  <PageFooter start="Step 2 of 4"><Button variant="secondary">Back</Button><Button type="submit">Next: Products</Button></PageFooter>
  ```
- `PageHeaderAction`: `{ label: string; icon?: IconName; onSelect?: () => void; disabled?: boolean }`.
- `PageHeaderPrimaryAction`: PageHeaderAction + `busy?: boolean`.
- `PageHeaderMenuItem` (forwardRef button.ui-menu-item, role menuitem): button HTML + `icon?: IconName`, `danger?: boolean`. It works in any glass menu this family renders.
- `PageHeaderMenuSeparator` (div.ui-menu-sep): HTML.
- `PageHeaderProps`, `PageHeaderMenuItemProps`: the props types.

## Pagination (pagination.tsx, pagination.css)
- `Pagination` (whole control): nav HTML (no onChange) + `page: number` (from 1), `pageCount: number`, `onPageChange?: (page) => void`, `hrefFor?: (page) => string`, `previousLabel?` ["Previous"], `nextLabel?` ["Next"], `summary?: (page, pageCount) => ReactNode` [Page **p** of n].
- `PaginationRoot` (nav): HTML + `aria-label?` ["Pages"].
- `PaginationContent` (ul): HTML.
- `PaginationLink` (forwardRef a): HTML + `isActive?`, `disabled?`, `kind?: "page" | "previous" | "next"`.
- `PaginationEllipsis` (span): HTML.
- `paginationRange(page, pageCount)`: returns `Array<number | "gap">`.
- `PaginationLinkProps`, `PaginationProps`: the props types.

## Table (table.tsx, table.css; data-table behaviour from table.js)
- `TableContainer` (forwardRef div), `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableCaption`: HTML.
- `TableRow` (tr): HTML + `selected?: boolean` (data-state selected, aria-selected).
- `TableHead` (th): HTML + `sort?: SortDirection`, `onSort?: () => void` (makes it a sort button with aria-sort), `num?`, `select?`, `actions?`, `hideStacked?`.
- `TableCell` (td): HTML + `data?`, `num?`, `select?`, `actions?`, `media?`, `trail?`, `hideStacked?`, `muted?`.
- `TableCreativeThumb` (img): img HTML.
- `TableTitle` (span): HTML + `sub?: ReactNode`.
- `TableStatus` (span): HTML + `status: TableStatusKind`. Default words: "Checked", "In check", "Generated".
- `TableCheckbox` (forwardRef button.ui-checkbox): button HTML + `checked: boolean | "indeterminate"`, `onCheckedChange?: (checked, event) => void`, `aria-label: string` (required).
- `useTableSort<K>(initial?: { key, direction? })`: returns `TableSort<K>` `{ key, direction, directionOf(key), sortBy(key), sorted(rows, value) }`.
- `useTableSelection<Id>(ids, initial?)`: returns `TableSelection<Id>` `{ selected, count, isSelected(id), toggle(id, checked, event?), allState, toggleAll(checked), clear(), set(ids) }`. Shift selects a range.
- `SortDirection`: type `"ascending" | "descending" | "none"`.
- `TableStatusKind`: type `"approved" | "waiting" | "draft"`.
- `TableRowProps`, `TableHeadProps`, `TableCellProps`, `TableTitleProps`, `TableStatusProps`, `TableCheckboxProps`, `TableSort`, `TableSelection`: the types.

## Stat (stat.tsx, stat.css)
- `StatGrid` (div.ui-stat-grid): HTML.
- `Stat` (forwardRef div.ui-card.ui-stat): HTML + `label: ReactNode`, `value?: ReactNode | StatValuePart[]`, `delta?: ReactNode`, `trend?: "up" | "down"`, `approved?: boolean` (the Amber triangle and an Amber sparkline), `spark?: StatSpark`, `state?: "loading" | "empty" | "error"`, `emptyDescription?`, `emptyLabel?: string`, `errorMessage?` ["This number didn’t load."], `onRetry?`, `retryLabel?` ["Try again"].
- `StatDeltaNum` (span): HTML. The figure inside the comparison.
- `StatValuePart`: `{ num: ReactNode; unit?: ReactNode }`.
- `StatSpark`: `{ title: string; summary?; data: number[] | ChartDatum[]; color?; unit?; format?: "minutes"; min? }`.
- `StatProps`: the props type.

## Chart (chart.tsx, chart.css; a port of chart.js)
- `Chart` (forwardRef div.ui-chart): HTML (no title) + `type: ChartType`, `title: string`, `description?`, `summary?`, `config: ChartConfig`, `data: ChartDatum[] | number[]`, `xKey?`, `xFormat?: "week" | "date"`, `xLabel?`, `valueLabel?`, `point?`, `unit?`, `format?: "minutes"`, `max?`, `min?`, `endLabels?` [true], `legend?: boolean`, `toolbar?: ReactNode`, `stack?` [false], `orientation?: "auto" | "vertical" | "horizontal"` ["auto"], `track?` [false], `nameKey?` ["name"], `dataKey?` ["value"], `centerLabel?` ["in all"], `fill?: boolean`, `state?: "loading" | "empty" | "error"`, `emptyTitle?` ["No creatives yet."], `emptyDescription?` ["Your first brief starts the chart."], `emptyAction?` with `onEmptyAction?`, `errorTitle?` ["The chart didn’t load."], `errorDescription?` ["Fume couldn’t reach the numbers just now."], `retryLabel?` ["Try again"], `onRetry?`, `active?: number`, `onActiveChange?: (index) => void`, `onSeriesToggle?: (key, on) => void`, `motion?: "reduce"`.
- `ChartTrend` (p): HTML + `trend?: "up" | "down"`.
- `ChartTrendNote` (span): HTML.
- `ChartType`: type `"area" | "line" | "bar" | "donut" | "spark"`.
- `ChartSeries`: `{ label: string; color?: string; approved?: boolean }`.
- `ChartConfig`: type `Record<string, ChartSeries>`.
- `ChartDatum`: type `Record<string, string | number>`.
- `ChartProps`, `ChartTrendProps`: the props types.

## Filter bar (filter-bar.tsx, filter-bar.css; controlled)
- `FilterBar` (div.ui-filter-bar): HTML (no onChange) + `query: string`, `onQueryChange: (q) => void`, `searchPlaceholder?` ["Search creatives"], `filters?: FilterDef[]`, `value: FilterValue`, `onValueChange: (v) => void`, `sort?: string`, `sortOptions?: SortOption[]`, `onSortChange?: (s) => void`, `sortLabel?` ["Sort"], `sortSlot?: ReactNode`, `shown: number`, `total: number`, `noun?: [string, string]` [["creative", "creatives"]], `onOpenSheet?: () => void`, `sheetLabel?` ["Filters"], `clearLabel?` ["Clear all"], `slashKey?` [true].
- `FilterSheetOptions` (div.ui-drawer-body for the phone's Drawer): HTML + `filters`, `value`, `onValueChange`, `sort?`, `sortOptions?`, `onSortChange?`, `sortLabel?` ["Sort"].
- `filterCount(shown, total, filtering, noun?)`: returns "3 of 8 creatives" or "8 creatives".
- `filterShowLabel(shown, noun?)`: returns "Show 3 creatives" or "Nothing to show".
- `FilterOption`: `{ value: string; label: string; icon?: IconName; meta?: string }`.
- `FilterDef`: `{ key: string; label: string; options: FilterOption[]; alignEnd?: boolean }`.
- `SortOption`: `{ value: string; label: string }`.
- `FilterValue`: type `Record<string, string[]>`.
- `FilterBarProps`, `FilterSheetOptionsProps`: the props types.

## Toolbar and action bar (toolbar.tsx, toolbar.css)
- `Toolbar` (forwardRef div, role toolbar, one tab stop): HTML + `aria-label: string` (required), `orientation?: "horizontal" | "vertical"`, `bare?: boolean`.
- `ToolbarGroup` (div, role group): HTML + `wide?: boolean` (hidden under 600 px), `toggle?: "single" | "multiple"` (.ui-toggle-group).
- `ToolbarSeparator` (div, role separator): HTML.
- `ToolbarButton` (forwardRef quiet icon button): button HTML + `icon: IconName`, `aria-label: string` (required).
- `ToolbarToggle` (forwardRef button.ui-toggle): button HTML (no onChange) + `icon?`, `pressed: boolean`, `onPressedChange?`, `radio?: boolean` (role radio with aria-checked).
- `ToolbarNumber` (output.ui-toolbar-num): output HTML.
- `ActionBar` (forwardRef div.ui-glass.ui-glass--bar.ui-action-bar in its dock): HTML + `open: boolean`, `count?: number`, `label?: ReactNode` [" selected" with a count], `optionalLabel?: boolean`, `onClear?: () => void` (the x and Escape), `clearLabel?` ["Clear the selection"], `dock?: "fixed" | "contained" | "none"` ["fixed"], `actions?: ActionBarItem[]`, `children?: ReactNode`, `moreLabel?` ["More for the selection"], `onFocusLost?: () => void`.
- `ActionBarItem`: `{ label: string; icon?: IconName; onSelect?; disabled?; variant?: "clear" | "white" | "danger"; fold?: boolean; danger?: boolean }`.
- `ToolbarProps`, `ToolbarGroupProps`, `ToolbarButtonProps`, `ToolbarToggleProps`, `ActionBarProps`: the props types.

## Stepper (stepper.tsx, stepper.css)
- `Stepper` (forwardRef nav.ui-stepper): HTML + `aria-label: string` (required), `steps: StepperStep[]`, `current: number` (from 0), `onStepSelect?: (index) => void` (finished steps become buttons), `orientation?: "horizontal" | "vertical"`, `countLabel?: (step, total) => string` ["Step 2 of 5"], `doneStatus?` ["Done: "], `currentStatus?` ["Current step: "], `backLabel?: (title) => string` ["Brief, done. Go back to it"].
- `StepperStep`: `{ title: string; description?: ReactNode; busy?: boolean; content?: ReactNode }`.
- `StepperProps`: the props type.

## Settings (settings.tsx, settings.css)
- `SettingsLayout` (div.ui-settings): HTML (no defaultValue) + `header?: ReactNode` (a PageHeader), `sections: SettingsSectionDef[]`, `value?`, `defaultValue?`, `onValueChange?: (id) => void`, `navLabel?` ["Settings"], `view?: "list" | "page"`, `onViewChange?`.
- `SettingsPage` (the page head, then children): div HTML (no title) + `title: ReactNode`, `description?`, `backLabel?` ["Settings"].
- `SettingsForm` (form.ui-settings-form with the save bar): form HTML + `dirty: boolean`, `saving?: boolean`, `onDiscard: () => void`, `onSubmit: (event) => void` (the default is prevented), `unsavedLabel?` ["Unsaved changes"], `discardLabel?` ["Discard"], `saveLabel?` ["Save changes"].
- `SettingsSection` (section.ui-settings-section): HTML (no title) + `title: ReactNode`, `description?`.
- `SettingsSectionDef`: `{ id: string; label: string; icon?: IconName; hint?: ReactNode; description?: ReactNode; content: ReactNode }`.
- `SettingsLayoutProps`, `SettingsPageProps`, `SettingsFormProps`, `SettingsSectionProps`: the props types.
