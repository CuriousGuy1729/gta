// Keep touch inputs separate from the keyboard and track each pointer, so
// simultaneous steering/pedals and touch cancellation cannot leave keys stuck.
export function bindTouchControls(root, { isOnFoot = () => false } = {}) {
  const pointers = new Map();
  const buttons = [...root.querySelectorAll('[data-hold]')];
  function release(pointerId) {
    const entry = pointers.get(pointerId);
    if (!entry) return;
    pointers.delete(pointerId);
    if (![...pointers.values()].some(item => item.button === entry.button)) {
      entry.button.classList.remove('pressed');
    }
  }
  function clear() {
    for (const id of [...pointers.keys()]) release(id);
  }
  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      release(event.pointerId);
      const key = isOnFoot() && button.dataset.footKey ? button.dataset.footKey : button.dataset.hold;
      pointers.set(event.pointerId, { key: key === 'space' ? ' ' : key, button });
      button.classList.add('pressed');
      button.setPointerCapture(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => release(event.pointerId));
    }
    button.addEventListener('contextmenu', event => event.preventDefault());
  }
  return { isDown: key => [...pointers.values()].some(item => item.key === key), clear };
}
