'use strict';
//var Comparator = require('../util/comparator');

/*
 * class Comparator
*/
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

/**
 * Max Heap, keeps the highest element always on top
 *
 * To avoid code repetition, the Min Heap is used just with
 * a reverse comparator;
 */
class MaxHeap extends MinHeap {
  constructor(compareFn) {
    MinHeap.call(this, compareFn);
    this._comparator.reverse();
  };	
};

// MaxHeap.prototype = new MinHeap();  - new syntax (ES6) uses the keyword 'extends'

//module.exports = {
//  MinHeap: MinHeap,
//  MaxHeap: MaxHeap
	//};

/*
 * TESTS for classes MinHeap and MaxHeap
*/
//'use strict';

var heap = {
  MinHeap: MinHeap,
  MaxHeap: MaxHeap
};
//require('../..').DataStructures.Heap;
var assert = require('assert');

describe('Min Heap', function() {
  it('should always return the lowest element', function() {
    var h = new heap.MinHeap();
    assert(h.isEmpty());
    h.insert(10);
    h.insert(2091);
    h.insert(4);
    h.insert(1);
    h.insert(5);
    h.insert(500);
    h.insert(0);
    h.insert(18);
    h.insert(3);
    h.insert(22);
    h.insert(20);
    assert(!h.isEmpty());

    assert.equal(h.extract(), 0);
    assert.equal(h.extract(), 1);
    assert.equal(h.extract(), 3);
    assert.equal(h.extract(), 4);
    assert.equal(h.extract(), 5);
    assert.equal(h.extract(), 10);
    assert.equal(h.extract(), 18);
    assert.equal(h.extract(), 20);
    assert.equal(h.extract(), 22);
    assert.equal(h.extract(), 500);
    assert.equal(h.extract(), 2091);

    assert(h.isEmpty());
  });

  it('should heapify an unordered array', function() {
    var h = new heap.MinHeap();
    h.heapify([10, 2091, 4, 1, 5, 500, 0, 18, 3, 22, 20]);

    assert.equal(h.extract(), 0);
    assert.equal(h.extract(), 1);
    assert.equal(h.extract(), 3);
    assert.equal(h.extract(), 4);
    assert.equal(h.extract(), 5);
    assert.equal(h.extract(), 10);
    assert.equal(h.extract(), 18);
    assert.equal(h.extract(), 20);
    assert.equal(h.extract(), 22);
    assert.equal(h.extract(), 500);
    assert.equal(h.extract(), 2091);

    assert(h.isEmpty());
  });

  it('should perform a function to all elements from smallest to largest' +
     ' with forEach', function() {
    var h = new heap.MinHeap();
    h.heapify([3, 10, 1000, 0, 2, 1]);

    var output = [];
    h.forEach(function(n) {
      output.push(n);
    });

    assert.deepEqual(output, [0, 1, 2, 3, 10, 1000]);

    // Make sure nothing was really removed
    assert.equal(h.n, 6);
  });
});

describe('Max Heap', function() {
  it('should always return the greatest element', function() {
    var h = new heap.MaxHeap();
    assert(h.isEmpty());
    h.insert(10);
    h.insert(2091);
    h.insert(4);
    h.insert(1);
    h.insert(5);
    h.insert(500);
    h.insert(0);
    h.insert(18);
    h.insert(3);
    h.insert(22);
    h.insert(20);
    assert(!h.isEmpty());

    assert.equal(h.extract(), 2091);
    assert.equal(h.extract(), 500);
    assert.equal(h.extract(), 22);
    assert.equal(h.extract(), 20);
    assert.equal(h.extract(), 18);
    assert.equal(h.extract(), 10);
    assert.equal(h.extract(), 5);
    assert.equal(h.extract(), 4);
    assert.equal(h.extract(), 3);
    assert.equal(h.extract(), 1);
    assert.equal(h.extract(), 0);

    assert(h.isEmpty());
  });

  it('should heapify an unordered array', function() {
    var h = new heap.MaxHeap();
    h.heapify([10, 2091, 4, 1, 5, 500, 0, 18, 3, 22, 20]);

    assert.equal(h.extract(), 2091);
    assert.equal(h.extract(), 500);
    assert.equal(h.extract(), 22);
    assert.equal(h.extract(), 20);
    assert.equal(h.extract(), 18);
    assert.equal(h.extract(), 10);
    assert.equal(h.extract(), 5);
    assert.equal(h.extract(), 4);
    assert.equal(h.extract(), 3);
    assert.equal(h.extract(), 1);
    assert.equal(h.extract(), 0);

    assert(h.isEmpty());
  });

  it('should perform a function to all elements from largest to smallest' +
     ' with forEach', function() {
    var h = new heap.MaxHeap();
    h.heapify([3, 10, 1000, 0, 2, 1]);

    var output = [];
    h.forEach(function(n) {
      output.push(n);
    });

    assert.deepEqual(output, [1000, 10, 3, 2, 1, 0]);
  });
});
