/* A deterministic camera score measured in viewport heights, independent of input. */
(() => {
  'use strict';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  window.NAROA_JOURNEY = {
    create(works, score) {
      const bySlug = new Map(score.scenes.map(scene => [scene.slug, scene]));
      let cursor = 0, direction = -1, horizontal = false;
      const entries = works.map((work, index) => {
        const spec = bySlug.get(work.slug);
        if (!spec) throw Error('Missing camera score: ' + work.slug);
        let mode = index === works.length - 1 ? 'F' : spec.mode;
        if (mode === 'E' && spec.target !== works[index + 1]?.slug) mode = 'Z';
        if (mode === 'F' && index < works.length - 1) mode = 'V';
        if (spec.direction !== undefined) {
          direction = spec.direction;
        } else if (mode === 'H' && !horizontal) {
          direction *= -1;
        }
        horizontal = mode === 'H';
        const start = cursor, hold = spec.hold / 100, explore = spec.explore / 100;
        const transitionStart = start + hold + explore;
        const duration = score.durations[mode] / 100;
        cursor = transitionStart + duration;
        return { index, slug: work.slug, mode, direction, start, hold, explore, transitionStart, duration, end: cursor };
      });
      function read(distance) {
        const unit = clamp(distance, 0, cursor);
        const entry = entries.find(entry => unit < entry.end - 1e-8) || entries[entries.length - 1];
        const local = unit - entry.start;
        const phase = local < entry.hold - 1e-8 ? 'hold' : unit < entry.transitionStart - 1e-8 ? 'explore' : entry.duration ? 'transition' : 'hold';
        const progress = phase === 'transition' ? clamp((unit - entry.transitionStart) / entry.duration, 0, 1) : 0;
        const explore = entry.explore ? clamp((local - entry.hold) / entry.explore, 0, 1) : 0;
        return { entry, phase, progress, explore, position: entry.index + progress, distance: unit };
      }
      // Integer positions select the complete work; fractions select its camera pass.
      function at(position) {
        const p = clamp(position, 0, works.length - 1), index = Math.floor(p), fraction = p - index;
        const entry = entries[index];
        return fraction ? entry.transitionStart + fraction * entry.duration : entry.start;
      }
      return { entries, total: cursor, read, at };
    }
  };
})();
