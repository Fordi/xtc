#!/usr/bin/env node
import { DOMParser } from "xmldom";
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import getOptions from "@fordi-org/get-options";

const { usage, read: readOptions } = getOptions({
  description:
    "Convert an XHTML, SVG, or XML file to the POJSO format supported by @fordi/create-element",
  validate: (options) => {
    if (!options.inFile) {
      throw new Error("You must include an input file.");
    }
  },
  i: {
    name: "in",
    description: "Input XML file",
    trigger: (inFile) => ({ inFile }),
    required: true,
  },
  x: {
    name: "ext",
    description: "Extension (default: .js)",
    trigger: (ext) => ({ ext }),
  },
  n: {
    name: "name",
    description: "Module name (default: filename without extension)",
    trigger: (name) => ({ name }),
  },
  o: {
    name: "out",
    description:
      "Output JS file (default: moduleName.ext in same dir as input file",
    trigger: (outFile) => ({ outFile }),
  },
});

const indent = (str) => `  ${str.split("\n").join("\n  ")}`;

const nsMap = {
  SVGNS: "http://www.w3.org/2000/svg",
};

const nsrMap = Object.keys(nsMap).reduce(
  (o, k, v) => ({ ...o, [nsMap[v]]: k }),
  {}
);

let usedNS = new Set();

const toArray = (element) => {
  if (!element.nodeType && "length" in element) {
    const ret = [];
    for (let i = 0; i < element.length; i++) {
      ret.push(element[i]);
    }
    return ret;
  }
  if (element.nodeType === 3) {
    if (element.nodeValue.trim() === "") return null;
    return JSON.stringify(element.nodeValue);
  }
  const { namespaceURI, tagName, attributes, childNodes } = element;
  const attrPairs = toArray(attributes)
    .map(({ name, value }) => {
      if (name === "xmlns") {
        const key = `${tagName.toUpperCase()}`;
        nsMap[key] = value;
        nsrMap[value] = key;
        return { name, js: key };
      }
      if (name.startsWith("xmlns:")) {
        const key = name.substring(6).toUpperCase();
        nsMap[key] = value;
        nsrMap[value] = key;
        return { name, js: key };
      }
      if (/^[-+]?[0-9]*(?:\.[0-9]*)?(?:e[-+]?[0-9]+)?$/.test(value)) {
        value = parseFloat(value);
      }
      return { name, js: JSON.stringify(value) };
    })
    .filter((a) => !!a)
    .map(({ name, js }) => {
      if (/[^A-Za-z0-9_$]/.test(name)) {
        name = `${JSON.stringify(name)}`;
      }
      return `${name}: ${js}`;
    });
  let tag = JSON.stringify(tagName);
  if (namespaceURI) {
    if (nsrMap[namespaceURI]) {
      tag = `[${nsrMap[namespaceURI]}, ${tag}]`;
      usedNS.add(nsrMap[namespaceURI]);
    } else {
      tag = JSON.stringify([namespaceURI, tagName]);
    }
  }
  const kids = toArray(childNodes)
    .map((node) => toArray(node))
    .filter((a) => !!a);
  let attrs = "";
  if (kids.length) {
    attrs = ", {}";
  }
  if (attrPairs.length) {
    attrs = `, { ${attrPairs.join(", ")} }`;
  }
  if (attrs && tagName.length + attrs.length + 3 > 100) {
    attrs = `, {\n${indent(attrPairs.join(",\n"))}\n}`;
  }
  let children = "";
  if (kids.length) {
    children = `, [\n${kids.map((kid) => indent(kid)).join(",\n")}\n]`;
  }
  return `[${tag}${attrs}${children}]`;
};

const toComponentSource = async ({ inFile, outFile, name, ext = "js" }) => {
  name = name || basename(inFile).replace(/\..*$/, "");
  if (!outFile) {
    const dir = dirname(inFile);
    outFile = join(dir, `${name}.${ext}`);
  }
  const parser = new DOMParser();
  const dom = parser.parseFromString(
    await readFile(inFile, "utf-8"),
    "text/xml"
  );
  const code = toArray(dom.documentElement);
  let content = [
    ...[...usedNS].map(
      (key) => `const ${key} = ${JSON.stringify(nsMap[key])};`
    ),
    `const ${name} = () => (\n${indent(code)}\n);`,
    `export default ${name};`,
  ];
  console.info(`Writing ${outFile}`);
  return writeFile(outFile, content.join("\n\n"), "utf-8");
};

await toComponentSource(await readOptions(process.argv.slice(2)));
