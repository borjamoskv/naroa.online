/* Compatibility for older gallery markup. Colour belongs to the whole original photograph. */
(() => {
 'use strict';
 document.querySelectorAll('.vaivenes-irises,.eye-paint-scene').forEach(layer=>layer.remove());
 window.NaroaVaivenesEyes={attach(){},reveal(){}};
})();
