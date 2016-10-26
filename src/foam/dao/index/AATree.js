/**
 * @license
 * Copyright 2012 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
  Represents one node's state in a binary tree. Each tree operation
  can rebalance the subtree or create a new node, so those methods
  return a tree node reference to replace the one called. It may be the
  same node, a different existing node, or a new node.
  <p>
  <code>
    // replace s.right with result of operations on s.right
    s.right = s.right.maybeClone(locked).split(locked);
  </code>
*/
foam.CLASS({
  package: 'foam.dao.index',
  name: 'TreeNode',

  axioms: [ foam.pattern.Progenitor.create() ],

  properties: [
    // per node properties
    { class: 'foam.pattern.progenitor.PerInstance', name: 'key'   },
    { class: 'foam.pattern.progenitor.PerInstance', name: 'value' },
    { class: 'foam.pattern.progenitor.PerInstance', name: 'size'  },
    { class: 'foam.pattern.progenitor.PerInstance', name: 'level' },
    {
      class: 'foam.pattern.progenitor.PerInstance',
      name: 'left',
    },
    {
      class: 'foam.pattern.progenitor.PerInstance',
      name: 'right',
    },

    // per tree properties
    {
      /**
        The null node guards the leaves of the tree. It is a single shared
        instance per tree, set by TreeIndex when setting up the tree node
        factory. Every partial or empty node is marked by setting its
        left and/or right to the nullNode.
        <p>
        TreeNodes use the nullNode reference to clear their left/right
        references, and NullTreeNode uses the tree node factory to create
        new nodes.
      */
      name: 'nullNode'
    },
    {
      /** TODO: subSelectMode as a string method name is not great.
        Build a nested object of bools, strip one each layer:
        [false, [true, [false, [false]]]] */
      name: 'subSelectMode',
    }
  ],

  methods: [

    /**
       Clone is only needed if a select() is active in the tree at the
       same time we are updating it.
    */
    function maybeClone(locked) {
      return locked ? this.clone() : this;
    },

    function updateSize() {
      this.size = this.left.size + this.right.size + this.value.size();
    },

    /** @return Another node representing the rebalanced AA tree. */
    function skew(locked) {
      if ( this.left.level === this.level ) {
        // Swap the pointers of horizontal left links.
        var l = this.left.maybeClone(locked);

        this.left = l.right;
        l.right = this;

        this.updateSize();
        l.updateSize();

        return l;
      }

      return this;
    },

    /** @return a node representing the rebalanced AA tree. */
    function split(locked) {
      if (
          this.right.level       &&
          this.right.right.level &&
          this.level === this.right.right.level
      ) {
        // We have two horizontal right links.
        // Take the middle node, elevate it, and return it.
        var r = this.right.maybeClone(locked);

        this.right = r.left;
        r.left = this;
        r.level++;

        this.updateSize();
        r.updateSize();

        return r;
      }

      return this;
    },

    function predecessor() {
      if ( ! this.left.level ) return this;
      for ( var s = this.left ; s.right.level ; s = s.right );
      return s;
    },

    function successor() {
      if ( ! this.right.level ) return this;
      for ( var s = this.right ; s.left.level ; s = s.left );
      return s;
    },

    /**
       Removes links that skip levels.
       @return the tree with its level decreased.
    */
    function decreaseLevel(locked) {
      var expectedLevel = Math.min(
          this.left.level  ? this.left.level  : 0,
          this.right.level ? this.right.level : 0) + 1;

      if ( expectedLevel < this.level ) {
        this.level = expectedLevel;
        if ( this.right.level && expectedLevel < this.right.level ) {
          this.right = this.right.maybeClone(locked);
          this.right.level = expectedLevel;
        }
      }

      return this;
    },

    /** extracts the value with the given key from the index */
    function get(key, compare) {
      var r = compare(this.key, key);

      if ( r === 0 ) return this.value; // TODO... tail.get(this.value) ???

      return r > 0 ? this.left.get(key, compare) : this.right.get(key, compare);
    },

    /** scans the entire tree and returns all matches */
    function getAll(key, compare, retArray) {
      var r = compare(this.key, key);

      if ( r === 0 ) retArray.push(this.value);

      this.left.getAll(key, compare, retArray);
      this.right.getAll(key, compare, retArray);
    },

    function putKeyValue(key, value, compare, dedup, locked) {
      var s = this.maybeClone(locked);

      var r = compare(s.key, key);

      if ( r === 0 ) {
        dedup(value, s.key);

        s.size -= s.value.size();
        s.value.put(value);
        s.size += s.value.size();
      } else {
        var side = r > 0 ? 'left' : 'right';

        if ( s[side].level ) s.size -= s[side].size;
        s[side] = s[side].putKeyValue(key, value, compare, dedup, locked);
        s.size += s[side].size;
      }

      return s.split(locked).skew(locked);
    },

    function removeKeyValue(key, value, compare, locked) {
      var s = this.maybeClone(locked);
      var side;
      var r = compare(s.key, key);

      if ( r === 0 ) {
        s.size -= s.value.size();
        s.value.remove(value);

        // If the sub-Index still has values, then don't
        // delete this node.
        if ( s.value && s.value.size() > 0 ) {
          s.size += s.value.size();
          return s;
        }

        // If we're a leaf, easy, otherwise reduce to leaf case.
        if ( ! s.left.level && ! s.right.level ) {
          return this.nullNode;
        }

        side = s.left.level ? 'left' : 'right';

        // TODO: it would be faster if successor and predecessor also deleted
        // the entry at the same time in order to prevent two traversals.
        // But, this would also duplicate the delete logic.
        var l = side === 'left' ?
            s.predecessor() :
            s.successor()   ;

        s.key = l.key;
        s.value = l.value;

        s[side] = s[side].removeNode(l.key, compare, locked);
      } else {
        side = r > 0 ? 'left' : 'right';

        s.size -= s[side].size;
        s[side] = s[side].removeKeyValue(key, value, compare, locked);
        s.size += s[side].size;
      }

      // Rebalance the tree. Decrease the level of all nodes in this level if
      // necessary, and then skew and split all nodes in the new level.
      s = s.decreaseLevel(locked).skew(locked);
      if ( s.right.level ) {
        s.right = s.right.maybeClone(locked).skew(locked);
        if ( s.right.right.level ) {
          s.right.right = s.right.right.maybeClone(locked).skew(locked);
        }
      }

      s = s.split(locked);
      s.right = s.right.maybeClone(locked).split(locked);

      return s;
    },

    function removeNode(key, compare, locked) {
      var s = this.maybeClone(locked);

      var r = compare(s.key, key);

      if ( r === 0 ) return s.left.level ? s.left : s.right;

      var side = r > 0 ? 'left' : 'right';

      s.size -= s[side].size;
      s[side] = s[side].removeNode(key, compare, locked);
      s.size += s[side].size;

      return s;
    },

    /** AATree select takes the sub-ordering to pass to the tail index,
      since primary ordering is assumed to match this tree. */
    function select(sink, skip, limit, order, predicate) {
      if ( limit && limit[0] <= 0 ) return;

      if ( skip && skip[0] >= this.size && ! predicate ) {
        skip[0] -= this.size;
        return;
      }

      // how to sort (select/selectReverse) the tail index
      // 'order' is the sub-ordering for the tail, not including this
      // tree's order.
      var subSelectMode = this.subSelectMode;
      if ( ! subSelectMode ) {
        subSelectMode = this.subSelectMode =
          ( order && order.arg1 && index.Desc.isInstance(order.arg1) ) ?
            'selectReverse' : 'select';
      }

      this.left.select(sink, skip, limit, order, predicate);
      this.value[subSelectMode](sink, skip, limit, order, predicate);
      this.right.select(sink, skip, limit, order, predicate);
    },

    /** AATree selectReverse takes the sub-ordering to pass to the tail index,
      since primary ordering is assumed to match this tree. */
    function selectReverse(sink, skip, limit, order, predicate) {
      if ( limit && limit[0] <= 0 ) return;

      if ( skip && skip[0] >= this.size && ! predicate ) {
        //console.log('reverse skipping: ', this.key);
        skip[0] -= this.size;
        return;
      }

      // how to sort (select/selectReverse) the tail index
      var subSelectMode = this.subSelectMode;
      if ( ! subSelectMode ) {
        subSelectMode = this.subSelectMode =
          ( order && order.arg1 && index.Desc.isInstance(order.arg1) ) ?
            'selectReverse' : 'select';
      }

      this.right.selectReverse(sink, skip, limit, order, predicate);
      this.value[subSelectMode](sink, skip, limit, order, predicate);
      this.left.selectReverse(sink,  skip, limit, order, predicate);
    },

    function gt(key, compare) {
      var s = this;
      var r = compare(key, s.key);

      if ( r < 0 ) {
        var l = s.left.gt(key, compare);
        var copy = s.clone();
        copy.size = s.size - s.left.size + l.size;
        copy.left = l;
        return copy;
      }

      if ( r > 0 ) return s.right.gt(key, compare);

      return s.right;
    },

    function gte(key, compare) {
      var s = this;
      var copy;
      var r = compare(key, s.key);

      if ( r < 0 ) {
        var l = s.left.gte(key, compare);
        copy = s.clone();
        copy.size = s.size - s.left.size + l.size,
        copy.left = l;
        return copy;
      }

      if ( r > 0 ) return s.right.gte(key, compare);

      copy = s.clone();
      copy.size = s.size - s.left.size,
      copy.left = s.nullNode;
      return copy;
    },

    function lt(key, compare) {
      var s = this;
      var r = compare(key, s.key);

      if ( r > 0 ) {
        var rt = s.right.lt(key, compare);
        var copy = s.clone();
        copy.size = s.size - s.right.size + rt.size;
        copy.right = rt;
        return copy;
      }

      if ( r < 0 ) return s.left.lt(key, compare);

      return s.left;
    },

    function lte(key, compare) {
      var s = this;
      var copy;
      var r = compare(key, s.key);

      if ( r > 0 ) {
        var rt = s.right.lte(key, compare);
        copy = s.clone();
        copy.size = s.size - s.right.size + rt.size;
        copy.right = rt;
        return copy;
      }

      if ( r < 0 ) return s.right.lte(key, compare);

      copy = s.clone();
      copy.size = s.size - s.right.size;
      copy.right = s.nullNode;
      return copy;
    },

    function mapOver(fn, ofIndex) {
      // continue the scan through all tails in this tree
      this.left.mapOver(fn, ofIndex);
      this.value.mapOver(fn, ofIndex);
      this.right.mapOver(fn, ofIndex);
    },

    function mapTail(fn) {
      // our tails are the targets, so apply the function
      // and keep the new tail
      // NOTE: size is not allowed to change with this operation,
      //   since changing the type of index is not actually removing
      //   or adding items.
      this.left.mapTail(fn);
      this.value = fn(this.value);
      this.right.mapTail(fn);
    },

  ]
});


/**
  Guards the leaves of the tree. Once instance is created per instance of
  TreeIndex, and referenced by every tree node. Most of its methods are
  no-ops, cleanly terminating queries and other tree operations.
  <p>
  NullTreeNode covers creation of new nodes: when a put value hits the
  nullNode, a new TreeNode is returned and the caller replaces the
  nullNode reference with the new node.
*/
foam.CLASS({
  package: 'foam.dao.index',
  name: 'NullTreeNode',

  properties: [
    {
      /**
        The nullNode for a given tree creates all the new nodes, so it needs
        the factory for the tail index to create inside each new node.
      */
      class: 'Simple',
      name: 'tailFactory'
    },
    {
      /**
        The tree node factory is used to create new, empty tree nodes. They
        will be initialized with a new tail index from tailFactory.
      */
      class: 'Simple',
      name: 'treeNodeFactory'
    },
    {
      class: 'Simple',
      name: 'left',
      //getter: function() { return undefined; }
    },
    {
      class: 'Simple',
      name: 'right',
      //getter: function() { return undefined; }
    },
    {
      class: 'Simple',
      name: 'size',
      //getter: function() { return 0; }
    },
    {
      class: 'Simple',
      name: 'level',
      //getter: function() { return 0; }
    }
  ],

  methods: [
    function init() {
      this.left = undefined;
      this.right = undefined;
      this.size = 0;
      this.level = 0;
    },

    function clone()         { return this; },
    function maybeClone()    { return this; },
    function skew(locked)    { return this; },
    function split(locked)   { return this; },
    function decreaseLevel() { return this; },
    function get()           { return undefined; },
    function updateSize()    {  },

    /** Add a new value to the tree */
    function putKeyValue(key, value) {
      var subIndex = this.tailFactory.spawn();
      subIndex.put(value);
      var n = this.treeNodeFactory.spawn();
      n.left = this;
      n.right = this;
      n.key = key;
      n.value = subIndex;
      n.size = 1;
      n.level = 1;
      return n;
    },

    function removeKeyValue() { return this; },
    function removeNode()     { return this; },
    function select()         { },
    function selectReverse()  { },
    function mapOver()  { },
    function mapTail()  { },

    function gt()   { return this; },
    function gte()  { return this; },
    function lt()   { return this; },
    function lte()  { return this; },

    function getAll()  { return; },

    function bulkLoad_(a, start, end, keyExtractor) {
      if ( end < start ) return this;

      var tree = this;
      var m    = start + Math.floor((end-start+1) / 2);
      var am = a[m];
      tree = tree.putKeyValue(keyExtractor(am), am);

      tree.left = tree.left.bulkLoad_(a, start, m-1, keyExtractor);
      tree.right = tree.right.bulkLoad_(a, m+1, end, keyExtractor);
      tree.size += tree.left.size + tree.right.size;

      return tree;
    }
  ]
});
