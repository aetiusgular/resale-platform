
## RERUN NOTE (attempt 2, opus)
The first attempt (haiku) produced UI that broke the design system and was
fully reverted. Design fidelity is THE acceptance bar: every element must
use the exact tokens (colors/fonts/type scale/2px radius/spacing from
app/globals.css and /styleguide) and match design-reference/Settings.dc.html
and the browse card conventions precisely. When in doubt, open the export
and copy its structure. The ui-verifier pass is mandatory, and cheap-looking
generic UI (default borders, wrong fonts, browser-default spacing) is a
BLOCKING failure even if tests pass.
