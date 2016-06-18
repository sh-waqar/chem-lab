"use strict";

var fs = require("fs");
var kb = require("keyboardjs");
var lz = require("lz-string");
var $ = require("jquery");

var Renderer = require("./renderer");
var View = require("./view");
var System = require("./system");
var xyz = require("./xyz");
var elements = require("./elements");
var presets = require("./presets");
var mimetypes = require("./mimetypes");

window.onerror = function(e, url, line) {
  var error = document.getElementById("error");
  error.style.display = "block";
  var error = document.getElementById("error-text");
  error.innerHTML = "Sorry, an error has occurred:<br><br>" + e;
}

kb.active = function(key) {
  var keys = kb.activeKeys();
  for (var i = 0; i < keys.length; i++) {
    if (key === keys[i]) {
      return true;
    }
  }
  return false;
}

var system = System.new();
var view = View.new();
var renderer = null;
var needReset = false;

var renderContainer;

function loadStructure(data) {
  system = System.new();
  for (var i = 0; i < data.length; i++) {
    var a = data[i];
    var x = a.position[0];
    var y = a.position[1];
    var z = a.position[2];
    System.addAtom(system, a.symbol, x, y, z);
  }
  System.center(system);
  System.calculateBonds(system);
  renderer.setSystem(system, view);
  View.center(view, system);
  needReset = true;
}

// Convert smile input from the text file
// to ctab first
function smile2ctab(smile) {
  $.ajax({
    url: 'https://www.ebi.ac.uk/chembl/api/utils/smiles2ctab/' + smile,
    success: function(data) {
      var encodedData = b64EncodeUnicode(data);
      ctab2xyz(encodedData);
    }
  })
}

// Convert the ctab from the rest api output
// to get the xyz co-ordinates
function ctab2xyz(ctab) {
  $.ajax({
    url: 'https://www.ebi.ac.uk/chembl/api/utils/ctab2xyz/' + ctab,
    success: function(data) {
      var cords = xyz(data)[0];
      loadStructure(cords);
      // Render cords on view
      $('#cords').html(data);
    }
  })
}

function checkFormate(str) {
  // Regex pattern taken from https://gist.github.com/lsauer/1312860
  // SMILES, Inchi Regex , by lo sauer - lsauer.com
  // Here's a PREG version for SMILES validation (JavaScript) beyond a length of 5:
  return !!str.trim().match(/^([^J][0-9BCOHNSOPrIFla@+\-\[\]\(\)\\=#$]{6,})$/ig);
}

function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
    return String.fromCharCode('0x' + p1);
  }));
}

window.onload = function() {
  var fileUploader = $('#file-uploader');
  var errorArea = $('.error-area');

  fileUploader.on('change', function() {
    if (!window.FileReader) {
      alert('Your browser is not supported')
    }
    var input = this;

    // Create a reader object
    var reader = new FileReader();
    if (input.files.length) {
      var textFile = input.files[0];
      reader.readAsText(textFile);
      $(reader).on('load', processFile);
    } else {
      alert('Please upload a file before continuing')
    }
  });

  function processFile(e) {
    var file = e.target.result,
      results;
    if (file && file.length) {
      results = file.split("\n");

      if (checkFormate(results[0])) {
        // Print the content of file on console
        console.log(results[0]);

        var smile = b64EncodeUnicode(results[0]);
        smile2ctab(smile);
      } else {
        alert('File does not contain valid SMILE string.');
      }
    }
  }

  renderContainer = document.getElementById("render-container");

  var imposterCanvas = document.getElementById("renderer-canvas");

  renderer = new Renderer(imposterCanvas, view.resolution, view.aoRes);

  var lastX = 0.0;
  var lastY = 0.0;
  var buttonDown = false;

  renderContainer.addEventListener("mousedown", function(e) {
    document.body.style.cursor = "none";
    if (e.button == 0) {
      buttonDown = true;
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener("mouseup", function(e) {
    document.body.style.cursor = "";
    if (e.button == 0) {
      buttonDown = false;
    }
  });

  setInterval(function() {
    if (!buttonDown) {
      document.body.style.cursor = "";
    }
  }, 10);

  window.addEventListener("mousemove", function(e) {
    if (!buttonDown) {
      return;
    }
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    if (dx == 0 && dy == 0) {
      return;
    }
    lastX = e.clientX;
    lastY = e.clientY;
    if (e.shiftKey) {
      View.translate(view, dx, dy);
    } else {
      View.rotate(view, dx, dy);
    }
    needReset = true;
  });

  renderContainer.addEventListener("wheel", function(e) {
    var wd = 0;
    if (e.deltaY < 0) {
      wd = 1;
    } else {
      wd = -1;
    }
    if (kb.active("a")) {
      view.atomScale += wd / 100;
      View.resolve(view);
      document.getElementById("atom-radius").value = Math.round(view.atomScale * 100);
      needReset = true;
    } else if (kb.active("z")) {
      var scale = view.relativeAtomScale;
      scale += wd / 100;
      view.relativeAtomScale += wd / 100;
      View.resolve(view);
      document.getElementById("relative-atom-radius").value = Math.round(view.relativeAtomScale * 100);
      needReset = true;
    } else if (kb.active("d")) {
      view.dofStrength += wd / 100;
      View.resolve(view);
      document.getElementById("dof-strength").value = Math.round(view.dofStrength * 100);
    } else if (kb.active("p")) {
      view.dofPosition += wd / 100;
      View.resolve(view);
      document.getElementById("dof-position").value = Math.round(view.dofPosition * 100);
    } else if (kb.active("b")) {
      view.bondScale += wd / 100;
      View.resolve(view);
      document.getElementById("bond-radius").value = Math.round(view.bondScale * 100);
      needReset = true;
    } else if (kb.active("s")) {
      view.bondShade += wd / 100;
      View.resolve(view);
      document.getElementById("bond-shade").value = Math.round(view.bondShade * 100);
      needReset = true;
    } else if (kb.active("w")) {
      view.atomShade += wd / 100;
      View.resolve(view);
      document.getElementById("atom-shade").value = Math.round(view.atomShade * 100);
      needReset = true;
    } else if (kb.active("o")) {
      view.ao += wd / 100;
      View.resolve(view);
      document.getElementById("ambient-occlusion").value = Math.round(view.ao * 100);
    } else if (kb.active("l")) {
      view.brightness += wd / 100;
      View.resolve(view);
      document.getElementById("brightness").value = Math.round(view.brightness * 100);
    } else if (kb.active("q")) {
      view.outline += wd / 100;
      View.resolve(view);
      document.getElementById("outline-strength").value = Math.round(view.outline * 100);
    } else {
      view.zoom = view.zoom * (wd === 1 ? 1 / 0.9 : 0.9);
      View.resolve(view);
      needReset = true;
    }
    e.preventDefault();
  });

  function reflow() {
    var ww = window.innerWidth;
    var wh = window.innerHeight;

    var rcw = Math.round(wh * 1);
    var rcm = Math.round((wh - rcw) / 2);

    renderContainer.style.height = rcw - 64 + "px";
    renderContainer.style.width = rcw - 64 + "px";
    renderContainer.style.left = rcm + 600 + "px";
    renderContainer.style.top = rcm + 32 + "px";
  }

  reflow();

  window.addEventListener("resize", reflow);

  function loop() {
    if (needReset) {
      renderer.reset();
      needReset = false;
    }
    renderer.render(view);
    requestAnimationFrame(loop);
  }

  loop();
}
