/* Namespace loader for specimen cards & UI kits.
   Prefers the compiled _ds_bundle.js; falls back to compiling the component
   sources (the same files consumers get) with Babel standalone.
   Usage (inside a text/babel script, after React + Babel are loaded):
     window.loadPV('../../', 'Button').then((NS) => { ... }) */
(function () {
  var FILES = [
    'components/actions/Button.jsx',
    'components/forms/Input.jsx',
    'components/forms/Dropdown.jsx',
    'components/listing/ListingCard.jsx',
    'components/listing/TierBadge.jsx',
    'components/listing/Tag.jsx',
    'components/navigation/TabBar.jsx',
    'components/feedback/Toast.jsx',
    'components/feedback/Modal.jsx',
  ];

  function scanWindow(probe) {
    var names = Object.getOwnPropertyNames(window);
    for (var i = 0; i < names.length; i++) {
      try {
        var v = window[names[i]];
        if (v && typeof v === 'object' && v !== window && !v.window && typeof v[probe] === 'function') return v;
      } catch (e) { continue; }
    }
    return null;
  }

  async function tryBundle(base, probe) {
    var found = scanWindow(probe);
    if (found) return found;
    try {
      var r = await fetch(base + '_ds_bundle.js');
      if (!r.ok) return null;
      var txt = await r.text();
      try { (0, eval)(txt); } catch (e) { return null; }
      return scanWindow(probe);
    } catch (e) { return null; }
  }

  async function fromSource(base) {
    var ns = {};
    for (var i = 0; i < FILES.length; i++) {
      var p = FILES[i];
      var res = await fetch(base + p);
      if (!res.ok) throw new Error('Missing component source: ' + p);
      var code = await res.text();
      code = code.replace(/^import[^\n]*$/gm, '');
      code = code.replace(/export function (\w+)/g, 'ns.$1 = function $1');
      var js = Babel.transform(code, { presets: ['react'] }).code;
      new Function('React', 'ns', js)(React, ns);
    }
    return ns;
  }

  window.loadPV = async function (base, probe) {
    if (window.__PV) return window.__PV;
    var ns = await tryBundle(base, probe || 'Button');
    if (!ns) ns = await fromSource(base);
    window.__PV = ns;
    return ns;
  };
})();
