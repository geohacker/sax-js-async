Version of sax-js which uses the new streams API for backpressure, and allows callbacks on the events using crisphooks.

```javascript
var SaxAsync = require('sax-async');

var strict = false;
var options = {};

var parseStream = new SaxAsync(strict, options);

parseStream.hookAsync('closetag', function(next, tag) {
	console.log(tag);
	setTimeout(next, 100);
});

parseStream.hookSync('end', function() {
	console.log('Ended.');
});

require('fs').createReadStream('./test.xml').pipe(parseStream);
```

