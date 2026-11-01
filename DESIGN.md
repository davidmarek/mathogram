---
name: Mathixel
description: A picture-park visual system for arithmetic discovery.
colors:
  park-green: '#315c24'
  park-green-dark: '#a8d6b4'
  sun-yellow: '#f5e211'
  sun-yellow-dark: '#ead258'
  ink: '#2c2e2a'
  ink-dark: '#e8eee9'
  muted-ink: '#565b4c'
  muted-ink-dark: '#b7c3be'
  paper-cream: '#f5f1e4'
  paper-cream-dark: '#1c2528'
  warm-surface: '#fffdf5'
  warm-surface-dark: '#283337'
  secondary-surface: '#f5f1e4'
  secondary-surface-dark: '#344245'
  island-green: '#8ed462'
  island-green-dark: '#405e34'
  picture-mint: '#e0efc9'
  pill-green: '#e0efc9'
  pill-green-dark: '#344245'
  pond-blue: '#cfe8f4'
  pond-blue-dark: '#304957'
  coral: '#ffd6c9'
  coral-dark: '#5c4036'
  border: '#c7c9b7'
  border-dark: '#465457'
  danger: '#984733'
  danger-dark: '#ffb09b'
  button-ink: '#fffdf5'
  button-ink-dark: '#17271e'
typography:
  display:
    fontFamily: 'Trebuchet MS, Segoe UI, system-ui, sans-serif'
    fontSize: 'clamp(2.4rem, 5vw, 4.4rem)'
    fontWeight: 850
    lineHeight: 1.02
    letterSpacing: '-0.04em'
  body:
    fontFamily: 'Trebuchet MS, Segoe UI, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.65
  title:
    fontFamily: 'Trebuchet MS, Segoe UI, system-ui, sans-serif'
    fontSize: '1.4rem'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '-0.025em'
rounded:
  logo: '10px'
  pill: '50px'
  picture-card: '20px'
  keypad-key: '20px 16px 20px 16px'
  answer-field: '15px'
components:
  button-primary:
    backgroundColor: '{colors.park-green}'
    textColor: '{colors.button-ink}'
    rounded: '{rounded.pill}'
    padding: '13px 22px'
  button-secondary:
    backgroundColor: '{colors.secondary-surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.pill}'
    padding: '13px 22px'
  collection-action:
    backgroundColor: '{colors.park-green}'
    textColor: '{colors.button-ink}'
    rounded: '{rounded.pill}'
    padding: '8px 9px 8px 23px'
    height: '52px'
  picture-card:
    backgroundColor: '{colors.warm-surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.picture-card}'
    padding: '0'
  answer-field:
    backgroundColor: '{colors.warm-surface}'
    textColor: '{colors.park-green}'
    rounded: '{rounded.answer-field}'
    padding: '3px'
    size: '78px × 66px'
  keypad-key:
    backgroundColor: '{colors.pill-green}'
    textColor: '{colors.ink}'
    rounded: '{rounded.keypad-key}'
    height: '56px'
---

# Design System: Mathixel

## Overview

**Creative North Star: "The Picture Park Guide Map"**

Mathixel's interface is a playful park for discovering original pixel pictures through arithmetic. Pale paper grounds the scenes; contained green islands, green actions, and pixel creatures give the experience its park-map character. Trebuchet MS and system sans-serif keep the lettering direct and readable beside the artwork.

The same visual vocabulary appears in the picture collection, the carried picture and answer staging during play, and the completed-picture screen. Flat color fields and asymmetrical rounded forms organize the interface; the original pixel picture remains the focus rather than decorative chrome.

**Key Characteristics:**

- Pale paper, ink, garden greens, and yellow reserved for discovery marks.
- Original pixel artwork presented on softly colored picture grounds.
- Capsule actions and organic islands alongside evenly rounded picture cards.
- A consistent picture-first thread from collection through solving to completion.

## Colors

The palette pairs garden greens and discovery yellow with warm paper and ink, while sky blue and coral distinguish additional picture and difficulty areas.

### Primary

- **Park Green** (`park-green`): Main links, primary actions, focus indicators, and active progress cues.
- **Sun Yellow** (`sun-yellow`): Completion discovery mark, not routine navigation.

### Secondary

- **Island Green** (`island-green`): Gallery landscape and completion artwork, never the exercise-grid surround.
- **Pond Blue** (`pond-blue`): Standard-difficulty sign.
- **Coral** (`coral`): Advanced-difficulty sign and a group of picture backgrounds.
- **Picture Mint** (`picture-mint`): Default picture ground.
- **Pill Green** (`pill-green`): Keypad keys and soft green pills.

### Neutral

- **Ink** (`ink`): Primary text on light surfaces.
- **Muted Ink** (`muted-ink`): Supporting copy and secondary information.
- **Paper Cream** (`paper-cream`): Page background and secondary-control ground.
- **Warm Surface** (`warm-surface`): Cards and panels.
- **Border** (`border`): Light-theme panel outlines and dividers.
- **Danger** (`danger`): Destructive actions.

The dark theme remaps the principal green, yellow, ink, paper, surface, island, pond, coral, border, and danger roles to the corresponding `*-dark` values in the frontmatter. Picture mint remains a light-theme picture-ground value; dark picture art is softened through a cream mix in the stylesheet.

### Named Rules

**The Garden-Action Rule.** Use garden green for primary actions and active states; reserve yellow for the completion discovery mark. Labels use dark ink on pale fills, never green lettering on yellow.

## Typography

**Display Font:** Trebuchet MS (with Segoe UI and system sans-serif fallbacks)  
**Body Font:** Trebuchet MS (with Segoe UI and system sans-serif fallbacks)

**Character:** Bold, compact headings give the picture park an energetic voice; plain sans-serif body copy keeps instructions and arithmetic support clear.

### Hierarchy

- **Display** (weight 850, `clamp(2.4rem, 4.3vw, 3.6rem)`, line-height 1.02): Gallery welcome heading; it uses the full text column and tightens to `clamp(2rem, 7vw, 3rem)` on phones. Do not constrain translated headings by a narrow character measure.
- **Headline** (weight 850, 2.6rem in the game view): Names the picture being solved; reduced on mobile.
- **Title** (weight 700, 1.4rem, line-height 1.2): Picture-card title, reduced on mobile.
- **Body** (weight 400, 1rem default, paragraph line-height 1.65): Explanatory and supporting copy; selected hero copy is larger.
- **Labels** use bold sans-serif at compact sizes for settings, progress, and picture metadata. The grid-coordinate labels retain a 12px minimum.

### Named Rules

**The Ink-Sans Rule.** Keep interface copy in the shared sans-serif family; let the pixel pictures, not novelty display lettering, carry the playful character.

## Layout

The application shell is centered and capped at 1180px, with safe-area-aware outer padding. The gallery welcome uses a two-column text-and-landscape composition that becomes a stacked scene at the 700px breakpoint; the picture collection remains a two-column card grid. The game places the picture grid beside the equation panel on wider screens and stacks them on mobile. A narrower 360px breakpoint reduces outer padding and selected card and grid dimensions.

The layout uses component-specific spacing rather than a declared spacing scale. Cards, panels, and controls retain their own padding; borders and open page ground keep the picture scenes from feeling crowded.

### Named Rules

**The Picture-Stays-With-the-Task Rule.** Keep the selected picture alongside the equation during play and repeat that picture as the focus of completion.

## Elevation & Depth

Most surfaces are flat, separated by color, shape, and occasional outlines. Small structural shadows sit under keypad and primary-action buttons; the modal uses a broader shadow. Dark mode also deepens the backdrop behind a modal. Shadows are localized rather than a general card treatment.

### Shadow Vocabulary

- **Pressed-control depth** (`0 3px 2px` with the theme's key or primary shadow color): Keypad keys and primary actions.
- **Modal separation** (`0 16px 80px #28332e40`): Open modal above the application backdrop.

## Shapes

Capsule-shaped actions and signposts recur alongside soft island silhouettes. Picture cards use equal 20px corners and straight, unrounded internal artwork edges so the image and text regions meet cleanly. The hero island is a closed SVG path entirely inside its viewBox; it must not be cropped by the page edge. The answer field, keypad, and game panels retain their own rounded forms.

## Components

### Buttons

- **Primary:** Garden-green fill, light text, capsule form, and compact horizontal padding. A small shadow gives it structural depth; hover shifts to the theme's primary-hover color.
- **Secondary:** Cream or dark secondary surface with an outline and capsule form.
- **Collection action:** Green capsule link with a contrasting circular SVG arrow inset at its trailing edge.
- **Focus / press:** Interactive controls use a visible 3px focus outline with offset; enabled buttons transition state properties and move down 2px while pressed.

### Chips

- **Difficulty / level sign:** Compact rounded pill with a role color; the game-level pill uses the soft green theme surface.

### Cards / Containers

- **Picture cards:** Warm surface with a fine border, equal corners, and a softly colored rectangular artwork area. Center SVG action icons within their circles; hover changes color without shifting them. New pictures show only the arrow, with start text preserved for screen readers. Resume, completion, and number-limit states remain visible.
- **Panels:** The exercise grid uses a neutral, evenly rounded surface with a fine outline, without an additional colored surround. The equation area uses a warm surface with a light outline.
- **Modal:** Bordered warm surface with generous corner rounding and a broad shadow.

### Inputs / Fields

- **Answer:** Centered, bold green digits in a large rounded, outlined field on the warm surface. Retry and range feedback change the border to the retry color.
- **Settings:** Native select controls use a fine outline, rounded corners, and the current surface color.

### Navigation

- **Application header:** Wordmark and utility actions share a single flexible row; utility buttons use a subtle outline and theme surface.
- **Logo:** A green square with 10px corners, three solid contrasting pixels and one outlined pixel. All marks use the primary foreground; no yellow-on-green detail.
- **Gallery artwork:** Center previews on the colored artwork bounds in a padded square viewBox. Preserve rect coordinates and palette; never crop or translate the playable puzzle grid to center a thumbnail.
- **Game navigation:** A text back action and compact level pill sit above the picture title.

### Keypad

- **Number keys:** Three-column grid of soft green pills with thin borders and a small lower shadow; the erase action is visually quieter, and a small flower glyph occupies the remaining key slot.

## Do's and Don'ts

### Do:

- **Do** use the original pixel pictures as the recurring visual subject.
- **Do** use green for primary actions and active progress, and yellow only for completion discovery marks.
- **Do** keep the picture visible beside the arithmetic task and prominent on completion.
- **Do** preserve the light and dark semantic color mappings when extending the interface.

### Don't:

- **Don't** reintroduce decorative slogan badges, mismatched card corners, or narrow localized headings; the pictures and task should lead.
- **Don't** replace the original pixel artwork with external artwork.
- **Don't** apply shadows as a universal surface treatment; the implemented shadows are reserved for controls and modal separation.
