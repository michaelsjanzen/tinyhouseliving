/**
 * Theme architecture types.
 *
 * The runtime contract for a fully registered theme is ThemeModuleSet
 * in src/lib/theme-modules.ts. These types cover the design-configuration
 * layer that themes declare in their design.ts files.
 */

/**
 * A single layout preset a theme's header supports.
 * The admin reads this array and renders one tile per entry.
 * The theme's Header component switches on the saved headerLayout value.
 */
export interface HeaderLayoutDef {
  id: string;
  label: string;
  description?: string;
}

/**
 * Which modifiers the theme's header implementation supports.
 * The admin hides unsupported controls so the UI stays honest.
 */
export interface HeaderModifiers {
  /** Header can be pinned to the top on scroll. */
  supportsSticky: boolean;
  /** Background treatment options the header supports. */
  supportsBackgroundStyles: ("solid" | "glass" | "transparent-on-hero")[];
  /** Compact (reduced padding) height variant. */
  supportsCompactHeight: boolean;
  /** Logo image upload in addition to text site name. */
  supportsLogo: boolean;
}

/**
 * A single footer layout preset a theme supports.
 * The admin reads this array and renders one tile per entry.
 * The theme's Footer component switches on the saved footerLayout value.
 */
export interface FooterLayoutDef {
  id: string;
  label: string;
  description?: string;
}
