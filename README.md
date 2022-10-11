# XTC

Convert an XHTML, SVG, or XML file to the POJSO format supported by [@fordi/create-element](https://github.com/Fordi/create-element)

## Usage

```
node xtc.mjs {-i {inFile}} [-x {ext}] [-n {name}] [-o {outFile}] [-h] 
  -i    (required) Input XML file
  -x    Extension (default: .js)
  -n    Module name (default: filename without extension)
  -o    Output JS file (default: moduleName.ext in same dir as input file
  -h    This help message
```
