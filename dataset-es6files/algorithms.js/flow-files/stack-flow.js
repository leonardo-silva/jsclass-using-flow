//'use strict';

//var Queue = require('./queue');

//'use strict';

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
 * Queue (FIFO) using a Linked List as basis
 */
class Queue {
  constructor() {
    this._elements = new LinkedList();

    Object.defineProperty(this, 'length', {
      get: function() {
        return this._elements.length;
      }.bind(this)
    });
  };
  	
  isEmpty() {
    return this._elements.isEmpty();
  };

  /**
   * Adds element to the end of the queue
   */
  push(e) {
    this._elements.add(e);
  };

  /**
   * Pops the element in the beginning of the queue
   */
  pop() {
    if (this.isEmpty()) {
      throw new Error('Empty queue');
    }
    var e = this._elements.get(0);
    this._elements.del(0);
    return e;
  };

  peek() {
    if (this.isEmpty()) {
      throw new Error('Empty queue');
    }

    return this._elements.get(0);
  };

  forEach(fn) {
    this._elements.forEach(fn);
  };

}

//module.exports = Queue;

/**
 * Stack (LIFO) using a Linked List as basis
 */
class Stack extends Queue {
  constructor() {
    Queue.call(this);
  };
  	
  /**
   * Adds element to the top of the stack
   */
  push(e) {
    this._elements.add(e, 0);
  };

}

/**
 * Use a Queue as prototype and just overwrite
 * the push method to insert at the 0 position
 * instead of the end of the queue
 */
//Stack.prototype = new Queue();  - new syntax (ES6) uses the keyword 'extends'

//module.exports = Stack;
// 
//'use strict';

//var Stack = require('../..').DataStructures.Stack;
var assert = require('assert');

describe('Stack', function() {
  it('should start empty', function() {
    var s = new Stack();
    assert(s.isEmpty());
    assert.equal(s.length, 0);
  });

  it('should implement a LIFO logic', function() {
    var s = new Stack();
    s.push(1);
    s.push(2);
    s.push(3);
    assert.equal(s.length, 3);
    assert.equal(s.pop(), 3);
    assert.equal(s.pop(), 2);
    assert.equal(s.pop(), 1);
    assert(s.isEmpty());
    assert.throws(() => s.pop(), Error);
  });

  it('should allow me to peek at the top element in' +
    ' the stack without popping it', function() {
    var s = new Stack();
    s.push(1);
    s.push(2);
    s.push(3);
    assert.equal(s.peek(), 3);
    assert.equal(s.peek(), 3);
    s.pop();
    assert.equal(s.peek(), 2);
  });
});


