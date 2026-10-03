# SongAnalyzer quality priorities — October 2026

This is a proposed sequence, not an accuracy claim. The current app combines
lyrics analysis, browser audio features, identification, similarity and a mood
atlas. Product quality means that the visible result belongs to the selected
song, the evidence is legible, and each interaction works on a small screen.

1. **Finish request identity across audio previews.** The lyrics/history fix
   does not cover a preview download that finishes after reset. Acquire a
   request identity before fetch/blob conversion and invalidate it when the
   selection changes. Test reversed completions, history restoration and
   unmount. Require an explicit same-recording association before combining
   lyrics and audio results.
2. **Build reproducible music evaluation.** Use documented, licensed fixtures
   with known tempo/key, clip durations and human mood annotations. Separate
   artists and recordings between tuning and evaluation. Report octave/key
   errors, disagreement between annotators, failure rates and per-language
   results alongside the keyword and audio-feature baselines. Treat current
   confidence values as engine signals until calibration is measured.
3. **Make discovery useful and testable.** Evaluate sonic similarity against
   held-out human judgments before adding a new embedding family. Compare the
   existing feature vector with challengers on the same recordings. Let users
   hear the passage, understand the similarity and return to their selected
   track without losing context.
4. **Continue the listening-studio interface.** The current visible pass
   refines empty/error states only. Next, refine the selected-song identity,
   result summary, confidence/provenance, accessible emotion visualization and
   share preview as one coherent flow. Verify populated, loading, empty,
   error and long-content states at 390, 768 and 1440px, with keyboard focus
   return and reduced-motion settings.

No new service, benchmark result or model promotion is implied by this plan.
