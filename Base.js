/**

  @module       Base
  @description  object that all other objects in our system will inherit from
                all objects support properties and relationships
  @todo         1) hasMany, hasOne are the only relations so far. Implement embeds, belongsTo, hasAndBelongsToMany?
                2) add readonly capacity to the properties

*/
var EventEmitter = require("events").EventEmitter;
var Collection   = require("Collection");
var registry     = require("registry");
var system       = require("system");
var generateUuid = require("uuid").generate;
var iter         = require("iter");
var is           = require("is");
var func         = require("func");
var forEach      = iter.forEach;
var chain        = iter.chain;
var reduce       = iter.reduce;
var enforce      = is.enforce;
var typeOf       = is.typeOf;
var hasOwnKey    = is.hasOwnKey;
var bind         = func.bind;
var identity     = func.identity;
var Base;

var READ_ONLY_MODE = "readOnly";
var EDIT_MODE = "edit";

function set (object, name, definition, value) {

  if (definition.type && !typeOf("undefined", value)) {
    enforce(definition.type, value);
  }

  Object.defineProperty(object, "_data", Object.create(object._data));

  object._data[name] = value;

  object.emit(name, {
    value: value,
    object: object
  });

  object.emit("update", {
    property: name,
    value: value,
    object: object
  });

  if (!definition.sync || object._dropSync) return;

  system.emit("sync", {
    id: object.id,
    property: name,
    value: typeOf(Base, value) ? value.serialise() : value
  });

}


function createProperty (object, name, definition, enumerable) {

  //  create the getters and setters
  Object.defineProperty(object, name, {

    get: function() {

      return this._data[name];

    },

    set: function(value) {

      definition.set = definition.set || identity;

      set(this, name, definition, definition.set(value));

    },

    enumerable: !! enumerable

  });

  if (!typeOf("undefined", definition.defaultValue)) {
    object[name] = definition.defaultValue;
  }

  if (definition.on) {
    forEach(definition.on, function(observer, property) {
      object.on(property, bind(object, observer));
    });
  }

}




/**
  @description  create has many child entities
  @param        {object} object
  @param        {object} hasMany
*/
function createHasMany (object, data) {

  forEach(object["hasMany"], function(relation, name) {

    if (hasOwnKey(name, data)) {

      forEach(data[name], function(data) {
        object[name].add(relation.spawn(data));
      });
    }

  });

}


/**
  @description  create has one child entities
  @param        {object} object
  @param        {object} hasOne
*/
function createHasOne (object, hasOne) {

  forEach(object["hasOne"], function(relation, name) {

    if (hasOwnKey(name, hasOne)) {
      object[name] = relation.spawn(hasOne[name]);
    }

  });

}



/**
  @description  sets up the properties on the model
*/
function initProperties (object) {

  Object.defineProperties(object, {
    "_data": {
      value: {}
    },
    "_dropSync": {
      value: false
    }
  });


  forEach(object.properties, function(definition, name) {

    if (!hasOwnKey(name, object)) {

      //  create an enumerable property
      createProperty(object, name, definition, true);

    }

  });

}



/**
  @description  sets up the hasMany relationships on the model,
*/
function initHasMany (object) {


  forEach(object.hasMany, function(relation, name) {

    if (!hasOwnKey(name, object)) {

      //  create a non-enumerable property
      createProperty(object, name, {
        'defaultValue': Collection.spawn(relation),
        'type'        : Collection
      });

    }

  });

}


/**
  @description  sets up the hasOne relationships on the model,
*/
function initHasOne (object) {

  forEach(object.hasOne, function(relation, name) {

    if (!hasOwnKey(name, object)) {

      //  create a non-enumerable property
      createProperty(object, name, {
        'type'        : relation
      });

    }

  });

}


/**
  @description  loops over all the properties values
                and updates their values from data
  @param        {object} data
*/
function updateProperties (object, data) {

  forEach(object, function(property, name){

    if (hasOwnKey(name, data)) {
      object[name] = data[name];
    }

  });

}




Base = EventEmitter.extend({

  READ_ONLY_MODE: {
    value: READ_ONLY_MODE,
    configurable: false
  },

  EDIT_MODE: {
    value: EDIT_MODE,
    configurable: false
  },

  EDIT_EVENT: {
    value: null,
    configurable: false
  },

  /**
    @description  enumerable properties
  */
  properties: {

    value: {

      id: {
        type: 'string'
      },

      edit: {
        defaultValue: false,
        type: "boolean"
      },

      mode: {
        defaultValue: READ_ONLY_MODE,
        type: "string",
        on: {
          edit: function () {

            if (this.edit) {

              this.mode = this.EDIT_MODE;

              system.emit(this.EDIT_EVENT, {
                object: this
              });

            }
            else {

              this.mode = this.READ_ONLY_MODE;

            }

          }
        }
      },

      locked: {
        defaultValue: false,
        type: "boolean",
        sync: true,
        on: {
          mode: function () {
            this.locked = this.mode === this.READ_ONLY_MODE ? false : true;
          }
        }
      }

    }

  },


  //  constructors

  /**
    @description  Object.create pre filter
  */
  __preCreate__: {

    value: function(definition) {

      //  merge all the definition object declarations
      forEach(["properties", "hasMany", "hasOne"], function(property) {

        definition[property] = {
          value: reduce({}, chain([definition[property] ? definition[property].value : {}, this[property] || {}]), function(acc, value, key) {
            if (!hasOwnKey(key, acc)) {
              acc[key] = value;
            }
            return acc;
          })
        };

      }, this);
    }

  },



  /**
    @description  Object.spawn constructor
  */
  __init__: {

    value: function(data) {

        data = data || {};

        initProperties(this);
        initHasMany(this);
        initHasOne(this);
        updateProperties(this, data);
        createHasMany(this, data);
        createHasOne(this, data);

        //  if the incoming data has no id, generate one, and add it to the data object
        //  as the data object is being passed around all client from the server to instantiate
        //  the synced model
        //  todo: add serialise function and remove the patch on the data.id
        // if (typeof data.id === "undefined") {
        //   this.id = data.id = utils.generateId();
        // }

        this.id = generateUuid();

        registry.add(this);

    }
  },


  sync: {

    value: function (data) {

      this._dropSync = true;

      if (typeOf(Base, this.properties[data.property].type)) {
        data.value = this.properties[data.property].type.spawn(data.value);
      }

      this[data.property] = data.value;

      this._dropSync = false;

    }

  },

  //  ????

  destroy: {

    value: function () {

      registry.remove(this);

    }
  }


});


module.exports = Base;
