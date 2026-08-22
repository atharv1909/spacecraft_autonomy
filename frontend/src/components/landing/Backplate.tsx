/**
 * The landing page's photographic backplate.
 *
 * The source art is portrait (384×672). Letting `cover` crop it on a wide
 * desktop would throw away the torii and the blossom canopy — the parts that
 * carry the theme — so instead it is treated as a hanging scroll: the full
 * plate stands at its true aspect in the centre, feathered at its own edges
 * into a blurred, over-scaled wash of itself that colours the rest of the
 * frame.
 *
 * The feather is a mask on the plate element rather than an overlay at fixed
 * viewport percentages, because the plate's edges move with the viewport
 * aspect ratio — a fixed-percentage gradient would sit in the wrong place at
 * every width but one.
 *
 * A paper scrim sits on top, weighted left where the headline column lives, so
 * ink-on-paper type keeps its contrast over a saturated photograph.
 */

const PLATE_ASPECT = 384 / 672;

/** Feather profile, reused for both the mask and its WebKit twin. */
const EDGE_FADE =
  "linear-gradient(to right, transparent 0%, #000 13%, #000 87%, transparent 100%)";

export function Backplate({ src = "/background.jpg" }: { src?: string }) {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* 1 — blurred bleed. `cover` on a portrait source zooms hard into the
             centre band, which is exactly the pink mist we want at the edges. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('${src}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(52px) saturate(1.2) brightness(1.06)",
          transform: "scale(1.25)",
        }}
      />

      {/* 2 — the sharp plate, sized to its own aspect and feathered at its
             own edges so the seam is invisible at any viewport width. */}
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2"
        style={{
          aspectRatio: `${PLATE_ASPECT}`,
          backgroundImage: `url('${src}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: EDGE_FADE,
          WebkitMaskImage: EDGE_FADE,
        }}
      />

      {/* Paper scrim — heavier on the left, where the headline sits */}
      <div className="absolute inset-0 bg-gradient-to-r from-paper-surface/85 via-paper-surface/45 to-paper-surface/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-paper-surface/45 via-transparent to-paper-surface/75" />
    </div>
  );
}
