// Shared UI helpers for press-and-hold repeat actions.
// Exposed on window for use from inline scripts.

(() => {
  const suppressClick = new WeakSet();

  function addLongPress(element, onRepeat, { delay = 450, interval = 150 } = {}) {
    if (!element) return;

    let delayTimer = null;
    let repeatTimer = null;

    const stop = () => {
      if (delayTimer) {
        clearTimeout(delayTimer);
        delayTimer = null;
      }
      if (repeatTimer) {
        clearInterval(repeatTimer);
        repeatTimer = null;
      }
    };

    element.addEventListener('pointerdown', (evt) => {
      if (evt.pointerType === 'mouse' && evt.button !== 0) {
        return;
      }

      stop();

      try {
        element.setPointerCapture(evt.pointerId);
      } catch (_) {
        // ignore
      }

      delayTimer = setTimeout(() => {
        suppressClick.add(element);
        try {
          onRepeat();
        } catch (_) {
          // ignore
        }
        repeatTimer = setInterval(() => {
          try {
            onRepeat();
          } catch (_) {
            // ignore
          }
        }, interval);
      }, delay);
    });

    element.addEventListener('pointerup', stop);
    element.addEventListener('pointercancel', stop);
    element.addEventListener('pointerleave', stop);
    element.addEventListener('lostpointercapture', stop);
  }

  function addClick(element, handler) {
    if (!element) return;

    element.addEventListener('click', async (evt) => {
      if (suppressClick.has(element)) {
        suppressClick.delete(element);
        evt.preventDefault();
        evt.stopPropagation();
        return;
      }
      return await handler(evt);
    });
  }

  window.addLongPress = addLongPress;
  window.addClick = addClick;
})();
