# Style architecture

`src/styles.css` is the ordered stylesheet manifest. Keep its imports in the
current order unless a cascade change is intentional and visually verified.

## Directories

- `design-system/` contains shared compatibility, tables, global refinements,
  and application themes.
- `modules/` contains styles owned by individual application modules.
- `legacy-base.css` contains the original shared foundation and early rules
  that still serve more than one module. New module-specific rules must not be
  added there.

## Rules for new styles

1. Put reusable controls in `src/design-system/components.css`.
2. Put module-only rules in the matching file under `modules/`.
3. Prefer design tokens over hard-coded colors and dimensions.
4. Avoid `!important`; use a module root class to scope selectors.
5. Do not append another global override layer to the end of the manifest.

The split was performed without reordering rules, so the generated CSS remains
equivalent to the pre-split stylesheet.
