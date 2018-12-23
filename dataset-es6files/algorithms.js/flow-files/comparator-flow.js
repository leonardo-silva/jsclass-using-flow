'use strict';

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

/*
 * TESTS for Comparator
*/
//'use strict';

//var Comparator = require('../../util/comparator');
var assert = require('assert');

describe('Comparator', function() {
  it('Should use a default arithmetic comparison if no function is passed',
    function() {
      var c = new Comparator();
      assert.equal(c.compare(1, 1), 0);
      assert.equal(c.compare(1, 2), -1);
      assert.equal(c.compare(1, 0), 1);
      assert.equal(c.compare('a', 'b'), -1);
      assert(c.lessThan(0, 1));
      assert(!c.lessThan(1, 1));
      assert(c.lessThanOrEqual(1, 1));
      assert(c.lessThanOrEqual(0, 1));
      assert(!c.lessThanOrEqual(1, 0));
      assert(c.greaterThan(1, 0));
      assert(!c.greaterThan(1, 1));
      assert(c.greaterThanOrEqual(1, 1));
      assert(c.greaterThanOrEqual(1, 0));
      assert(!c.greaterThanOrEqual(0, 1));
      assert(c.equal(0, 0));
      assert(!c.equal(0, 1));
    });

  it('should allow comparison function to be defined by user', function() {
    var compareFn = function() {
      return 0;
    };
    var c = new Comparator(compareFn);
    assert.equal(c.compare(1, 1), 0);
    assert.equal(c.compare(1, 2), 0);
    assert.equal(c.compare(1, 0), 0);
    assert.equal(c.compare('a', 'b'), 0);
    assert(!c.lessThan(0, 1));
    assert(!c.lessThan(1, 1));
    assert(c.lessThanOrEqual(1, 1));
    assert(c.lessThanOrEqual(0, 1));
    assert(c.lessThanOrEqual(1, 0));
    assert(!c.greaterThan(1, 0));
    assert(!c.greaterThan(1, 1));
    assert(c.greaterThanOrEqual(1, 1));
    assert(c.greaterThanOrEqual(1, 0));
    assert(c.greaterThanOrEqual(0, 1));
    assert(c.equal(0, 0));
    assert(c.equal(0, 1));
  });

  it('Should allow reversing the comparisons', function() {
    var c = new Comparator();
    c.reverse();
    assert.equal(c.compare(1, 1), 0);
    assert.equal(c.compare(1, 2), 1);
    assert.equal(c.compare(1, 0), -1);
    assert.equal(c.compare('a', 'b'), 1);
    assert(!c.lessThan(0, 1));
    assert(!c.lessThan(1, 1));
    assert(c.lessThanOrEqual(1, 1));
    assert(!c.lessThanOrEqual(0, 1));
    assert(c.lessThanOrEqual(1, 0));
    assert(!c.greaterThan(1, 0));
    assert(!c.greaterThan(1, 1));
    assert(c.greaterThanOrEqual(1, 1));
    assert(!c.greaterThanOrEqual(1, 0));
    assert(c.greaterThanOrEqual(0, 1));
    assert(c.equal(0, 0));
    assert(!c.equal(0, 1));
  });
});

