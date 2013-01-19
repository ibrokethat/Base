var assert     = require("assert");
var sinon      = require("sinon");
var system     = require("system");
var registry   = require("registry");
var Collection = require("Collection");
var Base       = require("../Base");
var fakes;
var Model;
var ChildModel;
var model;

describe("test Base module: ", function() {


  beforeEach(function() {

    registry.__flush__();

    fakes = sinon.sandbox.create();

    ChildModel = Base.extend({
      properties: {
        value: {
          name: {}
        }
      }
    });


    Model = Base.extend({

      EDIT_EVENT: {
        value: "editTest",
        configurable: false
      },

      hasMany: {

        value: {

          children: ChildModel

        }

      },

      properties: {

        value: {

          anyTest: {},

          stringTest: {
            type: "string"
          },

          numberTest: {
            type: "number"
          },

          booleanTest: {
            type: "boolean",
          },

          arrayTest: {
            type: "array"
          },

          defaultValueTest: {
            defaultValue: 100
          },

          syncTest: {
            sync: true
          },

          getTest: {
            get: function (value) {
              return this.anyTest + "@" + this.stringTest + ".com";
            }
          },

          setTest: {
            set: function (value) {
              return value * 100;
            }
          },

          onTest: {
            on: {
              anyTest: function () {
                this.onTest = (this.anyTest === 100) ? true : false;
              }
            }
          }
        }
      }

    });

    model = Model.spawn({
      id: "id",
      stringTest: "string",
      numberTest: 1,
      booleanTest: true,
      arrayTest: [],
      children: [
        {name: "si"},
        {name: "sarah"},
        {name: "matilda"},
        {name: "jefferson"},
        {name: "elliot"}
      ]
    });

  });

  afterEach(function() {

    fakes.restore();
    Model = null;
    model = null;

  });


  describe("Base spawn: ", function() {

    it("should create a new object whose prototype is Model", function() {

      assert.equal(true, Model.isPrototypeOf(model));

    });

    it("should create a new object with a default set of properties", function() {

      assert.equal(true, model.hasOwnProperty("id"));
      assert.equal(true, model.hasOwnProperty("edit"));
      assert.equal(true, model.hasOwnProperty("locked"));

    });


    it("should create a new object with supplied parameters", function() {

      assert.equal("string", model.stringTest);
      assert.equal(1, model.numberTest);
      assert.equal(true, model.booleanTest);
      assert.equal(true, Array.prototype.isPrototypeOf(model.arrayTest));


    });

    it("should create properties that can hold any data", function() {

      model.anyTest = "string";
      assert.equal("string", model.anyTest);
      model.anyTest = 10;
      assert.equal(10, model.anyTest);
      model.anyTest = true;
      assert.equal(true, model.anyTest);

      var array = [];
      model.anyTest = array;
      assert.equal(array, model.anyTest);

    });

    it("should create properties that are type coerced", function() {

      model.stringTest = "string";
      assert.equal("string", model.stringTest);
      assert.throws(function() {
        model.stringTest = 10;
      });

      model.numberTest = 10;
      assert.equal(10, model.numberTest);
      assert.throws(function() {
        model.numberTest = "string";
      });

      model.booleanTest = true;
      assert.equal(true, model.booleanTest);
      assert.throws(function() {
        model.booleanTest = 10;
      });

      var array = [];
      model.arrayTest = array;
      assert.equal(array, model.arrayTest);
      assert.throws(function() {
        model.arrayTest = 10;
      });

    });

    it("should create properties with default values", function() {


      assert.equal(undefined, model.anyTest);
      assert.equal(100, model.defaultValueTest);

    });


    it("should create properties that can sync", function() {

      var listener = fakes.stub();
      system.on("sync", listener);
      model.syncTest = "syncTestData";
      assert.equal(true, listener.calledOnce);
      assert.equal("id", listener.args[0][0].id);
      system.removeListener("sync", listener);

    });

    it("should create properties that cannot sync", function() {

      var listener = fakes.stub();
      system.on("sync", listener);
      model.anyTest = "syncTestData";
      assert.equal(false, listener.calledOnce);
      system.removeListener("sync", listener);

    });

    it("should create properties with a custom getter", function() {

      model.anyTest = "si";
      model.stringTest = "ibrokethat";
      assert.equal("si@ibrokethat.com", model.getTest);

    });

    it("should create properties with a custom setter", function() {

      model.setTest = 100;
      assert.equal(10000, model.setTest);

    });

    it("should create properties that can observe other properties", function() {

      model.anyTest = 100;
      assert.equal(true, model.onTest);

      model.anyTest = 1000;
      assert.equal(false, model.onTest);

    });


  });


  describe("edit mode: ", function () {

    it("should lock the model when in edit mode", function() {

      var listener = fakes.stub();
      system.on("editTest", listener);

      var listener2 = fakes.stub();
      system.on("sync", listener2);

      model.edit = true;
      assert.equal(true, listener.calledOnce);
      assert.equal(true, listener2.calledOnce);
      assert.equal(model, listener.args[0][0].model);
      assert.equal(true, model.locked);

      model.edit = false;
      assert.equal(true, listener.calledOnce);
      assert.equal(true, listener2.calledTwice);
      assert.equal(false, model.locked);

      system.removeListener("editTest", listener);
      system.removeListener("sync", listener2);

    });


  });


  describe("relationships: ", function () {

    it("should create relationship accessors", function() {

      assert.equal(true, Collection.isPrototypeOf(model.children));

    });

    it("should recurseively popolate relationships from raw data", function() {

      assert.equal(5, model.children.items.length);
      assert.equal("si", model.children.items[0].name);
      assert.equal("sarah", model.children.items[1].name);
      assert.equal("matilda", model.children.items[2].name);
      assert.equal("jefferson", model.children.items[3].name);
      assert.equal("elliot", model.children.items[4].name);

    });

  });


});


