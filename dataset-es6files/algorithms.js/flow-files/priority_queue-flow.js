'use strict';

//var MinHeap = require('./heap').MinHeap;

//'use strict';
//var Comparator = require('../util/comparator');

//'use strict';

/**
 * Initialize the comparator object with a compare function
 *
 * If the function is not passed, it will use the default
 * compare signs (<, > and ==)
 *
 * @param { Function } compareFn
 */
class Comparator {
  constructor(compareFn) {
    if (compareFn) {
      this.compare = compareFn;
    }
  };
  	
  /**
   * Default implementation for the compare function
   */
  compare(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  };

  lessThan(a, b) {
    return this.compare(a, b) < 0;
  };

  lessThanOrEqual(a, b) {
    return this.lessThan(a, b) || this.equal(a, b);
  };

  greaterThan(a, b) {
    return this.compare(a, b) > 0;
  };

  greaterThanOrEqual(a, b) {
    return this.greaterThan(a, b) || this.equal(a, b);
  };

  equal(a, b) {
    return this.compare(a, b) === 0;
  };

  /**
   * Reverse the comparison function to use the opposite logic, e.g:
   * this.compare(a, b) => 1
   * this.reverse();
   * this.compare(a, b) => -1
   */
  reverse() {
    var originalCompareFn = this.compare;
    this.compare = function(a, b) {
      return originalCompareFn(b, a);
    };
  };
}

//module.exports = Comparator;

/**
 * Basic Heap structure
 */
class MinHeap {
  constructor(compareFn) {
    this._elements = [null];
    this._comparator = new Comparator(compareFn);

    Object.defineProperty(this, 'n', {
      get: function() {
        return this._elements.length - 1;
      }.bind(this)
    });
  };
  	
  _swap(a, b) {
    var tmp = this._elements[a];
    this._elements[a] = this._elements[b];
    this._elements[b] = tmp;
  };

  isEmpty() {
    return this.n === 0;
  };

  insert(e) {
    this._elements.push(e);
    this._siftUp();
  };

  extract() {
    var element = this._elements[1];

    // Get the one from the bottom in insert it on top
    // If this isn't already the last element
    var last = this._elements.pop();
    if (this.n) {
      this._elements[1] = last;
      this._siftDown();
    }

    return element;
  };

  /**
   * Sift up the last element
   * O(lg n)
   */
  _siftUp() {
    var i;
    var parent;

    for (i = this.n;
        i > 1 && (parent = i >> 1) && this._comparator.greaterThan(
          this._elements[parent], this._elements[i]);
        i = parent) {
      this._swap(parent, i);
    }
  };

  /**
   * Sifts down the first element
   * O(lg n)
   */
  _siftDown(i) {
    var c;
    for (i = i || 1; (c = i << 1) <= this.n; i = c) {
      // checks which is the smaller child to compare with
      if (c + 1 <= this.n && this._comparator.lessThan(
            this._elements[c + 1], this._elements[c]))
        // use the right child if it's lower than the left one
        c++;
      if (this._comparator.lessThan(this._elements[i],
            this._elements[c]))
        break;
      this._swap(i, c);
    }
  };

  heapify(a) {
    if (a) {
      this._elements = a;
      this._elements.unshift(null);
    }

    for (var i = this.n >> 1; i > 0; i--) {
      this._siftDown(i);
    }
  };

  forEach(fn) {
    // A copy is necessary in order to perform extract(),
    // get the items in sorted order and then restore the original
    // this._elements array
    var elementsCopy = [];
    var i;

    for (i = 0; i < this._elements.length; i++) {
      elementsCopy.push(this._elements[i]);
    }

    for (i = this.n; i > 0; i--) {
      fn(this.extract());
    }

    this._elements = elementsCopy;
  };

};

// MaxHeap.prototype = new MinHeap();  - new syntax (ES6) uses the keyword 'extends'

//var heap = {
//  MinHeap: MinHeap,
//  MaxHeap: MaxHeap
	//};

/**
 * Extends the MinHeap with the only difference that
 * the heap operations are performed based on the priority of the element
 * and not on the element itself
 */
class PriorityQueue extends MinHeap {
  constructor(initialItems) {
    var self = this;
    MinHeap.call(this, function(a, b) {
      return self.priority(a) < self.priority(b) ? -1 : 1;
    });

    this._priority = {};

    initialItems = initialItems || {};
    Object.keys(initialItems).forEach(function(item) {
      self.insert(item, initialItems[item]);
    });
  };
  	
  insert(item, priority) {
    if (this._priority[item] !== undefined) {
      return this.changePriority(item, priority);
    }
    this._priority[item] = priority;
    MinHeap.prototype.insert.call(this, item);
  };

  extract(withPriority) {
    var min = MinHeap.prototype.extract.call(this);
    return withPriority ?
      min && {item: min, priority: this._priority[min]} :
      min;
  };

  priority(item) {
    return this._priority[item];
  };

  changePriority(item, priority) {
    this._priority[item] = priority;
    this.heapify();
  };

}

// PriorityQueue.prototype = new MinHeap();  - new syntax (ES6) uses the keyword 'extends'

//module.exports = PriorityQueue;

/*
 * TESTS for PriorityQueue
*/
//'use strict';

//var PriorityQueue = require('../..').DataStructures.PriorityQueue;
var assert = require('assert');

describe('Min Priority Queue', function() {
  it('should always return the element with the lowest priority', function() {
    var q = new PriorityQueue();
    assert(q.isEmpty());
    q.insert('a', 10);
    q.insert('b', 2091);
    q.insert('c', 4);
    q.insert('d', 1);
    q.insert('e', 5);
    q.insert('f', 500);
    q.insert('g', 0);
    q.insert('h', 18);
    q.insert('i', 3);
    q.insert('j', 22);
    q.insert('k', 20);
    assert(!q.isEmpty());

    assert.equal(q.extract(), 'g');
    assert.equal(q.extract(), 'd');
    assert.equal(q.extract(), 'i');
    assert.equal(q.extract(), 'c');
    assert.equal(q.extract(), 'e');
    assert.equal(q.extract(), 'a');
    assert.equal(q.extract(), 'h');
    assert.equal(q.extract(), 'k');
    assert.equal(q.extract(), 'j');
    assert.equal(q.extract(), 'f');
    assert.equal(q.extract(), 'b');

    assert(q.isEmpty());
  });

  it('can receive a dictionary with item => priority in construction',
    function() {
      var q = new PriorityQueue({
        a: 10,
        b: 2091,
        c: 4,
        d: 1,
        e: 5
      });

      assert(!q.isEmpty());
      assert.equal(q.extract(), 'd');
      assert.equal(q.extract(), 'c');
      assert.equal(q.extract(), 'e');
      assert.equal(q.extract(), 'a');
      assert.equal(q.extract(), 'b');
    });

  it('should be possible to change the priority of an item', function() {
    var q = new PriorityQueue({
      a: 10,
      b: 2091,
      c: 4,
      d: 1,
      e: 5
    });

    assert(!q.isEmpty());

    q.changePriority('b', 0);
    q.changePriority('a', 1);
    q.changePriority('c', 50);
    q.changePriority('d', 1000);
    q.changePriority('e', 2);

    assert.equal(q.extract(), 'b');
    assert.equal(q.extract(), 'a');
    assert.equal(q.extract(), 'e');
    assert.equal(q.extract(), 'c');
    assert.equal(q.extract(), 'd');
    assert(q.isEmpty());
  });

  it('should just update the priority when trying to insert an element that ' +
      ' already exists', function() {
    var q = new PriorityQueue({
      a: 10,
      b: 2091,
      c: 4,
      d: 1,
      e: 5
    });

    assert(!q.isEmpty());

    q.insert('b', 0);
    q.insert('a', 1);
    q.insert('c', 50);
    q.insert('d', 1000);
    q.insert('e', 2);

    assert.equal(q.extract(), 'b');
    assert.equal(q.extract(), 'a');
    assert.equal(q.extract(), 'e');
    assert.equal(q.extract(), 'c');
    assert.equal(q.extract(), 'd');
    assert(q.isEmpty());
  });
});


