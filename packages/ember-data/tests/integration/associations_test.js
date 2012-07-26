var get = Ember.get, set = Ember.set;

var store, adapter, Comment;

module("Associations", {
  setup: function() {
    adapter = DS.Adapter.create();

    store = DS.Store.create({
      isDefaultStore: true,
      adapter: adapter
    });

    Comment = DS.Model.extend();
    Comment.reopen({
      body: DS.attr('string'),
      comments: DS.hasMany(Comment),
      comment: DS.belongsTo(Comment)
    });
  },

  teardown: function() {
    store.destroy();
  }
});

test("when adding a record to an association that belongs to another record that has not yet been saved, only the parent record is saved", function() {
  expect(2);

  var transaction = store.transaction();
  var parentRecord = transaction.createRecord(Comment);
  var childRecord = transaction.createRecord(Comment);

  parentRecord.get('comments').pushObject(childRecord);

  var createCalled = 0;
  adapter.createRecord = function(store, type, record) {
    createCalled++;
    if (createCalled === 1) {
      equal(record, parentRecord, "parent record is committed first");
      store.didCreateRecord(record, { id: 1 });
    } else if (createCalled === 2) {
      equal(record, childRecord, "child record is committed after its parent is committed");
    }
  };

  transaction.commit();
});

test("if a record is added to the store while a child is pending, auto-committing the child record should not commit the new record", function() {
  expect(2);

  var parentRecord = Comment.createRecord();
  var childRecord = Comment.createRecord();

  parentRecord.get('comments').pushObject(childRecord);

  var createCalled = 0;
  adapter.createRecord = function(store, type, record) {
    createCalled++;
    if (createCalled === 1) {
      equal(record, parentRecord, "parent record is committed first");

      Comment.createRecord();

      store.didCreateRecord(record, { id: 1 });
    } else if (createCalled === 2) {
      equal(record, childRecord, "child record is committed after its parent is committed");
    } else {
      ok(false, "Third comment should not be saved");
    }
  };

  store.commit();
});

test("if a parent record and an uncommitted pending child belong to different transactions, committing the parent's transaction does not cause the child's transaction to commit", function() {
  expect(1);

  var parentTransaction = store.transaction();
  var childTransaction = store.transaction();

  var parentRecord = parentTransaction.createRecord(Comment);
  var childRecord = childTransaction.createRecord(Comment);

  parentRecord.get('comments').pushObject(childRecord);

  var createCalled = 0;
  adapter.createRecord = function(store, type, record) {
    createCalled++;
    if (createCalled === 1) {
      equal(record, parentRecord, "parent record is committed");

      store.didCreateRecord(record, { id: 1 });
    } else {
      ok(false, "Child comment should not be saved");
    }
  };

  parentTransaction.commit();
});

test("an association has an isLoaded flag that indicates whether the ManyArray has finished loaded", function() {
  expect(7);

  var array;

  adapter.find = function(store, type, id) {
    setTimeout(async(function() {
      equal(array.get('isLoaded'), false, "Before loading, the array isn't isLoaded");
      store.load(type, { id: id });

      if (id === 3) {
        equal(array.get('isLoaded'), true, "After loading all records, the array isLoaded");
      } else {
        equal(array.get('isLoaded'), false, "After loading some records, the array isn't isLoaded");
      }
    }), 1);
  };

  array = store.findMany(Comment, [ 1, 2, 3 ]);
  equal(get(array, 'isLoaded'), false, "isLoaded should not be true when first created");
});

var Person;

test("When a hasMany association is accessed, the adapter's findMany method should not be called if all the records in the association are already loaded", function() {
  expect(0);

  adapter.findMany = function() {
    ok(false, "The adapter's find method should not be called");
  };

  Person = DS.Model.extend({
    updatedAt: DS.attr('string'),
    name: DS.attr('string')
  });

  Comment = DS.Model.extend({
    person: DS.belongsTo(Person)
  });

  Person.reopen({
    comments: DS.hasMany(Comment)
  });

  store.load(Person, { id: 1, comments: [ 1 ] });
  store.load(Comment, { id: 1 });

  var person = store.find(Person, 1);

  person.get('comments');

  store.load(Person, { id: 1, comments: [ 1 ] });
});
