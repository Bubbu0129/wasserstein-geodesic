"use strict";

// Interpret a small, well-defined subset of SciPy's reStructuredText
// docstrings. All text is inserted with textContent, not innerHTML.
(function (root) {
  const HEADER = (title) => new RegExp(`^${title}[ \\t]*\\r?\\n-{3,}[ \\t]*(?:\\r?\\n|$)`, "m");
  const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

  function section(doc, title, stopAt) {
    const start = HEADER(title).exec(doc);
    if (!start) return "";
    const rest = doc.slice(start.index + start[0].length);
    const end = stopAt.map(HEADER)
      .map((pattern) => pattern.exec(rest))
      .filter(Boolean)
      .reduce((lowest, match) => Math.min(lowest, match.index), rest.length);
    return rest.slice(0, end).trim();
  }

  function extractNotes(doc) {
    // A number of distributions (e.g. gamma, norm) omit References.
    return section(doc, "Notes", ["References", "Examples"]);
  }

  function extractExampleDefaults(doc, shapes) {
    const examples = section(doc, "Examples", []);
    const defaults = {};
    const allowed = new Set(shapes);
    // Exactly match literal numeric assignments in Python REPL prompts:
    // >>> a, b = 2.31, 0.627
    // >>> df = 2.74
    // Ignore expressions (np.pi, array(...), etc.) rather than evaluating code.
    const assignment = /^\s*>>>\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*=\s*([^\r\n]+)$/gm;
    for (const match of examples.matchAll(assignment)) {
      const names = match[1].split(",").map((s) => s.trim());
      const values = match[2].split("#")[0].split(",").map((s) => s.trim());
      if (names.length !== values.length || !names.every((name) => allowed.has(name))) continue;
      if (!values.every((value) => NUMBER.test(value) && Number.isFinite(Number(value)))) continue;
      for (let i = 0; i < names.length; i++) {
        if (!Object.hasOwn(defaults, names[i])) defaults[names[i]] = Number(values[i]);
      }
    }
    return defaults;
  }

  function inlineRst(text) {
    return text
      .replace(/:math:`([^`]+)`/g, (_, math) => `\\(${math}\\)`)
      .replace(/:[a-z_]+:`([^`]+)`/gi, "$1")
      .replace(/``([^`]+)``/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
  }

  function renderNotes(element, notes) {
    element.replaceChildren();
    if (!notes) {
      const p = document.createElement("p");
      p.textContent = "No Notes section is available for this distribution.";
      element.append(p);
      return;
    }

    const lines = notes.replace(/\r\n/g, "\n").split("\n");
    const paragraph = [];
    const flush = () => {
      if (!paragraph.length) return;
      const p = document.createElement("p");
      p.textContent = inlineRst(paragraph.join(" ").trim());
      element.append(p);
      paragraph.length = 0;
    };

    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      if (/^\s*\.\. math::\s*$/.test(line)) {
        flush();
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        const indent = (lines[i] || "").match(/^[ \t]*/)[0].length;
        const formula = [];
        while (i < lines.length && (!lines[i].trim() ||
            (lines[i].match(/^[ \t]*/)[0].length >= indent && indent > 0))) {
          formula.push(lines[i].trim());
          i++;
        }
        while (formula.length && !formula.at(-1)) formula.pop();
        if (formula.length) {
          const display = document.createElement("div");
          display.className = "math-display";
          let latex = formula.join(" ");
          // SciPy sometimes uses & alignment markers without an explicit
          // environment (e.g. ksone and laplace_asymmetric).
          if (/(^|[^\\])&/.test(latex) && !/\\begin\{(?:align\*?|aligned|array|cases|matrix|pmatrix|bmatrix)\}/.test(latex)) {
            latex = `\\begin{aligned}${latex}\\end{aligned}`;
          }
          display.textContent = `\\[${latex}\\]`;
          element.append(display);
        }
        continue;
      }
      if (!line.trim()) flush();
      else if (/^\s*\.\. (?:note|warning|seealso)::/.test(line)) {
        flush(); // omit reStructuredText directive, retain its content
      } else paragraph.push(line.trim());
      i++;
    }
    flush();
  }

  const api = { extractNotes, extractExampleDefaults, renderNotes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SciPyDoc = api;
})(typeof window !== "undefined" ? window : globalThis);
