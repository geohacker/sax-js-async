var sax = require('sax');
var CrispHooks = require('crisphooks');
var Transform = require('stream').Transform;
var util = require('util');
var async = require('async');

function SaxStream2(strict, options, streamOptions, fn) {
	if(!options) options = {};
	Transform.call(this, streamOptions);

	this.parallelHandlers = options.parallel;

	// Create the underlying sax stream
	var parser = this._parser = sax.parser(strict, options);

	// Make this object a CrispHooks for async and sync hooks
	CrispHooks.addHooks(this);

	// Queue of events for the current data chunk
	this._eventQueue = [];

	var self = this;
	// Register handlers for each event
	[ 'text', 'doctype', 'processinginstruction',
	'sgmldeclaration', 'opentag', 'closetag',
	'attribute', 'comment', 'opencdata',
	'cdata', 'closecdata', 'opennamespace',
	'closenamespace', 'noscript', 'error', 'end' ].forEach(function(eventName) {
		parser['on' + eventName] = function() {
			self._eventQueue.push({
				name: eventName,
				args: Array.prototype.slice.call(arguments, 0)
			});
		};
	});
	this.fn = fn;
}
util.inherits(SaxStream2, Transform);

SaxStream2.prototype._processEventQueue = function(cb) {
	var self = this;

	// Asynchronously fire off all the hooks
	async['eachSeries'](this._eventQueue, function(eventSpec, cb) {
		if(eventSpec.name == 'error') {
			cb(eventSpec.args[0]);
		} else {
			self.trigger.apply(self, [self, eventSpec.name].concat(eventSpec.args).concat([function(error) {
				if(error) {
					cb(error);
				} else {
					cb(null);
				}
			}]));
		}
	}, function(error) {
		self._eventQueue = [];
		cb(error);
	});
};

SaxStream2.prototype._write = function(chunk, encoding, cb) {
	if(!chunk) return cb();

	// Process this chunk of data
	this._parser.write(chunk.toString('utf8'));

	// Process event queue
	this._processEventQueue(cb);
};

SaxStream2.prototype._flush = function(callback) {
	var self = this;
	this._parser.close();
	self._processEventQueue(function(error) {
		if(error) {
			self.emit('error', error);
		}
		if(callback) callback();
	});
};

module.exports = SaxStream2;




