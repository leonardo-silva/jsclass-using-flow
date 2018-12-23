'use strict';

/**
 * Tree node ES6
 */
class Node {
  constructor(value, left, right) {
    this.value = value;
    this.children = [left, right];
    this.size = 1;
    this.height = 1;
    this.key = Math.random();
  };
  	
  /**
   * Computer the number of childnodes
   */
  resize() {
    this.size = (this.children[0] ? this.children[0].size : 0) +
      (this.children[1] ? this.children[1].size : 0) + 1;
    this.height = Math.max(this.children[0] ? this.children[0].height : 0,
      this.children[1] ? this.children[1].height : 0) + 1;
    return this;
  };

  /**
   * Zigzag rotate of tree nodes
   */
  rotate(side) {
    var temp = this.children[side];

    // Rotate
    this.children[side] = temp.children[1 - side];
    temp.children[1 - side] = this;

    this.resize();
    temp.resize();

    return temp;
  };
}

/**
 * Treap
 */
class Treap {
  constructor() {
    this.root = null;
  };	
  
  /**
   * Insert new value into the subtree of `node`
   */
  _insert(node, value) {
    if (node === null) {
      return new Node(value, null, null);
    }

    // Passing to childnodes and update
    var side = ~~(value > node.value);
    node.children[side] = this._insert(node.children[side], value);

    // Keep it balance
    if (node.children[side].key < node.key) {
      return node.rotate(side);
    }
    return node.resize();
  };

  _find(node, value) {
    if (node === null) {
      // Empty tree
      return false;
    }
    if (node.value === value) {
      // Found!
      return true;
    }

    // Search within childnodes
    var side = ~~(value > node.value);
    return this._find(node.children[side], value);
  };

  _minimum(node) {
    if (node === null) {
      // Empty tree, returns Infinity
      return Infinity;
    }

    return Math.min(node.value, this._minimum(node.children[0]));
  };

  _maximum(node) {
    if (node === null) {
      // Empty tree, returns -Infinity
      return -Infinity;
    }

    return Math.max(node.value, this._maximum(node.children[1]));
  };

  _remove(node, value) {
    if (node === null) {
      // Empty node, value not found
      return null;
    }

    var side;

    if (node.value === value) {
      if (node.children[0] === null && node.children[1] === null) {
        // It's a leaf, set to null
        return null;
      }

      // Rotate to a subtree and remove it
      side = (node.children[0] === null ? 1 : 0);
      node = node.rotate(side);
      node.children[1 - side] = this._remove(node.children[1 - side], value);
    } else {
      side = ~~(value > node.value);
      node.children[side] = this._remove(node.children[side], value);
    }
    return node.resize();
  };

  insert(value) {
    this.root = this._insert(this.root, value);
  };

  find(value) {
    return this._find(this.root, value);
  };

  minimum() {
    return this._minimum(this.root);
  };

  maximum() {
    return this._maximum(this.root);
  };

  remove(value) {
    this.root = this._remove(this.root, value);
  };

  size() {
    return this.root ? this.root.size : 0;
  };

  height() {
    return this.root ? this.root.height : 0;
  };

};

module.exports = Treap;

/*
 * TESTS for class Treap
*/
'use strict';

var root = require('../..');
var Treap = root.DataStructures.Treap;
var assert = require('assert');

describe('Treap', function() {
  var treap;
  before(function() {
    treap = new Treap();
  });

  it('should insert elements', function() {
    treap.insert(3);
    treap.insert(2);
    treap.insert(10);
    treap.insert(-1);
    treap.insert(100);
    treap.insert(101);
    treap.insert(1);
    assert.equal(treap.root.size, 7);
    treap.insert(-100);
    assert.equal(treap.root.size, 8);
  });

  it('should remove elements correctly', function() {
    // Value that not exist
    treap.remove(200);
    assert.equal(treap.root.size, 8);
    treap.remove(100);
    assert.equal(treap.root.size, 7);
    treap.remove(1);
    treap.remove(-1);
    treap.remove(-1);
    treap.remove(101);
    assert.equal(treap.root.size, 4);
  });

  it('should insert and remove elements', function() {
    // [-100, 2, 3, 10]
    treap.insert(200);
    // [-100, 2, 3, 10, 200]
    assert.equal(treap.root.size, 5);
    treap.remove(-100);
    // [2, 3, 10, 200]
    assert.equal(treap.root.size, 4);
    treap.insert(1);
    treap.remove(1);
    treap.insert(1);
    // [1, 2, 3, 10, 200]
    treap.remove(200);
    treap.insert(100);
    // [1, 2, 3, 10, 100]
    assert.equal(treap.root.size, 5);
  });

  it('should check if an element exists', function() {
    // [1, 2, 3, 10, 100]
    assert.equal(treap.find(1), true);
    assert.equal(treap.find(2), true);
    assert.equal(treap.find(3), true);
    assert.equal(treap.find(10), true);
    assert.equal(treap.find(100), true);
    assert.equal(treap.find(200), false);
    assert.equal(treap.find(-100), false);
    assert.equal(treap.find(-1), false);
    assert.equal(treap.find(101), false);
  });

  it('should get minimum element', function() {
    // [1, 2, 3, 10, 100]
    assert.equal(treap.minimum(), 1);
    treap.remove(1);
    // [2, 3, 10, 100]
    assert.equal(treap.minimum(), 2);
    treap.insert(-100);
    // [-100, 2, 3, 10, 100]
    assert.equal(treap.minimum(), -100);
    treap.remove(-100);
    // [2, 3, 10, 100]
    assert.equal(treap.minimum(), 2);
  });

  it('should get maximum element', function() {
    // [2, 3, 10, 100]
    assert.equal(treap.maximum(), 100);
    treap.remove(100);
    // [2, 3, 10]
    assert.equal(treap.maximum(), 10);
    treap.remove(10);
    // [2, 3]
    assert.equal(treap.maximum(), 3);
    treap.remove(3);
    // [2]
    assert.equal(treap.maximum(), 2);
    treap.insert(1);
    // [1, 2]
    assert.equal(treap.maximum(), 2);
    treap.remove(2);
    // [1]
    assert.equal(treap.maximum(), 1);
  });

  it('should handle dumplicated elements', function() {
    treap.insert(1);
  // [1, 1]
    assert.equal(treap.size(), 2);
    treap.insert(-1);
  // [-1, 1, 1]
    assert.equal(treap.size(), 3);
    treap.remove(1);
  // [-1, 1]
    assert.equal(treap.size(), 2);
    treap.insert(-1);
    treap.insert(-1);
    treap.insert(-1);
  // [-1, -1, -1, -1, 1]
    assert.equal(treap.size(), 5);
    treap.remove(-1);
    treap.remove(1);
    treap.remove(-1);
    treap.remove(-1);
    treap.remove(-1);
    assert.equal(treap.size(), 0);
  });

  it('should keep balance', function() {
  // Insert 1023 elements randomly
    for (var i = 0; i < 1023; ++i) {
      treap.insert(Math.random());
    }
    assert.equal(treap.size(), 1023);
  // The averange height should be 23 (with an error of 5)
    assert(Math.abs(treap.height() - 23) < 5);
  });

  it('should rotate correctly', function() {
    // Force clear the tree
    treap.root = null;
    treap.insert(1);
    // 1
    assert.equal(treap.height(), 1);

    // Make the tree definite
    treap.root.key = 2;
    treap.insert(2);
    /**
     *   2
     *  /
     * 1
     *
   */
    assert.equal(treap.height(), 2);

    treap.root.key = 1;
    treap.insert(3);
    /**
     *     3
     *    /
     *   2
     *  /
     * 1
     *
   */
    assert.equal(treap.height(), 3);
    assert.equal(treap.root.value, 3);

    treap.root = treap.root.rotate(0);
    /**
     *   2
     *  / \
     * 1   3
     *
   */
    assert.equal(treap.height(), 2);
    assert.equal(treap.root.value, 2);

    treap.root = treap.root.rotate(0);
    /**
     * 1
     *  \
     *   2
     *    \
     *     3
     *
   */
    assert.equal(treap.height(), 3);
    assert.equal(treap.root.value, 1);
  });
});
