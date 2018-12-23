'use strict';

//var LinkedList = require('./linked_list');

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

/*
 * TESTS for HashTable
*/

//'use strict';

//var HashTable = require('../..').DataStructures.HashTable;
var assert = require('assert');

describe('Hash Table', function() {
  it('should calculate hashes using the same algorithm as ' +
    'Java\'s String.hashCode', function() {
    var h = new HashTable();
    assert.equal(h.hash('The quick brown fox jumps over the lazy dog'),
        -609428141);
    assert.equal(h.hash('Testing the hashCode function'), 1538083358);
    assert.equal(h.hash(''), 0);
    assert.equal(h.hash('a'), 97);
    var longString =
        'k"hg3q#+~/l2Eljan;DB x.P<pX[!C`/Nr6w~YIPz;X3z<]b6nDvda|ToZM+a%D#' +
        ':PE@z[bl$/PRT7m76}FV=UW/3SPkkdRkuC~9TKgMg.^#n)iiq{AZ?}+pv;>%-:iA' +
        '/b/hG($8-SZcZX871&;fDEWthw.b5agzov],X00--O:mcQ$JFi-4uIo"D:(r(yvs' +
        'dj%Pq/b$sY5(O8!{^icIBwTT>,fv=$@d<tqde$]?X##Gb![s44rA=fSI1o#S;0V[' +
        'rPy#=z7Vf0"Si!D8oN5;qNiXNA_)(9*0JD<r$uY~LijTd@dtA+N-GK5yC80WRiJ{' +
        '@7x:WbD/$k6Db~,/aU7n)9?{cP4z6>D(>167.xqSDXjBS#TV3oIjMGCo9)!e&hO ' +
        'I<[jlz3]r-FFFeNe#Ch4oQ,4A;i,3&3Oq*2LW(KFUW9b$}"z8,B>HRH9.D%.S~o3' +
        'L_6{wu!Kp538AmLREp*ZP`]K9}uRGEEUj37[PQq2Y>cf_{L={Ko"ADnZ8d[q0{-3' +
        '@=e8UC4y)@aCefzleW[>Q8y}@Of9{WNI|?ShSF7C{<JYRb6QBrNauQzUio(]XIsk' +
        's`*F9tK|GBhaj.W%XV~7zSx}tFBI6h}|a sah/$-|fJs_;Ci5q-_d]+-0o/vY|:6' +
        '~cx%aJx8sy*G!"wVL-S?g.BPSB`N +QPCvTar`[= WYsnxR2fmE2}ON]8C:*g}*V' +
        't%Bh1D`,s`>62(A4o<g9G2d+)R;;p`?wUdr^uy:ibCX)qmo.xH/rf"xmC-p($akh' +
        'gVM;#K i )m%I8(0qFCHbzr;gVAvj/jrae=0DgF3C?&9Rvs$&J"r`yvrhM^A=?Wi' +
        'fE$O[YV8X3PV6TR(*Ed4|y[8tG~K=[MxgLI%yx]16Kg3YSHE{2^1TOAnf`EsKWm,' +
        'WGD)s;Zs<8K6(K_kVko"mV82Pcl)0Rx}jfq3VBm:MOX/gLfSPvLx~%(3jHh5gG2e' +
        'JaQ|nW}ekR_W5Ldv`@j^hd%Wiw6moGekrS>k7gRR|dd?7Pi:`0; r_wq=-F-e(iY';
    assert.equal(h.hash(longString), -998071508);
  });

  it('should initialize the table with the given capacity',
    function() {
      var h = new HashTable();
      assert.equal(h.capacity, 64); // default initial capacity;
      assert.equal(h.size, 0);

      h = new HashTable(2);
      assert.equal(h.capacity, 2);
    });

  it('should allow putting and getting elements from the table', function() {
    var h = new HashTable(16);
    var a = {a: 'foo', b: 'bar'};
    h.put('foo', a);

    assert.equal(h.size, 1);
    assert.strictEqual(h.get('foo'), a);

    var b = {a: 'bar', b: 'baz'};
    h.put('bar', b);

    assert.equal(h.size, 2);
    assert.strictEqual(h.get('bar'), b);
  });

  it('should replace items if the same key is reused', function() {
    var h = new HashTable(16);
    var a = {a: 'foo', b: 'bar'};
    h.put('foo', a);
    assert.strictEqual(h.get('foo'), a);

    var b = {a: 'bar', b: 'baz'};
    h.put('foo', b);
    assert.strictEqual(h.get('foo'), b);
  });

  it('should return undefined if there\'s no element', function() {
    var h = new HashTable(8);
    assert.equal(h.get('foo'), undefined);
    assert.equal(h.get('bar'), undefined);
  });

  it('should handle hash conflicts', function() {
    var h = new HashTable(4);
    // Both keys are supposed to be pushed to the same position
    assert.equal(h._position('a'), h._position('e'));
    h.put('a', 'foo');
    h.put('e', 'bar');
    // the list in that position should keep both items
    assert.equal(h._table[h._position('a')].length, 2);

    // and still return them properly
    assert.equal(h.get('a'), 'foo');
    assert.equal(h.get('e'), 'bar');
  });

  it('should increase capacity if needed', function() {
    var h = new HashTable(2);
    assert.equal(h.capacity, 2);

    h.put('foo', 'foo');
    assert.equal(h.capacity, 2);

    h.put('bar', 'bar');
    assert.equal(h.capacity, 4);
  });

  it('should allow removing items', function() {
    var h = new HashTable();
    assert.equal(h.get('foo'), undefined);

    h.put('foo', 'bar');
    assert.equal(h.get('foo'), 'bar');

    h.del('foo');
    assert.equal(h.get('foo'), undefined);

    // Deleting an unexistent item shouldn't do anything
    h.del('foo');
    assert.equal(h.get('foo'), undefined);
  });

  it('should allow non-string keys', function() {
    var h = new HashTable();
    h.put(10, 5);
    assert.equal(h.get(10), 5);

    var o = {a: 'foo', b: 'bar'};
    h.put(o, 'foo');
    assert.equal(h.get(o), 'foo');
  });

  it('should perform a function to all keys with forEach', function() {
    var h = new HashTable();
    h.put(1, 10);
    h.put(2, 20);
    h.put(3, 30);

    var totalKeys = 0;
    var totalValues = 0;
    h.forEach(function(k, v) {
      totalKeys += k;
      totalValues += v;
    });

    assert.equal(totalKeys, 6);
    assert.equal(totalValues, 60);
  });
});


