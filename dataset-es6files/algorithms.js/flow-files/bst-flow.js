'use strict';
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
 * Tree node ES6
 */
class Node {
  constructor(value, parent) {
    this.value = value;
    this.parent = parent;
    this.left = null;
    this.right = null;
  }	
}

/**
 * BST - Binary Search Tree
 */
class BST {
  constructor(compareFn) {
    this.root = null;
    this._size = 0;
    /**
     * @var Comparator
     */
    this._comparator = new Comparator(compareFn);

    /**
     * Read-only property for the size of the tree
     */
    Object.defineProperty(this, 'size', {
      get: function() {
        return this._size;
      }.bind(this)
    });
  };
  	
  /**
   * Insert elements to the tree respecting the BST restrictions
   */
  insert(value, parent) {
    // Set the root as the initial insertion point
    // if it has not been passed
    if (!parent) {
      if (!this.root) {
        this.root = new Node(value);
        this._size++;
        return;
      }
      parent = this.root;
    }

    var child = this._comparator.lessThan(value, parent.value) ? 'left' : 'right';
    if (parent[child]) {
      this.insert(value, parent[child]);
    } else {
      parent[child] = new Node(value, parent);
      this._size++;
    }
  };

  /**
   * Returns if a tree contains an element in O(lg n)
   */
  contains(e) {
    return Boolean(this._find(e));
  };

  _find(e, root) {
    if (!root) {
      if (this.root) root = this.root;
      else return false;
    }

    if (root.value === e)
      return root;

    if (this._comparator.lessThan(e, root.value))
      return root.left && this._find(e, root.left);

    if (this._comparator.greaterThan(e, root.value))
      return root.right && this._find(e, root.right);
  };

  /**
   * Substitute two nodes
   */
  _replaceNodeInParent(currNode, newNode) {
    var parent = currNode.parent;
    if (parent) {
      parent[currNode === parent.left ? 'left' : 'right'] = newNode;
      if (newNode)
        newNode.parent = parent;
    } else {
      this.root = newNode;
    }
  };

  /**
   * Find the minimum value in a tree
   */
  _findMin(root) {
    var minNode = root;
    while (minNode.left) {
      minNode = minNode.left;
    }
    return minNode;
  };

  /**
   * Remove an element from the BST
   */
  remove(e) {
    var node = this._find(e);
    if (!node) {
      throw new Error('Item not found in the tree');
    }

    if (node.left && node.right) {
      /**
       * If the node to be removed has both left and right children,
       * replace the node's value by the minimum value of the right
       * sub-tree, and remove the leave containing the value
       */
      var successor = this._findMin(node.right);
      this.remove(successor.value);
      node.value = successor.value;
    } else {
      /**
       * If the node is a leaf, just make the parent point to null,
       * and if it has one child, make the parent point to this child
       * instead
       */
      this._replaceNodeInParent(node, node.left || node.right);
      this._size--;
    }
  };

};

//module.exports = BST;

/*
 * TESTS for BST
*/
//'use strict';

//var root = require('../..');
//var BST = root.DataStructures.BST;
//var bfs = root.Search.bfs;
var assert = require('assert');

describe('Binary Search Tree', function() {
  it('should insert elements respecting the BST restrictions', function() {
    var bst = new BST();
    bst.insert(4);
    bst.insert(8);
    bst.insert(10);
    bst.insert(2);
    bst.insert(1);
    bst.insert(3);
    bst.insert(0);
    bst.insert(5);
    bst.insert(100);
    assert.equal(bst.size, 9);
  });
  it('should check if an element exists (in O(lg n))', function() {
    var bst = new BST();
    bst.insert(4);
    bst.insert(8);
    bst.insert(10);
    bst.insert(2);
    bst.insert(1);
    bst.insert(3);
    bst.insert(0);
    bst.insert(5);
    bst.insert(100);
    assert(bst.contains(4));
    assert(bst.contains(0));
    assert(bst.contains(8));
    assert(bst.contains(10));
    assert(bst.contains(5));
    assert(bst.contains(100));

    assert(!bst.contains(12));
    assert(!bst.contains(-10));
    assert(!bst.contains(10000));
    assert(!bst.contains(30));
    assert(!bst.contains(7));
  });

  /**
   *            4
   *       2          8
   *    1     3    5     10
   *  0    2.5               100
   */
  var bst = new BST();
  bst.insert(4);
  bst.insert(8);
  bst.insert(10);
  bst.insert(2);
  bst.insert(1);
  bst.insert(3);
  bst.insert(0);
  bst.insert(5);
  bst.insert(100);
  bst.insert(2.5);

  var callbackGenerator = function(a) {
    return n => a.push(n);
  };

  it('should remove a leaf without altering anything else in ' +
    'the structure of the tree', function() {
    bst.remove(0);
      /**
       *            4
       *       2          8
       *    1     3    5     10
       *       2.5               100
       */
    var a = [];
    bfs(bst.root, callbackGenerator(a));
    assert.deepEqual(a, [4, 2, 8, 1, 3, 5, 10, 2.5, 100]);
  });

  it('should remove an element with just one child and substitute ' +
    'it as the root of only subtree', function() {
    bst.remove(10);
      /**
       *            4
       *       2          8
       *    1     3    5     100
       *       2.5
       */
    var a = [];
    bfs(bst.root, callbackGenerator(a));
    assert.deepEqual(a, [4, 2, 8, 1, 3, 5, 100, 2.5]);
  });

  it('should substitute an element by the leftmost child in the right ' +
    'subtree and remove it as a leaf', function() {
      /**
       *            4
       *       2          8
       *    1     3    5     100
       *       2.5
       */
    bst.remove(2);
      /**
       *            4
       *       2.5        8
       *     1     3    5     100
       *
       */
    var a = [];
    bfs(bst.root, callbackGenerator(a));
    assert.deepEqual(a, [4, 2.5, 8, 1, 3, 5, 100]);

    bst.remove(4);
      /**
       *            5
       *       2.5        8
       *     1     3        100
       *
       */
    a = [];
    bfs(bst.root, callbackGenerator(a));
    assert.deepEqual(a, [5, 2.5, 8, 1, 3, 100]);

    bst.remove(2.5);
      /**
       *            5
       *        3        8
       *     1              100
       *
       */
    a = [];
    bfs(bst.root, callbackGenerator(a));
    assert.deepEqual(a, [5, 3, 8, 1, 100]);
  });

  it('should always return the right root and size', function() {
    var bst = new BST();
    bst.insert(5);
    assert.equal(bst.size, 1);
    bst.remove(5);
    assert.equal(bst.size, 0);
    assert.equal(bst.root, null);
    bst.insert(10);
    bst.insert(3);
    bst.insert(20);
    assert.equal(bst.size, 3);
    bst.remove(10);
    assert.equal(bst.size, 2);
    bst.remove(20);
    assert.equal(bst.size, 1);
    bst.remove(3);
    assert.equal(bst.size, 0);
  });

  it('should throw an error when trying to remove an unexisting node',
      function() {
        var bst = new BST();
        assert.throws(() => bst.remove(0), Error);
        bst.insert(3);
        assert.throws(() => bst.remove(0), Error);
      });
});

describe('Binary Search Tree with custom comparator', function() {
  var strLenCompare = function(a, b) {
    if (a.length === b.length) return 0;
    return a.length < b.length ? -1 : 1;
  };

  it(
    'should insert elements respecting the BST restrictions', function() {
      var bst = new BST(strLenCompare);
      bst.insert('banana');
      bst.insert('apple');
      bst.insert('pineapple');
      bst.insert('watermelon');
      assert.equal(bst.size, 4);
    });

  it('should check if an element exists (in O(lg n))', function() {
    var bst = new BST(strLenCompare);
    bst.insert('banana');
    bst.insert('apple');
    bst.insert('pineapple');
    bst.insert('watermelon');

    assert(bst.contains('watermelon'));
    assert(bst.contains('apple'));
    assert(bst.contains('banana'));
    assert(bst.contains('pineapple'));

    assert(!bst.contains('mango'));
    assert(!bst.contains('melon'));
    assert(!bst.contains('tangerine'));
  });

  /**
   *           'banana'
   *     'apple'      'pineapple'
   *  'pear'               'watermelon'
   *
   */
  var bst = new BST(strLenCompare);
  bst.insert('banana');
  bst.insert('apple');
  bst.insert('pear');
  bst.insert('pineapple');
  bst.insert('watermelon');

  var callbackGenerator = function(a) {
    return n => a.push(n);
  };

  it('should insert the items according to the comparator', function() {
    var a = [];
    bfs(bst.root, callbackGenerator(a));
    assert.deepEqual(a, ['banana', 'apple', 'pineapple', 'pear', 'watermelon']);
  });

  it('should remove a leaf without altering anything else in ' +
    'the structure of the tree', function() {
    bst.remove('watermelon');
      /**
       *           'banana'
       *     'apple'      'pineapple'
       *  'pear'
       */
    var a = [];
    bfs(bst.root, callbackGenerator(a));
    assert.deepEqual(a, ['banana', 'apple', 'pineapple', 'pear']);
  });

  it('should remove an element with just one child and substitute ' +
    'it as the root of only subtree', function() {
    bst.remove('apple');
      /**
       *           'banana'
       *     'pear'      'pineapple'
       */
    var a = [];
    bfs(bst.root, callbackGenerator(a));
    assert.deepEqual(a, ['banana', 'pear', 'pineapple']);
  });

  it('should substitute an element by the leftmost child in the right ' +
    'subtree and remove it as a leaf', function() {
    bst.remove('banana');
      /**
       *       'pineapple'
       *   'pear'
       */
    var a = [];
    bfs(bst.root, callbackGenerator(a));
    assert.deepEqual(a, ['pineapple', 'pear']);
  });
});
