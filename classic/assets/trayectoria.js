// Progressive enhancement: all reviewed entries are present without JavaScript.
export function initTrajectory() {
  document.querySelectorAll('[data-career]').forEach(root => {
    if (root.dataset.ready) return;
    root.dataset.ready = 'true';
    const buttons = [...root.querySelectorAll('[data-career-filter]')];
    const groups = [...root.querySelectorAll('[data-career-year]')];
    const select = root.querySelector('.career-year');
    root.querySelector('.career-tools').hidden = false;
    buttons.forEach(button => button.addEventListener('click', () => {
      const kind = button.dataset.careerFilter;
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      let count = 0;
      groups.forEach(group => {
        let visible = 0;
        group.querySelectorAll('.career-entry').forEach(entry => {
          entry.hidden = kind !== 'all' && entry.dataset.kind !== kind;
          if (!entry.hidden) visible++;
        });
        group.hidden = !visible;
        count += visible;
        [...select.options].find(o => o.value === group.dataset.careerYear).disabled = !visible;
      });
      select.value = '';
      root.querySelector('.career-count').textContent = `${count} ${count === 1 ? 'encuentro documentado' : 'encuentros documentados'}`;
    }));
    select.addEventListener('change', () => {
      const group = groups.find(g => g.dataset.careerYear === select.value);
      if (group && !group.hidden) group.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
    });
  });
}
initTrajectory();
