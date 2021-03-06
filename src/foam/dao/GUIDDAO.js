/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
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

foam.CLASS({
  package: 'foam.dao',
  name: 'GUIDDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: function() {/*
    DAO Decorator that sets a property to a new random GUID (globally unique identifier) on put(), unless value already set.
    By default, the .id property is used.
    <p>
    Use a foam.dao.EasyDAO with guid:true to automatically set GUIDs. Set
    EasyDAO.seqProperty to the desired property name or use the default
    of 'id'.
  */},

  properties: [
    {
      /** The property to set with a random GUID value, if not already set
        on put() objects. */
      class: 'String',
      name: 'property',
      value: 'id'
    }
  ],

  methods: [
    /** Ensures all objects put() in have a unique id set.
      @param obj the object to process. */
    function put_(x, obj) {
      if ( ! obj.hasOwnProperty(this.property) ) {
        obj[this.property] = foam.uuid.randomGUID();
      }

      return this.delegate.put_(x, obj);
    }
  ]
});
