'use strict';

//var HashTable = require('./hash_table');

//'use strict';

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

/**
 * HashTable constructor
 * @param Number? initially allocated size
 */
class HashTable {
  constructor(initialCapacity) {
    this._table = new Array(initialCapacity || 64);
    this._items = 0;

    Object.defineProperty(this, 'capacity', {
      get: function() {
        return this._table.length;
      }
    });

    Object.defineProperty(this, 'size', {
      get: function() {
        return this._items;
      }
    });
  };
  	
  /**
   * (Same algorithm as Java's String.hashCode)
   * Returns a hash code for this string. The hash code for a String object is
   * computed as: s[0]*31^(n-1) + s[1]*31^(n-2) + ... + s[n-1]
   * using int arithmetic, where s[i] is the ith character of the string,
   * n is the length of the string, and ^ indicates exponentiation.
   * (The hash value of the empty string is zero.)
   */
  hash(s) {
    if (typeof s !== 'string') s = JSON.stringify(s);
    var hash = 0;
    for (var i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash &= hash; // Keep it a 32bit int
    }
    return hash;
  };

  get(key) {
    var i = this._position(key);
    var node;
    if ((node = this._findInList(this._table[i], key))) {
      return node.value.v;
    }
    return undefined;
  };

  put(key, value) {
    var i = this._position(key);
    if (!this._table[i]) {
      // Hashing with chaining
      this._table[i] = new LinkedList();
    }
    var item = {k: key, v: value};

    var node = this._findInList(this._table[i], key);
    if (node) {
      // if the key already exists in the list, replace
      // by the current item
      node.value = item;
    } else {
      this._table[i].add(item);
      this._items++;

      if (this._items === this.capacity) this._increaseCapacity();
    }
  };

  del(key) {
    var i = this._position(key);
    var node;

    if ((node = this._findInList(this._table[i], key))) {
      this._table[i].delNode(node);
      this._items--;
    }
  };

  _position(key) {
    return Math.abs(this.hash(key)) % this.capacity;
  };

  _findInList(list, key) {
    var node = list && list.head;
    while (node) {
      if (node.value.k === key) return node;
      node = node.next;
    }
  };

  _increaseCapacity() {
    var oldTable = this._table;
    this._table = new Array(2 * this.capacity);
    this._items = 0;

    for (var i = 0; i < oldTable.length; i++) {
      var node = oldTable[i] && oldTable[i].head;
      while (node) {
        this.put(node.value.k, node.value.v);
        node = node.next;
      }
    }
  };

  forEach(fn) {
    var applyFunction = function(linkedList) {
      linkedList.forEach(function(elem) {
        fn(elem.k, elem.v);
      });
    };

    for (var i = 0; i < this._table.length; i++) {
      if (this._table[i]) {
        applyFunction(this._table[i]);
      }
    }
  };
};

//module.exports = HashTable;


/**
 * Typical representation of a mathematical set
 * No restriction on element types
 *   i.e. set.add(1,'a', "b", { "foo" : "bar" })
 */
class HashSet {
  constructor() {
    this._elements = new HashTable(arguments.length);
    this.add.apply(this, arguments);

    Object.defineProperty(this, 'size', {
      get: function() {
        return this._elements.size;
      }
    });
  };
    
  add() {
    for (var i = 0; i < arguments.length; i++) {
      this._elements.put(arguments[i], true);
    }
    return this;
  };

  remove() {
    for (var i = 0; i < arguments.length; i++) {
      this._elements.del(arguments[i]);
    }
    return this;
  };

  contains(e) {
    return typeof this._elements.get(e) !== 'undefined';
  };

  forEach(fn) {
    this._elements.forEach(fn);
  };
};

//module.exports = HashSet;

/*
 * TESTS for HashSet
*/
//'use strict';

//var HashSet = require('../..').DataStructures.Set;
var assert = require('assert');

describe('HashSet', function() {
  it('should start empty', function() {
    var s = new HashSet();
    assert.equal(s.size, 0);
  });

  it('should add all initial arguments', function() {
    var s = new HashSet(1, 2, 3);
    assert.equal(s.size, 3);
    assert(s.contains(1));
    assert(s.contains(2));
    assert(s.contains(3));
  });

  it('should add all arguments', function() {
    var s = new HashSet(1, 2, 3);
    assert.equal(s.size, 3);
    s.add(4, 5, 6);
    assert.equal(s.size, 6);
    assert(s.contains(1));
    assert(s.contains(2));
    assert(s.contains(3));
    assert(s.contains(4));
    assert(s.contains(5));
    assert(s.contains(6));
  });

  it('should remove all arguments', function() {
    var s = new HashSet(1, 2, 3);
    assert.equal(s.size, 3);
    s.remove(1, 3);
    assert.equal(s.size, 1);
    assert(!s.contains(1));
    assert(!s.contains(3));
    assert(s.contains(2));
  });

  it('should do nothing when trying to remove an element that doesn\'t exist',
    function() {
      var s = new HashSet(1, 2, 3);
      assert.equal(s.size, 3);
      s.remove(4);
      assert.equal(s.size, 3);
      assert(s.contains(1));
      assert(s.contains(2));
      assert(s.contains(3));
    });

  it('should only contain its elements', function() {
    var s = new HashSet(1, 2, 3);
    assert(s.contains(1));
    assert(!s.contains(4));
  });

  it('should perform a function to all elements with forEach', function() {
    var s = new HashSet();
    s.add(1, 2, 3);

    var total = 0;
    s.forEach(function(elem) {
      total += elem;
    });

    assert.equal(total, 6);
  });
});

