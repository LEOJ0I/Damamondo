// Carica i file delle regole (senza DOM) come nel browser, in ordine, e restituisce DM.
const path = require('path');
const FILES = ['data', 'map', 'game', 'territory', 'troops', 'combat', 'economy', 'buildings', 'transport', 'turn', 'save'];
module.exports = function load() {
  for (const f of FILES) require(path.join(__dirname, '..', 'js', f + '.js'));
  return globalThis.DM;
};
module.exports.FILES = FILES;
