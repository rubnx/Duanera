const controlFocusRing =
  "focus-visible:border-ds-focus-ring focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20 focus-visible:outline-none"

const controlDisabled =
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"

const iconChildStyles =
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export { controlDisabled, controlFocusRing, iconChildStyles }
