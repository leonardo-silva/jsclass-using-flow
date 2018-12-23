'use strict';

/**
 * A linked list node
 */
class Node {
  constructor(value) {
    this.value = value;
    this.prev = null;
    this.next = null;
  }	
}

/**
 * Doubly-linked list
 */
class LinkedList {
  constructor() {
    this._length = 0;
    this.head = null;
    this.tail = null;

    // Read-only length property
    Object.defineProperty(this, 'length', {
      get: function() {
        return this._length;
      }.bind(this)
    });
  };
  	
  /**
   * Whether the list is empty
   *
   * @return Boolean
   */
  isEmpty() {
    return this.length === 0;
  };

  /**
   * Adds the element to the end of the list or to the desired index
   *
   * @param { Object } n
   * @param { Number } index
   */
  add(n, index) {
    if (index > this.length || index < 0) {
      throw new Error('Index out of bounds');
    }

    var node = new Node(n);

    if (index !== undefined && index < this.length) {
      var prevNode;
      var nextNode;

      if (index === 0) {
        // Insert in the beginning
        nextNode = this.head;
        this.head = node;
      } else {
        nextNode = this.getNode(index);
        prevNode = nextNode.prev;
        prevNode.next = node;
        node.prev = prevNode;
      }
      nextNode.prev = node;
      node.next = nextNode;
    } else {
      // Insert at the end
      if (!this.head) this.head = node;

      if (this.tail) {
        this.tail.next = node;
        node.prev = this.tail;
      }
      this.tail = node;
    }

    this._length++;
  };

  /**
   * Return the value associated to the Node on the given index
   *
   * @param { Number } index
   * @return misc
   */
  get(index) {
    return this.getNode(index).value;
  };

  /**
   * O(n) get
   *
   * @param { Number } index
   * @return Node
   */
  getNode(index) {
    if (index >= this.length || index < 0) {
      throw new Error('Index out of bounds');
    }

    var node = this.head;
    for (var i = 1; i <= index; i++) {
      node = node.next;
    }

    return node;
  };

  /**
   * Delete the element in the indexth position
   *
   * @param { Number } index
   */
  del(index) {
    if (index >= this.length || index < 0) {
      throw new Error('Index out of bounds');
    }

    this.delNode(this.getNode(index));
  };

  delNode(node) {
    if (node === this.tail) {
      // node is the last element
      this.tail = node.prev;
    } else {
      node.next.prev = node.prev;
    }
    if (node === this.head) {
      // node is the first element
      this.head = node.next;
    } else {
      node.prev.next = node.next;
    }

    this._length--;
  };

  /**
   * Performs the fn function with each element in the list
   */
  forEach(fn) {
    var node = this.head;
    while (node) {
      fn(node.value);
      node = node.next;
    }
  };
}

//module.exports = LinkedList;

/*
 * TESTS for LinkedList
*/
//'use strict';

//var LinkedList = require('../..').DataStructures.LinkedList;
var assert = require('assert');

describe('LinkedList', function() {
  it('should start empty', function() {
    var l = new LinkedList();
    assert(l.isEmpty());
    assert.equal(l.length, 0);
  });

  it('should increment length when an item is added', function() {
    var l = new LinkedList();
    l.add(1);
    assert.equal(l.length, 1);
    assert(!l.isEmpty());

    l.add(2);
    assert.equal(l.length, 2);
  });

  it('should return the items from the positions they were inserted',
    function() {
      var l = new LinkedList();
      l.add(1);
      l.add(2);
      l.add(3);
      l.add(4);
      l.add(5);
      l.add(6);
      l.add(7);
      l.add(8);
      l.add(9);
      l.add(10);
      l.add(11);
      assert.equal(l.get(0), 1);
      assert.equal(l.get(1), 2);
      assert.equal(l.get(2), 3);
      assert.equal(l.get(3), 4);
      assert.equal(l.get(4), 5);
      assert.equal(l.get(5), 6);
      assert.equal(l.get(6), 7);
      assert.equal(l.get(7), 8);
      assert.equal(l.get(8), 9);
      assert.equal(l.get(9), 10);
      assert.equal(l.get(10), 11);

      // Add 12 to the position 7
      l.add(12, 7);
      assert.equal(l.get(7), 12);
      assert.equal(l.length, 12);

      // Asserts that other elements were shifted
      assert.equal(l.get(8), 8);
      assert.equal(l.get(9), 9);
      assert.equal(l.get(10), 10);
      assert.equal(l.get(11), 11);

      l.add(13, 12);
      assert.equal(l.get(12), 13);
    });

  it('should throw errors when trying to access indexes out of bounds',
      function() {
        var l = new LinkedList();
        assert.throws(() => l.get(0), Error);
        assert.throws(() => l.get(1), Error);
        assert.throws(() => l.get(10), Error);
        assert.throws(() => l.add(10, 1), Error);
        assert.throws(() => l.add(10, 10), Error);

        l.add(1);
        l.add(2);
        // length = 2
        assert.doesNotThrow(() => l.get(0));
        assert.doesNotThrow(() => l.get(1));
        assert.doesNotThrow(() => l.add(3, 2)); // length = 3
        assert.doesNotThrow(() => l.add(3, 0)); // length =4
        assert.doesNotThrow(() => l.add(4, 1)); // length = 5
        assert.doesNotThrow(() => l.add(5, 5)); // length = 6

        assert.throws(() => l.add(10, 10), Error);
        assert.throws(() => l.add(10, 7), Error);
        assert.throws(() => l.get(10), Error);
      });

  it('should be able to delete elements', function() {
    var l = new LinkedList();

    l.add(1);
    l.add(2);
    l.add(3);
    l.add(4);
    l.add(5);
    l.add(6);
    l.add(7);
    l.add(8);

    assert.equal(l.head.value, 1);
    assert.equal(l.tail.value, 8);
    assert.equal(l.length, 8);

    assert.equal(l.get(7), 8);
    l.del(7);
    assert.equal(l.length, 7);
    assert.equal(l.tail.value, 7);
    assert.throws(() => l.get(7), Error);

    l.del(0);
    assert.equal(l.length, 6);
    assert.equal(l.head.value, 2);
    assert.equal(l.get(0), 2);
    assert.equal(l.get(1), 3);

    l.del(4);
    assert.equal(l.length, 5);

    assert.equal(l.get(0), 2);
    assert.equal(l.get(1), 3);
    assert.equal(l.get(2), 4);
    assert.equal(l.get(3), 5);
    assert.equal(l.get(4), 7);

    for (var i = 0; i < 5; i++) {
      l.del(0);
    }

    assert(l.isEmpty());
    assert.equal(l.head, null);
    assert.equal(l.tail, null);
    assert.equal(l.length, 0);
  });

  it('should perform a function to all elements with forEach', function() {
    var l = new LinkedList();
    l.add(5);
    l.add(1);
    l.add(3);
    l.add(10);
    l.add(1000);

    var a = [];
    l.forEach(function(e) {
      a.push(e);
    });

    assert.deepEqual(a, [5, 1, 3, 10, 1000]);
  });

  it('should throw an error when trying to delete from an empty list',
      function() {
        var l = new LinkedList();
        assert.throws(() => l.del(0), Error);
      });
});
