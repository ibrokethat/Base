/**

  @module       Base
  @description  model that all other models in our system will inherit from
                all models support properties and relationships
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


function set (model, name, definition, value) {

  if (definition.type && !typeOf("undefined", value)) {
    enforce(definition.type, value);
  }

  Object.defineProperty(model, "_data", Object.create(model._data));

  model._data[name] = value;

  model.emit(name, {
    value: value,
    model: model
  });

  if (!definition.sync || model._dropsync) return;

  system.emit("sync", {
    id: model.id,
    property: name,
    value: typeOf(Base, value) ? value.serialise() : value
  });

}


function createProperty (model, name, definition, enumerable) {

  definition.get = definition.get || identity;
  definition.set = definition.set || identity;

  //  create the getters and setters
  Object.defineProperty(model, name, {

    get: function() {

      return definition.get.call(this, this._data[name]);

    },

    set: function(value) {

      set(this, name, definition, definition.set.call(this, value));

    },

    enumerable: !! enumerable

  });

  if (!typeOf("undefined", definition.defaultValue)) {

    var value = definition.defaultValue;

    if (typeOf("array", definition.defaultValue)) value = [];

    model._data[name] = definition.set(value);

  }

  if (definition.on) {
    forEach(definition.on, function(observer, property) {
      model.on(property, bind(model, observer));
    });
  }

}




/**
  @description  create has many child entities
  @param        {Object} model
  @param        {Object} hasMany
*/
function createHasMany (model, data) {

  forEach(model["hasMany"], function(relation, name) {

    if (hasOwnKey(name, data)) {
      forEach(data[name], function(data) {
        model[name].add(relation.spawn(data));
      });
    }

  });

}


/**
  @description  create has one child entities
  @param        {Object} model
  @param        {Object} hasOne
*/
function createHasOne (model, hasOne) {

  forEach(model["hasOne"], function(relation, name) {

    if (hasOwnKey(name, hasOne)) {
      model[name] = relation.spawn(hasOne[name]);
    }

  });

}



/**
  @description  sets up the properties on the model
*/
function initProperties (model) {

  Object.defineProperties(model, {
    "_data": {
      value: {}
    },
    "_dropsync": {
      value: false,
      writable: true
    }
  });


  forEach(model.properties, function(definition, name) {

    if (!hasOwnKey(name, model)) {

      //  create an enumerable property
      createProperty(model, name, definition, true);

    }

  });

}



/**
  @description  sets up the hasMany relationships on the model,
*/
function initHasMany (model) {


  forEach(model.hasMany, function(relation, name) {

    if (!hasOwnKey(name, model)) {

      //  create a non-enumerable property
      createProperty(model, name, {
        'defaultValue': Collection.spawn({
          type: relation,
          id: model.id + "-" + name
        }),
        'type'        : Collection
      });

    }

  });

}


/**
  @description  sets up the hasOne relationships on the model,
*/
function initHasOne (model) {

  forEach(model.hasOne, function(relation, name) {

    if (!hasOwnKey(name, model)) {

      //  create a non-enumerable property
      createProperty(model, name, {
        'type'        : relation
      });

    }

  });

}


/**
  @description  loops over all the properties values
                and updates their values from data
  @param        {Object} data
*/
function updateProperties (model, data) {

  forEach(model, function(property, name){

    if (hasOwnKey(name, data)) {
      model[name] = data[name];
    }

  });

}




Base = EventEmitter.extend({

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
        type: "boolean",
        set: function (value) {

          if (value) {

            system.emit(this.EDIT_EVENT, {
              model: this
            });

          }

          return value;
        }
      },

      locked: {
        defaultValue: false,
        type: "boolean",
        sync: true,
        on: {
          edit: function () {
            this.locked = this.edit;
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

        //  if the incoming data has no id, generate one, and add it to the data object
        //  as the data object is being passed around all client from the server to instantiate
        //  the synced model
        //  todo: add serialise function and remove the patch on the data.id
        if (typeof data.id === "undefined") {
          data.id = generateUuid();
        }
        updateProperties(this, data);
        initHasMany(this);
        createHasMany(this, data);
        initHasOne(this);
        createHasOne(this, data);

        registry.add(this);

    }
  },


  sync: {

    value: function (data) {

      this._dropsync = true;

      if (typeOf(Base, this.properties[data.property].type)) {
        data.value = this.properties[data.property].type.spawn(data.value);
      }

      this[data.property] = data.value;

      this._dropsync = false;

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
