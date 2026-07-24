// Font Awesome Solid adapter.  STUB — implement in subagent B1.
//
// Contract:
//   resolveFontAwesome(name: string) -> string
//     returns an inline <svg viewBox="0 0 64 64" fill="currentColor">...</svg>
//     for the FA Solid icon `name` (e.g. "microphone", "power-off"), with the
//     native 512x512 path re-centered into the shared 0 0 64 64 box.
//
// Source data: the pinned `@fortawesome/free-solid-svg-icons` package. Each icon
// export exposes `{ icon: [width, height, ligatures, unicode, svgPathData] }`.
// Map the requested name -> the fa* export, scale/translate the path so its
// bounding box is centered in a 64x64 viewBox, and set fill="currentColor".
//
// Names the deck preset needs (keep this list resolving):
//   microphone play code terminal server lock crop link house backward-step
//   forward-step volume-low volume-high volume-xmark headphones folder bell-slash
//   circle-half-stroke code-pull-request power-off moon flask music gears
//
// Add a unit test asserting a known name resolves to an <svg> containing a path.
export function resolveFontAwesome(name) {
  throw new Error(`fontawesome adapter not implemented (name=${name})`);
}
