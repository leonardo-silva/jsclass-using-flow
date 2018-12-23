'use strict';

//var HashSet = require('./set');

//'use strict';

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

// Normalize vertex labels as strings
var _ = function(v) {
  return String(v);
};

/**
 * Adjacency list representation of a graph
 * @param {bool} directed
 */
class Graph {
  constructor(directed) {
    this.directed = typeof directed === 'undefined' || Boolean(directed);
    this.adjList = Object.create(null);
    this.vertices = new HashSet();
  };	
  
  addVertex(v) {
    v = _(v);
    if (this.vertices.contains(v)) {
      throw new Error('Vertex "' + v + '" has already been added');
    }
    this.vertices.add(v);
    this.adjList[v] = Object.create(null);
  };

  addEdge(a, b, w) {
    a = _(a);
    b = _(b);
    // If no weight is assigned to the edge, 1 is the default
    w = (w === undefined ? 1 : w);

    if (!this.adjList[a]) this.addVertex(a);
    if (!this.adjList[b]) this.addVertex(b);

    // If there's already another edge with the same origin and destination
    // sum with the current one
    this.adjList[a][b] = (this.adjList[a][b] || 0) + w;

    // If the graph is not directed add the edge in both directions
    if (!this.directed) {
      this.adjList[b][a] = (this.adjList[b][a] || 0) + w;
    }
  };

  neighbors(v) {
    return Object.keys(this.adjList[_(v)]);
  };

  edge(a, b) {
    return this.adjList[_(a)][_(b)];
  };

}

//module.exports = Graph;
// 
/*
 * TESTS for Graph
*/
//'use strict';

//var Graph = require('../..').DataStructures.Graph;
var assert = require('assert');

describe('Graph - Adjacency list', function() {
  it('should be directed by default', function() {
    var g = new Graph();
    assert(g.directed);

    g = new Graph(false);
    assert(!g.directed);

    g = new Graph(true);
    assert(g.directed);
  });

  it('should default weight 1 for edges', function() {
    var g = new Graph();
    g.addVertex('a');
    g.addVertex('b');
    g.addEdge('a', 'b');
    assert.strictEqual(g.edge('a', 'b'), 1);
  });

  it('should create the vertex if an edge is inserted and vertex doesnt exist',
    function() {
      var g = new Graph();
      g.addEdge('a', 'b');
      assert.equal(g.vertices.size, 2);
      assert(g.vertices.contains('a'));
      assert(g.vertices.contains('b'));
    });

  it('should sum multiple edges between the same vertices', function() {
    var g = new Graph();
    g.addEdge('a', 'b', 10);
    assert.equal(g.edge('a', 'b'), 10);
    g.addEdge('a', 'b', 4);
    assert.equal(g.edge('a', 'b'), 14);
  });

  it('should have edges in both directions if undirected', function() {
    var g = new Graph(false);
    g.addVertex('a');
    g.addVertex('b');
    g.addVertex('c');
    g.addVertex('d');
    g.addEdge('a', 'b', 10);
    g.addEdge('a', 'c', 5);
    g.addEdge('c', 'd', 2);

    assert.equal(g.edge('a', 'b'), 10);
    assert.equal(g.edge('b', 'a'), 10);
    assert.equal(g.edge('a', 'c'), 5);
    assert.equal(g.edge('c', 'a'), 5);
    assert.equal(g.edge('c', 'd'), 2);
    assert.equal(g.edge('d', 'c'), 2);

    assert.equal(g.edge('a', 'd'), undefined);
    g.addEdge('b', 'a', 2);
    assert.equal(g.edge('a', 'b'), 12);
    assert.equal(g.edge('b', 'a'), 12);
  });

  it('should respect direction of the edges in directed graphs', function() {
    var g = new Graph();
    g.addVertex('a');
    g.addVertex('b');
    g.addVertex('c');
    g.addVertex('d');
    g.addEdge('a', 'b', 10);
    g.addEdge('a', 'c', 5);
    g.addEdge('c', 'd', 2);

    assert.equal(g.edge('a', 'b'), 10);
    assert.equal(g.edge('b', 'a'), undefined);
    assert.equal(g.edge('a', 'c'), 5);
    assert.equal(g.edge('c', 'a'), undefined);
    assert.equal(g.edge('c', 'd'), 2);
    assert.equal(g.edge('d', 'c'), undefined);

    assert.equal(g.edge('a', 'd'), undefined);
    g.addEdge('b', 'a', 2);
    assert.equal(g.edge('a', 'b'), 10);
    assert.equal(g.edge('b', 'a'), 2);
  });

  it('should have a list of vertices', function() {
    var g = new Graph();
    assert.equal(g.vertices.size, 0);
    g.addVertex('a');
    g.addVertex('b');
    g.addVertex('c');
    assert.equal(g.vertices.size, 3);
    assert(g.vertices.contains('a'));
    assert(g.vertices.contains('b'));
    assert(g.vertices.contains('c'));
  });

  it('should not allow repeated vertices', function() {
    var g = new Graph();
    g.addVertex('a');
    assert.throws(function() {
      g.addVertex('a');
    });
  });

  it('should return a list of neighbors of a vertex', function() {
    var g = new Graph();
    g.addVertex('a');
    g.addVertex('b');
    g.addVertex('c');
    g.addVertex('d');
    g.addEdge('a', 'b', 10);
    g.addEdge('a', 'c', 5);
    g.addEdge('c', 'd', 2);

    assert.deepEqual(g.neighbors('a'), ['b', 'c']);
    assert.deepEqual(g.neighbors('b'), []);
    assert.deepEqual(g.neighbors('c'), ['d']);
  });

  it('should return the weight of the edge', function() {
    var g = new Graph();
    g.addVertex('a');
    g.addVertex('b');
    g.addVertex('c');
    g.addVertex('d');
    g.addEdge('a', 'b', 10);
    g.addEdge('a', 'c', 5);
    g.addEdge('c', 'd', 2);

    assert.equal(g.edge('a', 'b'), 10);
    assert.equal(g.edge('a', 'c'), 5);
    assert.equal(g.edge('c', 'd'), 2);
  });

  it('should not "inherit" edges from Object.prototype', function() {
    var g = new Graph();
    g.addEdge('a', 'b');

    assert.ifError(g.edge('a', 'constructor'));
    assert.throws(g.edge.bind(g, 'valueOf', 'call'));
  });
});

