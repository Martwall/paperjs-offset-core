# Paperjs Offset Core

A fork from the excellent work made in paperjs-offset (Thanks!). The difference is to be able to provide a PaperScope to the offsetting functionality in case you need to work with paper-core.js directly from paper/dist/paper-core. Current use case is when using paper-core.js and working with paperjs using javascript with a bundler included. Could perhaps also be useful when working with multiple paperjs scopes.
Other changes includes:

- Removed deprecated ExtendPaperJs functionality.
- Removed window global

Under development. Not tested for use in Node.js, only in browser.

## Background from original paperjs-offset, 2016-2019
***
The dicussion to implement a offset function in paper.js started years ago, yet the author have not decided to put a offset feature into the library. So I implement an extension of my own.
<br/>As far as I know, the author has promised recently to implement a native offset functionality in near feature, the library will be closed once the native implement is published.
<br/>This library implement both path offset and stroke offset, you may offset a path or expand a stroke like what you did in Adobe illustrator. Offset complicate path may cause unwanted self intersections, this library already take care some cases but bugs still exists. Please let me notice the false conditions in the issue pannel so I can correct it.
***

## Usage
Installation
```sh
npm install paperjs-offset-core
```
And then, in your project:
```javascript
import paper from 'paper' // if using bundlers otherwise skip and include in <script>. See demo dir.
import { PaperOffset } from 'paperjs-offset'
// Optionally setup paper
let canvas = document.querySelector('canvas')
paper.setup(canvas)
paper.view.center = [0, 0]

const offsetOptions = {
  scope: paper
  // ...other options
}
let path = new paper.Path(/* params */)
// call offset
PaperOffset.offset(path, offset, offsetOptions)

// call offset stroke
PaperOffset.offsetStroke(path, offset, offsetOptions)
```

Sample references:
```typescript
offset(path: paper.Path | paper.CompoundPath, offset: number, options?: OffsetOptions): paper.Path | paper.CompoundPath

offsetStroke(path: paper.Path | paper.CompoundPath, offset: number, options?: OffsetOptions): paper.Path | paper.CompoundPath

interface OffsetOptions {
  // the join style of offset path, default is 'miter'
  join?: 'miter' | 'bevel' | 'round';
  // the cap style of offset (only validate for offsetStroke), default is 'butt', ('square' will be supported in future)
  cap?: 'butt' | 'round';
  // the limit for miter style (refer to the miterLimit definition in paper)
  limit?: number;
  // whether the result should be insert into the canvas, default is true
  insert?: boolean;
  // reference to the PaperScope
  scope: paper.PaperScope
}
```

## Preview
You can use open demo folder for simple cases demonstration.

## License
Distributed under the MIT license.
