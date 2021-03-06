/**

  @module       Base
  @description  model that all other models in our process will inherit from
                all models support properties and relationships
  @todo         1) hasMany, hasOne are the only relations so far. Implement embeds, belongsTo, hasAndBelongsToMany?
                2) add readonly capacity to the properties

*/
var uuid = require('node-uuid');
var Proto = require('super-proto');
var Collection = require('super-collection');
var iter = require('super-iter');
var is = require('super-is');
var func = require('super-func');
var forEach = iter.forEach;
var filter = iter.filter;
var map = iter.map;
var chain = iter.chain;
var reduce = iter.reduce;
var enforce = is.enforce;
var typeOf = is.typeOf;
var hasOwnKey = is.hasOwnKey;
var hasKeyOfValue = is.hasKeyOfValue;
var bind = func.bind;
var identity = func.identity;
var partial = func.partial;
var Base;

function set (model, name, definition, value) {

  if (definition.type) {
    enforce(definition.type, value);
  }

  Object.defineProperty(model, '_data', Object.create(model._data));

  model._data[name] = value;

  model.emit(name, {
    value: value,
    model: model
  });

  if (!definition.sync || model._dropsync) return;

  process.emit('sync', {
    id: model.id,
    property: name,
    value: value
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


  if (!typeOf('undefined', definition.defaultValue)) {

    var value = definition.defaultValue;

    if (typeOf('array', definition.defaultValue)) value = [];

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
function createHasMany (model, data, e) {

  forEach(model.hasMany, function(relation, name) {

    if (hasOwnKey(name, data)) {

      forEach(data[name], function(data) {

        model[name].add(relation.init(data, e));
      });
    }

  });

}


/**
  @description  create has one child entities
  @param        {Object} model
  @param        {Object} hasOne
*/
function createHasOne (model, data, e) {

  forEach(model.hasOne, function(relation, name) {

    if (hasOwnKey(name, data)) {

      model[name] = relation.init(data[name], e);
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

      var enumerable = !(hasKeyOfValue('enumerable', false , definition));

      //  create an enumerable property
      createProperty(model, name, definition, enumerable);
    }

  });

}



/**
  @description  sets up the hasMany relationships on the model,
*/
function initHasMany (model) {


  forEach(model.hasMany, function(relation, name) {

    if (!hasOwnKey(name, model)) {

      var defaultValue = Collection.init({
        type: relation,
        id: model.id + "-" + name
      });

      //  create a non-enumerable property
      createProperty(model, name, {

        defaultValue: defaultValue,

        type: Collection

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

        type: relation,

        set: function (data) {
          return typeOf(relation, data) ? data : relation.init(data);
        }

      });

    }

  });

}


/**
  @description  loops over all the properties values
                and updates their values from data
  @param        {Object} data
*/
function updateProperties (model, data, e) {

  model.id = data.id;

  forEach(model, function(property, name){

    if (hasOwnKey(name, data)) {

      try {

        model[name] = data[name];
      }
      catch (err) {

        e.errors.push(err);
      }
    }

  });

}


function serialise (model, recurse) {

  var serialised = filter(model, partial(identity, true));

  if (!typeOf("undefined", recurse)) {

    forEach(model.hasMany, function (relation, name) {

      serialised[name] = map(model[name].items, serialise);

    });

  }

  return serialised;

}


Base = Proto.extend({

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
        type: 'string',
        enumerable: false
      },

      edit: {
        defaultValue: false,
        type: "boolean",
        set: function (value) {

          if (value) {

            process.emit(this.EDIT_EVENT, {
              model: this
            });

          }

          return value;
        },
        enumerable: false
      },

      locked: {
        defaultValue: false,
        type: "boolean",
        sync: true,
        on: {
          edit: function () {
            this.locked = this.edit;
          }
        },
        enumerable: false
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
          value: reduce(chain([definition[property] ? definition[property].value : {}, this[property] || {}]), function(acc, value, key) {
            if (!hasOwnKey(key, acc)) {
              acc[key] = value;
            }
            return acc;
          }, {})
        };

      }, this);
    }

  },



  /**
    @description  Object.init constructor
  */
  __init__: {

    value: function(data, e) {

      var throwErrors = false;

      data = data || {};

      if (typeof e === 'undefined') {

        throwErrors = true;

        e = {
          errors: []
        };

      }

      if (typeof data.id === "undefined") {
        data.id = uuid.v4();
      }

      initProperties(this);
      initHasMany(this);
      initHasOne(this);
      updateProperties(this, data, e);
      createHasMany(this, data, e);
      createHasOne(this, data, e);

      if (throwErrors && e.errors.length) {
        throw e.errors;
      }

      process.emit('registry:add', this);

    }
  },


  serialise: {

    value: function (recurse) {

      return serialise(this, recurse);

    }

  },


  sync: {

    value: function (data) {

      this._dropsync = true;

      if (typeOf(Base, this.properties[data.property].type)) {
        data.value = this.properties[data.property].type.init(data.value);
      }

      this[data.property] = data.value;

      this._dropsync = false;

    }

  }

});


module.exports = Base;
