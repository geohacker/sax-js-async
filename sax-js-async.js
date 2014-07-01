var sax = require('sax');
var CrispHooks = require('crisphooks');
var Writable = require('stream').Writable;
var util = require('util');
var async = require('async');

function SaxStream2(strict, options, streamOptions) {
	if(!options) options = {};
	Writable.call(this, streamOptions);

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
}
util.inherits(SaxStream2, Writable);

SaxStream2.prototype._processEventQueue = function(cb) {
	var self = this;

	// Asynchronously fire off all the hooks
	async[this.parallelHandlers ? 'safeEach' : 'safeEachSeries'](this._eventQueue, function(eventSpec, cb) {
		if(eventSpec.name == 'error') {
			cb(eventSpec.args[0]);
		} else {
			self.trigger.apply(self, [self, eventSpec.name].concat(eventSpec.args).concat([function(error) {
				if(error) {
					cb(error);
				} else {
					cb();
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
	var self = this;
	this._processEventQueue(function(error) {
		if(error) {
			// workaround node.js bug that crashes node if _write() calls cb with an error when being pipe()'d to
			self.emit('error', error);
		}
		cb();
	});
};

SaxStream2.prototype.end = function(chunk, encoding, callback) {
	var self = this;
	this._parser.close();
	Writable.prototype.end.call(this, chunk, encoding, function() {
		self._processEventQueue(function(error) {
			if(error) {
				self.emit('error', error);
			} else {
				if(callback) callback();
			}
		});
	});
};

module.exports = SaxStream2;




