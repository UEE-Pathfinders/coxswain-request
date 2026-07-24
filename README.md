# Coxswain Request Terminal v3.1

This build keeps the working v2.9 request flow and adds the approved pre-rendered CRT bezel as a persistent overlay on every screen.

Changes:
- The same pre-rendered industrial bezel surrounds Login, Search, Request, Review and Export.
- The live HTML interface remains interactive beneath the transparent screen opening.
- The duplicate HTML LED and UEE-CRT-90 label were removed; only the bezel artwork's LED and label remain.
- Uses the currently approved CRT Pathfinder logo treatment.
- No framework, database, authentication or paid hosting requirement.

Open `index.html` directly for the included item, or serve/deploy the folder for external lookups.


## v3.2 correction
- Uses the pre-rendered bezel only as the outer transparent frame on every screen.
- Replaces the login artwork with a cropped transparent emblem only.
- No screen background, vignette, scanlines, cursor or UI are baked into the emblem.


## v3.3
- Login wording changed to UEE Crafting Request Terminal / Authorized UEE Personnel Access Only.
- Search placeholder is faint green.
- Checkbox is terminal green.
- Blueprint material rows are compact and no longer use an internal scrollbar for normal recipes.
- Added category-aware wireframe schematic fallbacks for vehicle weapons, personal weapons, magazines, missiles/ammunition, power plants, shields, coolers, drives, mining/tractor equipment, armour, consumables and generic ship components.
- PNG/PDF export now renders the current dark CRT review with the persistent pre-rendered bezel.


## v3.4 corrections
- Starts on an empty Search screen instead of restoring the Eclipse example.
- Uses a new draft key so stale Eclipse/generic visual state is not reused.
- Recalculates fallback category from the selected item on every render.
- C-788 Cannon and other cannons now use the ship-weapon wireframe.
- Request layout compressed into a fixed two-row screen with no normal vertical scrollbar.
- Upload/auto controls moved beneath the image; URL override is collapsed.


## v3.5
- Replaced flat category placeholders with isometric 3D technical wireframes.
- Added category-specific silhouettes for ship weapons, FPS weapons, ammunition containers, magazines, power plants, shields, coolers, drives, mining/tractor equipment, armour, consumables and generic components.
- The current item category is recalculated before Request, Review and export rendering.


## v3.6 corrections
- Replaced the vehicle-weapon fallback with a recognisable long cannon/repeater model including muzzle, barrel shroud, receiver, recoil housing and ship gimbal mount.
- Constrained all fallback artwork inside the item visual well.
- Moved controls into a dedicated row below the visual without overlap.
- Tightened the Request header and panel spacing so the Review button remains visible.
- Increased Request Parameters input text by 2 px.


## v3.7
- Scales all fallback schematics inside a safe inset so the complete 3D model remains visible.
- Opens the Image URL editor upward within the visual panel rather than below the viewport.
- Aligns the quality checkbox, label and Add button on one centred line.


## v3.8 input correction
- Blueprint material fields no longer trigger a full editor re-render on every keystroke.
- Focus, caret position and text selection remain in the active material field.
- Row totals, local draft data, Review and Export update without replacing the input element.

## v3.9
- Replaced shield, cooler and generic component icons with long industrial cuboid ship modules based on the supplied component references.
- Added handles, vent panels, pipe/recoil structures, side housings and circular end assemblies.
- Centred every fallback using a fixed 800×420 viewBox and safe in-panel padding.
- Removed the visible “wireframe fallback” wording from Request and Review.
- Retained the material-input focus fix from v3.8.


## v4.0
- Replaced procedural fallback SVGs for ship components and ship weapons with fixed local 3D wireframe assets extracted from the approved concept.
- All fallback assets use an identical 800x420 canvas and deterministic contain/centre rules.
- Prevents vertical clipping and inconsistent bounds.
- Retains blueprint material focus fix.

## v4.1
- Fixed the category-name mismatch that caused most selections to use the same component asset.
- Added separate 800×420 transparent CRT wireframe assets for vehicle weapons, FPS weapons, ship ammunition, magazines, power plants, shields, coolers, drives, mining equipment, armour, consumables, missiles and generic components.
- Every model uses a shared safe margin and a fixed viewport above the controls.
- The selected category is recalculated from the current item instead of reusing stale saved visual state.


## v4.2 — expanded model library
- Added a generated 3-D CRT asset library covering vehicle weapons, FPS weapon subtypes, ship components, ammunition, mining equipment, armour, consumables and utility equipment.
- Added subtype prediction for pistols, SMGs, assault rifles, battle rifles, shotguns, sniper rifles, LMGs, grenade launchers, rocket launchers, railguns, vehicle cannons, repeaters, gatlings, turrets, beam weapons and missile/torpedo launchers.
- Every asset is placed on the same 800×420 transparent canvas and uses the existing fixed item-visual viewport.


## v4.3 — clipboard export
- Adds a **COPY IMAGE** action alongside PNG and PDF.
- Uses the exact same current terminal renderer as PNG export.
- Copies a PNG directly to the operating-system clipboard for pasting into Discord.
- Requires HTTPS and a browser supporting the asynchronous image Clipboard API; Download PNG remains the fallback.
