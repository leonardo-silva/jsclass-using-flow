'use strict';

/**
 * Disjoint Set Forest data structure.
 * Allows fast subset merging and querying.
 * New elements lie in their own one-element subsets by default.
 *
 * @constructor
 */
class DisjointSetForest {
  constructor() {
    this._parents = {};
    this._ranks = {};
    this._sizes = {};
  };
  	
  _introduce(element) {
    if (!(element in this._parents)) {
      this._parents[element] = element;
      this._ranks[element] = 0;
      this._sizes[element] = 1;
    }
  };

  /**
   * Check if the elements belong to the same subset.
   * Complexity: O(A^-1) (inverse Ackermann function) amortized.
   *
   * @param {...*} element
   * @return {boolean}
   */
  sameSubset(element) {
    this._introduce(element);
    var root = this.root(element);
    return [].slice.call(arguments, 1).every(function(element) {
      this._introduce(element);
      return this.root(element) === root;
    }.bind(this));
  };

  /**
   * Return the root element which represents the given element's subset.
   * The result does not depend on the choice of the element,
   *   but rather on the subset itself.
   * Complexity: O(A^-1) (inverse Ackermann function) amortized.
   *
   * @param {*} element
   * @return {*}
   */
  root(element) {
    this._introduce(element);
    if (this._parents[element] !== element) {
      this._parents[element] = this.root(this._parents[element]);
    }
    return this._parents[element];
  };

  /**
   * Return the size of the given element's subset.
   * Complexity: O(A^-1) (inverse Ackermann function) amortized.
   *
   * @param {*} element
   * @return {number}
   */
  size(element) {
    this._introduce(element);
    return this._sizes[this.root(element)];
  };

  /**
   * Merge subsets containing two (or more) given elements into one.
   * Complexity: O(A^-1) (inverse Ackermann function) amortized.
   *
   * @param {*} element1
   * @param {*} element2
   * @param {...*}
   * @return {DisjointSetForest}
   */
  merge(element1, element2) {
    if (arguments.length > 2) {
      merge.apply(this, [].slice.call(arguments, 1));
    }

    this._introduce(element1);
    this._introduce(element2);
    var root1 = this.root(element1);
    var root2 = this.root(element2);

    if (this._ranks[root1] < this._ranks[root2]) {
      this._parents[root1] = root2;
      this._sizes[root2] += this._sizes[root1];
    } else if (root1 !== root2) {
      this._parents[root2] = root1;
      this._sizes[root1] += this._sizes[root2];
      if (this._ranks[root1] === this._ranks[root2]) {
        this._ranks[root1] += 1;
      }
    }
    return this;
  };

}

//module.exports = DisjointSetForest;

/*
 * TESTS for DisjointSetForest
*/
//'use strict';

//var DisjointSetForest = require('../..').DataStructures.DisjointSetForest;
var assert = require('assert');

describe('Disjoint Set Forest', function() {
  it('should decide if two elements belong to the same subset or not',
     function() {
       var forest = new DisjointSetForest();
       assert(!forest.sameSubset(1, 2));
       forest.merge(1, 2);
       assert(forest.sameSubset(1, 2));
       forest.merge(3, 4);
       assert(!forest.sameSubset(2, 4));
       forest.merge(1, 3);
       assert(forest.sameSubset(1, 2, 3, 4));
       assert(!forest.sameSubset(1, 5));
     });

  it('should maintain subset sizes', function() {
    var forest = new DisjointSetForest();
    var assertSizesCorrect = function(elements, size) {
      elements.forEach(function(element) {
        assert.equal(forest.size(element), size);
      });
    };
    assertSizesCorrect([0, 1, 2, 3, 4], 1);
    forest.merge(0, 1);
    assertSizesCorrect([0, 1], 2);
    forest.merge(0, 2);
    assertSizesCorrect([0, 1, 2], 3);
    forest.merge(2, 1);
    assertSizesCorrect([0, 1, 2], 3);
    forest.merge(3, 4);
    assertSizesCorrect([3, 4], 2);
    forest.merge(0, 4);
    assertSizesCorrect([0, 1, 2, 3, 4], 5);
  });

  it('should point all elements to the same root', function() {
    var forest = new DisjointSetForest();
    var assertSameRoot = function(element) {
      var root = forest.root(element);
      [].slice.call(arguments, 1).forEach(function(element) {
        assert.equal(forest.root(element), root);
      });
    };
    forest.merge(0, 1);
    assertSameRoot(0, 1);
    forest.merge(1, 2);
    assertSameRoot(0, 1, 2);
    forest.merge(1, 3, 4);
    assertSameRoot(0, 1, 2, 3, 4);
    forest.merge(0, 5);
    assertSameRoot(0, 1, 2, 3, 4, 5);
  });

  it('should not choose the root element outside the subset', function() {
    var forest = new DisjointSetForest();
    var assertInside = function(value, set) {
      return set.some(function(element) {
        return element === value;
      });
    };
    assert.equal(forest.root(0), 0);
    forest.merge(0, 1);
    assertInside(forest.root(0), [0, 1]);
    forest.merge(2, 3);
    assertInside(forest.root(2), [2, 3]);
    forest.merge(4, 5, 6);
    assertInside(forest.root(4), [4, 5, 6]);
    forest.merge(0, 1, 2, 5, 6);
    assertInside(forest.root(4), [0, 1, 2, 3, 4, 5, 6]);
  });
});
