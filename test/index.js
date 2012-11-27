var assert  = require("assert");
var sinon   = require("sinon");
var Base    = require("../Base");
var fakes;

describe("test Object module: ", function() {


  beforeEach(function() {

    fakes = sinon.sandbox.create();

  });

  afterEach(function() {

    fakes.restore();
    Proto = null;

  });


  describe("Object.prototype.extend", function() {

    it("should create a new object using itself as the prototype", function() {

      var object = Proto.extend();
      assert.equal(true, Proto.isPrototypeOf(object));

    });


    it("should create a new object using its parameter as the definition", function() {

      var object = Proto.extend({
        p: {
          value: 3
        }
      });

      assert.equal(true, object.hasOwnProperty("p"));

    });


    it("should call the __preCreate__ method on the definition if it exists", function() {

      var object = Proto.extend({
        p: {
          value: 3
        }
      });

      assert.equal(true, pre.calledOnce);

    });


  });


  describe("Object.prototype.spawn", function() {

    it("should create a new object using itself as the prototype", function() {

      var object = Proto.spawn();
      assert.equal(true, Proto.isPrototypeOf(object));

    });


    it("should call the __init__ method on itself if it exists", function() {

      var object = Proto.spawn(1, 2);

      assert.equal(true, init.calledOnce);
      assert.equal(1, init.args[0][0]);
      assert.equal(2, init.args[0][1]);

    });


  });

});
