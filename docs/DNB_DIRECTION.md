# Loopbench — DnB-first composition direction

The existing browser engine stays intact during migration. The first new building block is a **pure, deterministic composition plan** in `src/dnb/composition-plan.mjs`. It is not yet connected to the audio renderer.

## Priorities
1. Liquid, dancefloor and deep DnB first; EDM styles after a convincing end-to-end DnB render.
2. Shared motif and coherent harmonic palette across every section.
3. Genre-specific drum and bass interplay; phrase-boundary fills and transitions.
4. Full arrangement, then mix and master; measure actual rendered quality rather than relying on a symbolic score.
5. Personal Flow Mode: configurable rhythmic predictability, energy variance and transition intensity; no medical effectiveness claims.

## Current implementation
- Seeded song blueprint, BPM, key, motif, section boundaries, energy targets and a canonical 16-step groove.
- Invariant validator and automated tests covering 300 seeded plans.
- No copyrighted audio samples, artist impersonation, or scraped recordings.

## Next integration gate
Map the blueprint into the legacy song model and render WAV; add listening evaluation, bass/kick masking checks, loudness and true-peak measurements, and section-to-section transition audits. Do not claim a finished song until a playable render has been verified.

## Reference intelligence policy
Analyze licensed or user-provided audio and publicly available release metadata. Store provenance, analysis date, genre confidence, BPM, arrangement descriptors and production traits. Aggregate trends; do not reproduce identifiable melodies or unauthorized audio excerpts.
